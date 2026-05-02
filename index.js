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

    // AFK Sistemi
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

    if (!message.content.startsWith(prefix) && !message.content.startsWith('/yetkilisec')) return;
    
    const args = message.content.startsWith(prefix) 
        ? message.content.slice(prefix.length).trim().split(/ +/)
        : message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller.includes(role.id));
    };

    if (command === 'yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Lütfen yetkili olacak rolleri etiketleyin!");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        const isimler = roller.map(r => r.name).join(", ");
        return message.reply(`✅ Yetkili rolleri güncellendi: **${isimler}**`);
    }

    if (command !== 'afk' && !yetkiliMi()) {
        return message.reply("❌ Sen bu sunucuda yetkili değilsin ve yetkili komutlarını kullanamazsın!");
    }

    // --- GELİŞMİŞ LOCK (KİLİT) KOMUTU ---
    if (command === 'lock') {
        try {
            // Herkesin yazmasını kapat
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            
            // Seçilen yetkili rollere yazma izni ver
            if (botVerisi.yetkiliRoller.length > 0) {
                for (const rolId of botVerisi.yetkiliRoller) {
                    const rol = message.guild.roles.cache.get(rolId);
                    if (rol) {
                        await message.channel.permissionOverwrites.edit(rol, { SendMessages: true });
                    }
                }
            }
            message.reply("🔒 Kanal kilitlendi. Sadece yetkililer mesaj gönderebilir.");
        } catch (e) {
            message.reply("❌ Kanal kilitlenirken bir hata oluştu.");
        }
    }

    if (command === 'unlock') {
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            // Yetkililerin özel izinlerini de sıfırla (isteğe bağlı, null yapmak kanalı varsayılana döndürür)
            message.reply("🔓 Kanal kilidi açıldı. Herkes tekrar mesaj gönderebilir.");
        } catch (e) {
            message.reply("❌ Kanal açılırken bir hata oluştu.");
        }
    }

    // --- DUYURU ---
    if (command === 'duyuru') {
        const kanal = message.mentions.channels.first();
        const duyuruMesaji = args.slice(1).join(" ");
        if (!kanal || !duyuruMesaji) return message.reply("❌ Kullanım: `mem!duyuru #kanal Mesaj` ");
        const embed = new EmbedBuilder().setTitle('📢 Duyuru').setDescription(duyuruMesaji).setColor('#ff0000').setTimestamp();
        await kanal.send({ embeds: [embed] });
        message.reply("✅ Duyuru gönderildi.");
    }

    // --- MODERASYON ---
    if (command === 'rolver') {
        const member = message.mentions.members.first();
        const rol = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === args.slice(1).join(" "));
        if (member && rol) { try { await member.roles.add(rol); message.reply(`✅ Rol verildi.`); } catch(e) { message.reply("❌ Yetki hatası."); } }
    }

    if (command === 'rolal') {
        const member = message.mentions.members.first();
        const rol = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === args.slice(1).join(" "));
        if (member && rol) { try { await member.roles.remove(rol); message.reply(`✅ Rol alındı.`); } catch(e) { message.reply("❌ Yetki hatası."); } }
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const dakika = parseInt(args[1]);
        if (member && dakika) { try { await member.timeout(dakika * 60 * 1000); message.reply(`✅ Susturuldu.`); } catch(e) { message.reply("❌ Yetki hatası."); } }
    }

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (member) { await member.timeout(null); message.reply(`✅ Mute açıldı.`); }
    }

    if (command === 'unban') {
        try { await message.guild.members.unban(args[0]); message.reply(`✅ Ban açıldı.`); } catch(e) { message.reply("❌ Hata."); }
    }

    if (command === 'sil') {
        let sayi = parseInt(args[0]);
        if (sayi > 0 && sayi <= 100) await message.channel.bulkDelete(sayi, true);
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        try { await message.guild.members.ban(user); message.reply(`✅ Yasaklandı.`); } catch(e) { message.reply("❌ Hata."); }
    }

    if (command === 'kick') {
        const user = message.mentions.users.first();
        try { await message.guild.members.kick(user); message.reply(`✅ Atıldı.`); } catch(e) { message.reply("❌ Hata."); }
    }

    if (command === 'afk') {
        botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul";
        veriKaydet();
        message.reply(`✅ AFK modundasın.`);
    }
});

client.login(process.env.TOKEN);
