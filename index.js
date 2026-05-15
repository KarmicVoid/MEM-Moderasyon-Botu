const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- 7/24 AKTİF TUTMA SİSTEMİ ---
const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [], ticketCount: 0, sunucuAyarlar: {}, sayi: {}, tuttu: {}, kelime: {}, uyarilar: {} };

// Veritabanı Yükleme
if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası yüklenemedi, yeni oluşturuluyor."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} | Tüm Sistemler (Warn, Role, Game, Ticket) Aktif!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- 1. OYUN MOTORLARI VE KORUMA (Komutlardan Önce Çalışır) ---
    if (botVerisi.sayi[message.channel.id]) {
        const d = botVerisi.sayi[message.channel.id];
        const n = parseInt(message.content);
        if (isNaN(n)) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, burası sayı sayma kanalı!`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (n === d.sonSayi + 1 && message.author.id !== d.sonKullanici) {
            botVerisi.sayi[message.channel.id] = { sonSayi: n, sonKullanici: message.author.id };
            return message.react('✅');
        } else {
            message.reply(`❌ Hatalı sayı veya üst üste yazdın! Oyun sıfırlandı. Sıradaki: **1**`);
            botVerisi.sayi[message.channel.id] = { sonSayi: 0, sonKullanici: null };
            return veriKaydet();
        }
    }

    if (botVerisi.kelime[message.channel.id]) {
        const d = botVerisi.kelime[message.channel.id];
        const kelime = message.content.toLowerCase().trim();
        if (message.content.includes(" ")) {
            await message.delete();
            return message.channel.send(`⚠️ Tek kelime yazmalısın!`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (!d.sonKelime || (kelime.startsWith(d.sonKelime.slice(-1)) && message.author.id !== d.sonKullanici)) {
            botVerisi.kelime[message.channel.id] = { sonKelime: kelime, sonKullanici: message.author.id };
            return message.react('📝');
        } else {
            return message.reply(`❌ **${d.sonKelime.slice(-1).toUpperCase()}** ile başlamalısın!`);
        }
    }

    // --- 2. AFK SİSTEMİ ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.reply(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        return message.reply(`👋 Hoş geldin, AFK modun kapatıldı.`);
    }

    // --- 3. KOMUT BAŞLATICI ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : [message.content];
    const command = args.shift().toLowerCase();

    // Komut Listesi Kontrolü
    const tumKomutlar = ['komutlar', 'afk', 'owner', 'avatar', 'mute', 'unmute', 'ban', 'unban', 'kick', 'sil', 'duyuru', 'lock', 'unlock', 'yetkilisec', 'sayısaymaca', 'kelimeoyunu', 'tuttututmadı', 'uyarı', 'rolver', 'rolal', '/setup'];
    if (!tumKomutlar.includes(command) && message.content.startsWith(prefix)) {
        return message.reply(`❌ \`${prefix}${command}\` diye bir komut bulunamadı.`);
    }

    const canUse = message.member.permissions.has(PermissionFlagsBits.Administrator) || botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));

    // --- 4. GENEL KOMUTLAR ---
    if (command === 'komutlar') {
        const emb = new EmbedBuilder()
            .setTitle('🛡️ MEM Bot | Tam Sistem Paneli')
            .setColor('#2F3136')
            .addFields(
                { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`' },
                { name: '🛡️ Moderasyon', value: '`ban`, `kick`, `mute`, `unmute`, `uyarı`, `sil`, `lock`, `unlock`, `duyuru`' },
                { name: '🎭 Rol Yönetimi', value: '`rolver`, `rolal`' },
                { name: '🎮 Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`, `tuttututmadı`' },
                { name: '🎫 Destek', value: '`/setup`' }
            );
        return message.reply({ embeds: [emb] });
    }

    // --- 5. YETKİLİ KOMUTLARI ---
    if (!canUse && message.content.startsWith(prefix)) return message.reply("❌ Yetkiniz yetersiz.");

    // UYARI SİSTEMİ
    if (command === 'uyarı') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Birini etiketle.");

        if (!botVerisi.uyarilar[member.id]) botVerisi.uyarilar[member.id] = [];
        botVerisi.uyarilar[member.id].push({ sebep, yetkili: message.author.tag });
        const sayi = botVerisi.uyarilar[member.id].length;
        veriKaydet();

        const emb = new EmbedBuilder()
            .setTitle('⚠️ Uyarı Kaydı')
            .setColor('Orange')
            .addFields(
                { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
                { name: 'Sıra', value: `${sayi}. Uyarı`, inline: true },
                { name: 'Sebep', value: sebep }
            );
        await member.send({ embeds: [emb] }).catch(() => {});
        return message.reply({ content: `✅ **${member.user.tag}** uyarıldı.`, embeds: [emb] });
    }

    // ROL VER / AL
    if (command === 'rolver') {
        const member = message.mentions.members.first();
        const rolInput = args.slice(1).join(" ");
        const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolInput);
        if (!member || !role) return message.reply("❌ Kullanıcı ve rol belirt.");
        try {
            await member.roles.add(role);
            return message.reply(`✅ **${member.user.tag}** kişisine **${role.name}** rolü verildi.`);
        } catch (e) { return message.reply(`❌ Rol verilemedi: ${e.message}`); }
    }

    if (command === 'rolal') {
        const member = message.mentions.members.first();
        const rolInput = args.slice(1).join(" ");
        const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolInput);
        if (!member || !role) return message.reply("❌ Kullanıcı ve rol belirt.");
        try {
            await member.roles.remove(role);
            return message.reply(`✅ **${member.user.tag}** kişisinden **${role.name}** rolü alındı.`);
        } catch (e) { return message.reply(`❌ Rol alınamadı: ${e.message}`); }
    }

    // BAN & KICK (DM BİLDİRİMLİ)
    if (command === 'ban') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Belirtilmedi";
        if (!member) return message.reply("❌ Kişi etiketle.");
        try {
            await member.send(`🚫 **${message.guild.name}** sunucusundan yasaklandın. Sebep: ${sebep}`).catch(() => {});
            await member.ban({ reason: sebep });
            return message.reply(`✅ **${member.user.tag}**, **${sebep}** nedeniyle banlandı.`);
        } catch (e) { return message.reply(`❌ Başarısız: ${e.message}`); }
    }

    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası sayı gir.");
        await message.channel.bulkDelete(sayi, true);
        return message.channel.send(`✅ ${sayi} mesaj silindi.`).then(m => setTimeout(() => m.delete(), 3000));
    }

    // TICKET SETUP
    if (command === '/setup' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const filter = m => m.author.id === message.author.id;
        try {
            message.reply("🎫 Kurulum başladı. Kanalı etiketle:");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 20000 });
            const sKanal = q1.first().mentions.channels.first();
            
            message.reply("🎫 Yetkili rollerini etiketle:");
            const q2 = await message.channel.awaitMessages({ filter, max: 1, time: 20000 });
            const sRoller = q2.first().mentions.roles.map(r => r.id);

            botVerisi.sunucuAyarlar[message.guild.id] = { ticketRoller: sRoller };
            veriKaydet();

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_sec').setPlaceholder('Kategori Seçin').addOptions([
                    { label: 'Destek Bilet', value: 'destek' },
                    { label: 'Şikayet', value: 'sikayet' }
                ])
            );
            await sKanal.send({ content: "**Destek Paneli**", components: [row] });
            return message.reply("✅ Ticket sistemi kuruldu.");
        } catch (e) { return message.reply("❌ Kurulum iptal."); }
    }

    // OYUN KURULUMU
    if (['sayısaymaca', 'kelimeoyunu'].includes(command)) {
        const k = message.mentions.channels.first();
        if (!k) return message.reply("❌ Kanal etiketle.");
        if (command === 'sayısaymaca') botVerisi.sayi[k.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'kelimeoyunu') botVerisi.kelime[k.id] = { sonKelime: "", sonKullanici: null };
        veriKaydet();
        return message.reply(`✅ **${command}** kanalı ayarlandı.`);
    }
});

// --- 6. ETKİLEŞİMLER (TICKET) ---
client.on('interactionCreate', async (i) => {
    if (i.isStringSelectMenu() && i.customId === 'ticket_sec') {
        const ayar = botVerisi.sunucuAyarlar[i.guild.id];
        botVerisi.ticketCount++;
        const ch = await i.guild.channels.create({
            name: `ticket-${botVerisi.ticketCount}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.ticketRoller.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_kapat').setLabel('Kapat').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `${i.user}, biletin açıldı.`, components: [btn] });
        await i.reply({ content: `Bilet: ${ch}`, ephemeral: true });
    }
    if (i.isButton() && i.customId === 'tk_kapat') {
        await i.channel.delete();
    }
});

client.login(process.env.TOKEN);
