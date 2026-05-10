const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('TPD & MEM Süper Bot Aktif!'));
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

// --- VERİ TABANI SİSTEMİ ---
let botVerisi = { 
    afk: {}, 
    yetkiliRoller: [], 
    sayi: {}, 
    tuttu: {}, 
    kelime: {},
    ticketCount: 0,
    sunucuAyarlar: {} 
};

// Verileri tek bir dosyadan okuyalım
if (fs.existsSync('./database.json')) {
    try { 
        botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); 
    } catch (e) { 
        console.log("Veri dosyası yeni oluşturuluyor."); 
    }
}

function veriKaydet() { 
    fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); 
}

client.on('ready', () => { 
    console.log(`${client.user.tag} Tüm sistemler (Ticket, Oyun, Moderasyon) aktif edildi!`); 
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK SİSTEMİ ---
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

    // --- OYUN MANTIKLARI ---
    // 1. Sayı Saymaca
    if (botVerisi.sayi?.[message.channel.id]) {
        const data = botVerisi.sayi[message.channel.id];
        const girilenSayi = parseInt(message.content);
        if (!isNaN(girilenSayi)) {
            if (girilenSayi !== data.sonSayi + 1) {
                message.delete();
                return message.channel.send(`❌ Yanlış sayı! Sıradaki: **${data.sonSayi + 1}**`).then(m => setTimeout(() => m.delete(), 3000));
            }
            if (message.author.id === data.sonKullanici) {
                message.delete();
                return message.channel.send(`🚫 Üst üste sayamazsın!`).then(m => setTimeout(() => m.delete(), 3000));
            }
            data.sonSayi = girilenSayi;
            data.sonKullanici = message.author.id;
            message.react('✅');
            veriKaydet();
            return;
        }
    }

    // 2. Tuttu-Tutmadı
    if (botVerisi.tuttu?.[message.channel.id]) {
        const msg = message.content.toLowerCase();
        if (msg.startsWith("tuttu") || msg.startsWith("tutmadı")) {
            message.react('🆗');
        } else {
            message.delete();
            return message.channel.send(`⚠️ Mesajın **Tuttu** veya **Tutmadı** ile başlamalı!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    // 3. Kelime Oyunu (TDK Kontrollü)
    if (botVerisi.kelime?.[message.channel.id]) {
        const data = botVerisi.kelime[message.channel.id];
        const kelime = message.content.trim().toLowerCase();
        if (message.author.id === data.sonKullanici) { message.delete(); return; }
        if (data.sonKelime !== "" && kelime[0] !== data.sonKelime.slice(-1)) {
            message.delete();
            return message.channel.send(`❌ Kelime **"${data.sonKelime.slice(-1)}"** ile başlamalı!`).then(m => setTimeout(() => m.delete(), 3000));
        }
        try {
            const res = await axios.get(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(kelime)}`);
            if (res.data.error || !res.data[0]) {
                message.delete();
                return message.channel.send(`❌ **"${kelime}"** TDK'da yok!`).then(m => setTimeout(() => m.delete(), 3000));
            }
            data.sonKelime = kelime;
            data.sonKullanici = message.author.id;
            message.react('📝');
            veriKaydet();
        } catch (e) {}
        return;
    }

    // --- KOMUTLAR ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;

    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. TICKET KURULUM (/setup)
    if (command === 'setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const filter = m => m.author.id === message.author.id;
        try {
            message.channel.send('1️⃣ **Panel kanalı?** (#etiketle)');
            const c1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const kanal = c1.first().mentions.channels.first();

            message.channel.send('2️⃣ **Ticket Yetkili rolleri?** (@etiketle)');
            const c2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const roller = c2.first().mentions.roles.map(r => r.id);

            message.channel.send('3️⃣ **Log kanalı?** (#etiketle)');
            const c3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const logKanal = c3.first().mentions.channels.first();

            botVerisi.sunucuAyarlar[message.guild.id] = { panelID: kanal.id, ticketRoller: roller, logID: logKanal.id };
            veriKaydet();

            const embed = new EmbedBuilder().setTitle('Destek Sistemi').setDescription('Kategori seçerek bilet açabilirsiniz.').setColor('Red');
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Kategori seç...').addOptions([
                    { label: 'Şikayet', value: 'Şikayet', emoji: '📝' },
                    { label: 'Öneri', value: '💡', emoji: '💡' },
                    { label: 'Yetkililerle İletişim', value: 'İletişim', emoji: '👑' }
                ])
            );
            await kanal.send({ embeds: [embed], components: [row] });
            message.reply('✅ Bilet sistemi kuruldu!');
        } catch (e) { message.reply('⚠️ Süre doldu veya hata oluştu.'); }
    }

    // 2. MODERASYON & OYUN SETUP
    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller.includes(role.id));
    };

    if (command === 'yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roller = message.mentions.roles;
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply(`✅ Moderasyon yetkilileri güncellendi.`);
    }

    // Oyun Başlatma Komutları
    if (['sayısaymaca', 'tuttututmadı', 'kelimeoyunu'].includes(command)) {
        if (!yetkiliMi()) return;
        const kanal = message.mentions.channels.first();
        if (!kanal) return message.reply("Kanal etiketle!");
        if (command === 'sayısaymaca') botVerisi.sayi[kanal.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'tuttututmadı') botVerisi.tuttu[kanal.id] = true;
        if (command === 'kelimeoyunu') botVerisi.kelime[kanal.id] = { sonKelime: "", sonKullanici: null };
        veriKaydet();
        return message.reply(`✅ Oyun ${kanal} kanalında başladı.`);
    }

    // Moderasyon Komutları (Ban, Kick, Sil vb.)
    if (command === 'sil') {
        if (!yetkiliMi()) return;
        let sayi = parseInt(args[0]);
        if (sayi > 0 && sayi <= 100) await message.channel.bulkDelete(sayi, true);
    }

    if (command === 'afk') {
        botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul";
        veriKaydet();
        message.reply(`✅ AFK modundasın.`);
    }

    // mem!owner
    if (command === 'owner') {
        const owner = await message.guild.fetchOwner();
        message.reply(`👑 Sunucu Sahibi: **${owner.user.tag}**`);
    }

    // mem!sorgula (ROBLOX)
    if (command === 'sorgula') {
        const robloxName = args[0];
        if (!robloxName) return message.reply("İsim gir!");
        try {
            const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', { usernames: [robloxName] });
            const userId = userRes.data.data[0].id;
            const groupsRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
            const embed = new EmbedBuilder()
                .setTitle(`${robloxName} Grupları`)
                .setDescription(groupsRes.data.data.map(g => `**${g.group.name}** - \`${g.role.name}\``).join('\n'))
                .setColor('Blue');
            message.reply({ embeds: [embed] });
        } catch (e) { message.reply("Hata!"); }
    }
});

// --- INTERACTION HANDLING (Ticket Butonları) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const ayar = botVerisi.sunucuAyarlar[interaction.guild.id];
        botVerisi.ticketCount++;
        veriKaydet();
        const kanal = await interaction.guild.channels.create({
            name: `ticket-${botVerisi.ticketCount}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.ticketRoller.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_kapat').setLabel('Kapat').setStyle(ButtonStyle.Danger));
        await kanal.send({ content: `Bilet Kategorisi: ${interaction.values[0]}`, components: [btn] });
        await interaction.reply({ content: `Bilet açıldı: ${kanal}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'tk_kapat') {
        const ayar = botVerisi.sunucuAyarlar[interaction.guild.id];
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let log = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
        const file = new AttachmentBuilder(Buffer.from(log), { name: 'transcript.txt' });
        const logKanal = interaction.guild.channels.cache.get(ayar.logID);
        if (logKanal) logKanal.send({ content: `Bilet Kapatıldı: ${interaction.channel.name}`, files: [file] });
        await interaction.reply("Bilet siliniyor...");
        setTimeout(() => interaction.channel.delete(), 3000);
    }
});

client.login(process.env.TOKEN);

