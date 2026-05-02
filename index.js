const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { WelcomeLeave } = require('canvacord');
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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [], kanallar: {} };

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

// --- HOŞ GELDİN SİSTEMİ ---
client.on('guildMemberAdd', async (member) => {
    console.log(`[LOG] Giriş algılandı: ${member.user.username}`);
    if (!botVerisi.kanallar[member.guild.id]?.hosgeldin) return;
    const kanalId = botVerisi.kanallar[member.guild.id].hosgeldin;
    const kanal = member.guild.channels.cache.get(kanalId);
    if (!kanal) return;

    try {
        const welcome = new WelcomeLeave()
            .setAvatar(member.user.displayAvatarURL({ extension: 'png' }))
            .setDisplayName(member.user.username)
            .setTitle("Hoş Geldin!")
            .setMemberCount(member.guild.memberCount)
            .setBackground("https://i.imgur.com/8PrZ94X.png");

        const data = await welcome.build();
        const attachment = new AttachmentBuilder(data, { name: 'hosgeldin.png' });

        await kanal.send({
            content: `👋 **${member.user.username}** Sunucuya girdi, senin sayende **${member.guild.memberCount}** Olduk, Hoş geldin!`,
            files: [attachment]
        });
    } catch (err) { console.error("Hata:", err); }
});

// --- HOŞÇA KAL SİSTEMİ ---
client.on('guildMemberRemove', async (member) => {
    if (!botVerisi.kanallar[member.guild.id]?.hoscakal) return;
    const kanalId = botVerisi.kanallar[member.guild.id].hoscakal;
    const kanal = member.guild.channels.cache.get(kanalId);
    if (!kanal) return;

    try {
        const leave = new WelcomeLeave()
            .setAvatar(member.user.displayAvatarURL({ extension: 'png' }))
            .setDisplayName(member.user.username)
            .setTitle("Hoşça Kal")
            .setMemberCount(member.guild.memberCount)
            .setBackground("https://i.imgur.com/8PrZ94X.png");

        const data = await leave.build();
        const attachment = new AttachmentBuilder(data, { name: 'hoscakal.png' });

        await kanal.send({
            content: `😢 **${member.user.username}** Sunucudan ayrıldı, görüşmek üzere tekrardan bekleriz.`,
            files: [attachment]
        });
    } catch (err) { console.error("Hata:", err); }
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

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Lütfen mute kaldırılacak kişiyi etiketle!");
        await member.timeout(null, sebep);
        message.reply(`✅ **${member.user.tag}** adlı kullanıcının mutesi kaldırıldı. Sebep: ${sebep}`);
    }

    if (command === 'unban') {
        const userId = args[0];
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!userId) return message.reply("❌ Lütfen banı kaldırılacak kişinin **ID**'sini yaz!");
        try {
            await message.guild.members.unban(userId, sebep);
            message.reply(`✅ **${userId}** ID'li kullanıcının banı kaldırıldı. Sebep: ${sebep}`);
        } catch (e) {
            message.reply("❌ Kullanıcı bulunamadı veya banı zaten yok.");
        }
    }

    if (command === 'sil') {
        let sayi = parseInt(args[0]);
        if (!sayi || sayi < 1 || sayi > 110) return message.reply("❌ 1-110 arası bir sayı gir!");
        await message.channel.bulkDelete(sayi > 100 ? 100 : sayi, true);
        message.channel.send(`✅ **${sayi}** mesaj silindi.`).then(m => setTimeout(() => m.delete(), 5000));
    }

    if (command === 'hoşgeldin') {
        const kanal = message.mentions.channels.first();
        if (!kanal) return message.reply("❌ Bir kanal etiketle!");
        if (!botVerisi.kanallar[message.guild.id]) botVerisi.kanallar[message.guild.id] = {};
        botVerisi.kanallar[message.guild.id].hosgeldin = kanal.id;
        veriKaydet();
        message.reply(`✅ Hoş geldin kanalı ${kanal} yapıldı.`);
    }

    if (command === 'hoşçakal') {
        const kanal = message.mentions.channels.first();
        if (!kanal) return message.reply("❌ Bir kanal etiketle!");
        if (!botVerisi.kanallar[message.guild.id]) botVerisi.kanallar[message.guild.id] = {};
        botVerisi.kanallar[message.guild.id].hoscakal = kanal.id;
        veriKaydet();
        message.reply(`✅ Hoşça kal kanalı ${kanal} yapıldı.`);
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        const sebep = args.slice(1).join(" ") || "Sebep yok";
        if (!user) return message.reply("❌ Birini etiketle!");
        message.guild.members.ban(user, { reason: sebep });
        message.reply(`✅ ${user.tag} yasaklandı.`);
    }

    if (command === 'kick') {
        const user = message.mentions.users.first();
        if (!user) return message.reply("❌ Birini etiketle!");
        message.guild.members.kick(user);
        message.reply(`✅ ${user.tag} atıldı.`);
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const sure = parseInt(args[1]);
        if (!member || !sure) return message.reply("❌ `mem!mute @üye [dakika]`");
        await member.timeout(sure * 60 * 1000);
        message.reply(`✅ ${member.user.tag} ${sure} dakika susturuldu.`);
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
        message.reply(`✅ AFK: **${sebep}**`);
    }
});

client.login(process.env.TOKEN);

