const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- 7/24 Aktif Tutma ---
const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot 7/24 Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [], ticketCount: 0, sunucuAyarlar: {} };

if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} Aktif ve Göreve Hazır!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK Kontrol ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.reply(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK bitti.`);
    }

    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : [message.content];
    const command = args.shift().toLowerCase();

    // --- Yetki Sistemi ---
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
    const canUse = isAdmin || isStaff || message.author.id === message.guild.ownerId;

    // --- Genel Komutlar ---
    if (command === 'afk') { botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul"; veriKaydet(); return message.reply("✅ AFK modundasın."); }

    // --- Moderasyon Komutları ---
    if (!canUse) return;

    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Rolleri etiketle!");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply(`✅ Yetkili rolleri güncellendi: ${roller.map(r => r.name).join(", ")}`);
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const sure = parseInt(args[1]);
        const sebep = args.slice(2).join(" ") || "Belirtilmedi";
        if (!member || !sure) return message.reply("❌ Kullanım: `mem!mute @kişi dakika sebep`.");
        await member.timeout(sure * 60 * 1000, sebep);
        await member.send(`🔇 **${message.guild.name}** sunucusunda **${sebep}** nedeniyle **${sure}** dakika mutelendin.`).catch(() => {});
        return message.reply(`✅ ${member} ${sure} dakika mutelendi.`);
    }

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Kimi?");
        await member.timeout(null);
        await member.send(`🔊 **${message.guild.name}** sunucusunda muten kaldırıldı.`).catch(() => {});
        return message.reply(`✅ ${member} mutesi kaldırıldı.`);
    }

    if (command === 'ban') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Belirtilmedi";
        if (!member) return message.reply("❌ Kimi?");
        await member.send(`🚫 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle banlandın.`).catch(() => {});
        await member.ban({ reason: sebep });
        return message.reply(`✅ ${member} yasaklandı.`);
    }

    if (command === 'kick') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Belirtilmedi";
        if (!member) return message.reply("❌ Kimi?");
        await member.send(`👢 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle atıldın.`).catch(() => {});
        await member.kick(sebep);
        return message.reply(`✅ ${member} atıldı.`);
    }

    if (command === 'unban') {
        const id = args[0];
        if (!id) return message.reply("❌ ID belirtmelisin.");
        await message.guild.members.unban(id);
        return message.reply(`✅ Yasak kaldırıldı.`);
    }

    if (command === 'duyuru') {
        const kanal = message.mentions.channels.first();
        const duyuruMesaji = args.slice(1).join(" ");
        if (!kanal || !duyuruMesaji) return message.reply("❌ Kullanım: `mem!duyuru #kanal mesaj`.");
        const embed = new EmbedBuilder().setTitle("📢 DUYURU").setDescription(duyuruMesaji).setColor("Blue").setTimestamp().setFooter({ text: message.guild.name });
        return kanal.send({ embeds: [embed] });
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply("🔒 Kanal kilitlendi. (Sadece yetkililer yazabilir)");
    }

    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply("🔓 Kanal kilidi açıldı.");
    }

    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası sayı gir.");
        await message.channel.bulkDelete(sayi, true);
        return message.channel.send(`✅ ${sayi} mesaj temizlendi.`).then(m => setTimeout(() => m.delete(), 3000));
    }

    // --- Ticket Setup (/setup) ---
    if (command === '/setup' && isAdmin) {
        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("1️⃣ Ticket sisteminin kurulacağı kanalı etiketle:");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const setupKanal = q1.first().mentions.channels.first();

            await message.reply("2️⃣ Ticket yetkili rollerini etiketle:");
            const q2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const yetkiliRoller = q2.first().mentions.roles.map(r => r.id);

            await message.reply("3️⃣ Transcript (Log) kanalını etiketle:");
            const q3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const logKanal = q3.first().mentions.channels.first();

            botVerisi.sunucuAyarlar[message.guild.id] = { yetkiliRoller, logKanal: logKanal.id };
            veriKaydet();

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_sec').setPlaceholder('Kategori Seç...').addOptions([
                    { label: 'Partner İletişim', value: 'partner' },
                    { label
