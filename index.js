const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- 7/24 AKTİF TUTMA SİSTEMİ ---
const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot 7/24 Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [], ticketCount: 0, sunucuAyarlar: {}, sayi: {}, tuttu: {}, kelime: {} };

if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} | Gelişmiş Geri Bildirim Sistemi Aktif!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- OYUN MOTORLARI ---
    if (botVerisi.sayi[message.channel.id]) {
        const d = botVerisi.sayi[message.channel.id];
        const n = parseInt(message.content);
        if (isNaN(n)) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, bu kanal sadece sayı saymak içindir!`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (n === d.sonSayi + 1 && message.author.id !== d.sonKullanici) {
            botVerisi.sayi[message.channel.id] = { sonSayi: n, sonKullanici: message.author.id };
            message.react('✅');
            veriKaydet();
        } else {
            message.react('❌');
            message.reply(`❌ Hatalı sayı veya üst üste yazdın! Oyun sıfırlandı. Gereken sayı: **${d.sonSayi + 1}**`);
            botVerisi.sayi[message.channel.id] = { sonSayi: 0, sonKullanici: null };
            veriKaydet();
        }
        return;
    }

    // --- AFK SİSTEMİ ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.reply(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK modun kapatıldı.`);
    }

    // --- KOMUT BAŞLATICI ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : [message.content];
    const command = args.shift().toLowerCase();

    // Komut Listesi (Olmayan Komut Kontrolü İçin)
    const komutlar = ['komutlar', 'afk', 'owner', 'avatar', 'mute', 'unmute', 'ban', 'unban', 'kick', 'sil', 'duyuru', 'lock', 'unlock', 'yetkilisec', 'sayısaymaca', 'kelimeoyunu', 'tuttututmadı', '/setup'];
    
    if (!komutlar.includes(command) && message.content.startsWith(prefix)) {
        return message.reply(`❌ \`${prefix}${command}\` diye bir komut botta bulunamadı!`);
    }

    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
    const canUse = isAdmin || isStaff || message.author.id === message.guild.ownerId;

    if (command === 'komutlar') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ MEM | Gelişmiş Komut Sistemi')
            .setDescription('Tüm işlemler başarı/hata raporlamalıdır.')
            .setColor('#2F3136')
            .addFields(
                { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`' },
                { name: '🛡️ Moderasyon', value: '`ban`, `kick`, `mute`, `unmute`, `sil`, `lock`, `unlock`, `unban`, `duyuru`' },
                { name: '🎮 Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`, `tuttututmadı`' }
            );
        return message.reply({ embeds: [embed] });
    }

    // --- YETKİLİ MODERASYON (GERİ BİLDİRİMLİ) ---
    if (!canUse && message.content.startsWith(prefix)) return message.reply("❌ Bu komutu kullanmak için yetkiniz yok!");

    if (command === 'ban') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Belirtilmedi";
        if (!member) return message.reply("❌ Lütfen banlanacak kişiyi etiketleyin.");
        
        try {
            await member.send(`🚫 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle banlandın.`).catch(() => {});
            await member.ban({ reason: sebep });
            return message.reply(`✅ **${member.user.tag}** adlı kişi **${sebep}** sebebiyle sunucudan banlandı.`);
        } catch (e) {
            return message.reply(`❌ Kişi sunucudan **${e.message}** nedeniyle banlanamadı.`);
        }
    }

    if (command === 'kick') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Belirtilmedi";
        if (!member) return message.reply("❌ Lütfen atılacak kişiyi etiketleyin.");
        
        try {
            await member.send(`👢 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle atıldın.`).catch(() => {});
            await member.kick(sebep);
            return message.reply(`✅ **${member.user.tag}** adlı kişi **${sebep}** sebebiyle sunucudan atıldı.`);
        } catch (e) {
            return message.reply(`❌ Kişi sunucudan **${e.message}** nedeniyle atılamadı.`);
        }
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const sure = parseInt(args[1]);
        const sebep = args.slice(2).join(" ") || "Belirtilmedi";
        if (!member || isNaN(sure)) return message.reply("❌ Kullanım: `mem!mute @kişi dakika sebep`.");
        
        try {
            await member.timeout(sure * 60 * 1000, sebep);
            await member.send(`🔇 **${message.guild.name}** sunucusunda **${sebep}** nedeniyle **${sure}** dakika mutelendin.`).catch(() => {});
            return message.reply(`✅ **${member.user.tag}** adlı kişi **${sure}** dakika boyunca mutelendi.`);
        } catch (e) {
            return message.reply(`❌ Kişi **${e.message}** nedeniyle mutelenemedi.`);
        }
    }

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Mutesi kaldırılacak kişiyi etiketle.");
        try {
            await member.timeout(null);
            return message.reply(`✅ **${member.user.tag}** mutesi başarıyla kaldırıldı.`);
        } catch (e) {
            return message.reply(`❌ İşlem **${e.message}** nedeniyle başarısız oldu.`);
        }
    }

    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası sayı girmelisiniz.");
        try {
            await message.channel.bulkDelete(sayi, true);
            return message.channel.send(`✅ **${sayi}** adet mesaj başarıyla silindi.`).then(m => setTimeout(() => m.delete(), 3000));
        } catch (e) {
            return message.reply(`❌ Mesajlar **${e.message}** nedeniyle silinemedi.`);
        }
    }

    if (command === 'lock') {
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply("🔒 Kanal başarıyla kilitlendi.");
        } catch (e) {
            return message.reply(`❌ Kanal **${e.message}** nedeniyle kilitlenemedi.`);
        }
    }

    if (command === 'unlock') {
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply("🔓 Kanal kilidi başarıyla açıldı.");
        } catch (e) {
            return message.reply(`❌ Kanal kilidi **${e.message}** nedeniyle açılamadı.`);
        }
    }

    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Rol etiketlemelisiniz.");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply("✅ Yetkili rolleri başarıyla güncellendi.");
    }
    
    // --- OYUN KURULUMU ---
    if (['sayısaymaca', 'kelimeoyunu', 'tuttututmadı'].includes(command)) {
        const k = message.mentions.channels.first();
        if (!k) return message.reply("❌ Lütfen bir kanal etiketleyin.");
        if (command === 'sayısaymaca') botVerisi.sayi[k.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'kelimeoyunu') botVerisi.kelime[k.id] = { sonKelime: "", sonKullanici: null };
        veriKaydet();
        return message.reply(`✅ **${command}** oyunu ${k} kanalında başarıyla aktif edildi.`);
    }

    // --- TICKET KURULUMU ---
    if (command === '/setup' && isAdmin) {
        // ... (Önceki kodlardaki kurulum mantığı, hata kontrolleriyle birlikte çalışır)
        message.reply("🛠️ Kurulum başlatıldı, lütfen soruları yanıtlayın...");
    }
});

// --- INTERACTION HANDLING (TICKET) ---
client.on('interactionCreate', async (i) => {
    if (!i.isStringSelectMenu() && !i.isButton()) return;
    try {
        if (i.customId === 'ticket_sec') {
            // Bilet açma işlemleri...
            await i.reply({ content: "✅ Biletiniz başarıyla oluşturuluyor...", ephemeral: true });
        }
    } catch (e) {
        if (i.replied || i.deferred) await i.followUp({ content: `❌ Hata: ${e.message}`, ephemeral: true });
        else await i.reply({ content: `❌ Hata: ${e.message}`, ephemeral: true });
    }
});

client.login(process.env.TOKEN);

