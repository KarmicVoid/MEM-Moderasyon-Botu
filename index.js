const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('MEM Moderasyon Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [] };

if (fs.existsSync('./moderasyon.json')) {
    try { 
        botVerisi = JSON.parse(fs.readFileSync('./moderasyon.json', 'utf8')); 
    } catch (e) { 
        console.log("Veri dosyası hatası."); 
    }
}

function veriKaydet() { 
    fs.writeFileSync('./moderasyon.json', JSON.stringify(botVerisi, null, 2)); 
}

client.on('ready', () => { 
    console.log(`${client.user.tag} Moderasyon Botu Görevde!`); 
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // AFK Kontrol
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.reply(`📌 **${user.username}** şu an AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id];
        veriKaydet();
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK modundan çıktın.`);
    }

    if (!message.content.startsWith(prefix) && message.content !== '/yetkilisec') return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = message.content.startsWith(prefix) ? args.shift().toLowerCase() : message.content;

    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller?.includes(role.id));
    };

    if (command === '/yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        botVerisi.yetkiliRoller = message.mentions.roles.map(r => r.id);
        veriKaydet();
        return message.reply("✅ Yetkili rolleri kaydedildi.");
    }

    if (!yetkiliMi() && command !== 'afk') return;

    // --- KOMUTLAR ---

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const dakika = parseInt(args[1]);
        if (!member || isNaN(dakika)) return message.reply("❌ Kullanım: `mem!mute @üye [dakika]`\nÖrnek: `mem!mute @üye 60` (1 saat için)");
        
        try {
            await member.timeout(dakika * 60 * 1000);
            message.reply(`✅ **${member.user.tag}** tam **${dakika}** dakika boyunca susturuldu.`);
        } catch (e) {
            message.reply("❌ Yetkim bu kullanıcının mutesini ayarlamaya yetmiyor.");
        }
    }

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Lütfen mute kaldırılacak kişiyi etiketle!");
        await member.timeout(null);
        message.reply(`✅ **${member.user.tag}** adlı kullanıcının mutesi kaldırıldı.`);
    }

    if (command === 'unban') {
        const userId = args[0];
        if (!userId) return message.reply("❌ Lütfen banı kaldırılacak kişinin ID'sini yaz!");
        try {
            await message.guild.members.unban(userId);
            message.reply(`✅ ID: **${userId}** olan kullanıcının banı kaldırıldı.`);
        } catch (e) {
            message.reply("❌ Ban kaldırılamadı. ID yanlış olabilir veya kullanıcı banlı değil.");
        }
    }

    if (command === 'sil') {
        let sayi = parseInt(args[0]);
        if (!sayi || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası bir sayı gir!");
        await message.channel.bulkDelete(sayi, true);
        message.channel.send(`✅ **${sayi}** mesaj silindi.`).then(m => setTimeout(() => m.delete(), 5000));
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        const sebep = args.slice(1).join(" ") || "Sebep yok";
        if (!user) return message.reply("❌ Birini etiketle!");
        try {
            await message.guild.members.ban(user, { reason: sebep });
            message.reply(`✅ ${user.tag} yasaklandı.`);
        } catch(e) { message.reply("❌ Yetkim yetmiyor."); }
    }

    if (command === 'kick') {
        const user = message.mentions.users.first();
        if (!user) return message.reply("❌ Birini etiketle!");
        try {
            await message.guild.members.kick(user);
            message.reply(`✅ ${user.tag} atıldı.`);
        } catch(e) { message.reply("❌ Yetkim yetmiyor."); }
    }

    if (command === 'lock') {
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply("🔒 Kanal kilitlendi.");
    }

    if (command === 'unlock') {
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
        message.reply("🔓 Kanal açıldı.");
    }

    if (command === 'afk') {
        const sebep = args.join(" ") || "Meşgul";
        if (!botVerisi.afk) botVerisi.afk = {};
        botVerisi.afk[message.author.id] = sebep;
        veriKaydet();
        message.reply(`✅ AFK moduna girdin: **${sebep}**`);
    }
});

client.login(process.env.TOKEN);
