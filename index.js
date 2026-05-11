const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [], sayi: {}, tuttu: {}, kelime: {}, ticketCount: 0, sunucuAyarlar: {} };

if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} Yetki Sistemi Güncellendi!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK SİSTEMİ (Herkes Kullanabilir) ---
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

    // --- OYUN MANTIKLARI (Sayı, Kelime, Tuttu) ---
    // (Burada mevcut oyun kontrollerin yer alıyor...)

    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;

    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- YETKİ KONTROLÜ (Yönetici Veya Seçilmiş Rol) ---
    const yetkiliKontrol = message.member.permissions.has(PermissionFlagsBits.Administrator) || 
                          message.member.roles.cache.some(r => botVerisi.yetkiliRoller.includes(r.id));

    // 1. GENEL KOMUTLAR (Yetki İstemez)
    if (command === 'owner' || command === 'avatar' || command === 'afk') {
        // ... (Bu komutların kodları)
        if(command === 'afk') {
            botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul";
            veriKaydet();
            return message.reply("✅ AFK moduna girdin.");
        }
    }

    // 2. YÖNETİCİ VEYA SEÇİLMİŞ YETKİLİ KOMUTLARI
    if (!yetkiliKontrol) return; // Yetkili değilse aşağıdakileri çalıştırma!

    // Eğlence Kanallarını Ayarlama (Artık Yetkiliye Bağlı)
    if (['sayısaymaca', 'tuttututmadı', 'kelimeoyunu'].includes(command)) {
        const kanal = message.mentions.channels.first();
        if (!kanal) return message.reply("❌ Bir kanal etiketlemelisin!");
        
        if (command === 'sayısaymaca') botVerisi.sayi[kanal.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'tuttututmadı') botVerisi.tuttu[kanal.id] = true;
        if (command === 'kelimeoyunu') botVerisi.kelime[kanal.id] = { sonKelime: "", sonKullanici: null };
        
        veriKaydet();
        return message.reply(`✅ ${command} oyunu ${kanal} kanalında başarıyla kuruldu!`);
    }

    // Moderasyon Komutları
    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Rolleri etiketle!");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply(`✅ Yetkili rolleri güncellendi.`);
    }

    if (command === 'sil') {
        let sayi = parseInt(args[0]);
        if (sayi > 0 && sayi <= 100) await message.channel.bulkDelete(sayi, true);
    }
    
    // ... ban, kick, mute, lock vb. komutlar buraya gelecek ...
});

client.login(process.env.TOKEN);

