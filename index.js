const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

// --- EXPRESS SERVER (Render 7/24 Aktif Tutma) ---
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

// --- VERİ TABANI ---
let botVerisi = { 
    afk: {}, 
    yetkiliRoller: [], 
    sayi: {}, 
    tuttu: {}, 
    kelime: {},
    ticketCount: 0,
    sunucuAyarlar: {} 
};

if (fs.existsSync('./database.json')) {
    try { 
        botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); 
    } catch (e) { 
        console.log("Veri dosyası hatası, yeni dosya oluşturulacak."); 
    }
}

function veriKaydet() { 
    fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); 
}

client.on('ready', () => { 
    console.log(`${client.user.tag} Tüm sistemler (Bilet, Oyun, Moderasyon) aktif!`); 
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
    if (botVerisi.sayi[message.channel.id]) {
        const data = botVerisi.sayi[message.channel.id];
        const girilenSayi = parseInt(message.content);
        if (!isNaN(girilenSayi)) {
            if (girilenSayi !== data.sonSayi + 1 || message.author.id === data.sonKullanici) {
                message.delete();
            } else {
                data.sonSayi = girilenSayi;
                data.sonKullanici = message.author.id;
                message.react('✅');
                veriKaydet();
            }
            return;
        }
    }

    // 2. Tuttu-Tutmadı
    if (botVerisi.tuttu[message.channel.id]) {
        const msg = message.content.toLowerCase();
        if (msg.startsWith("tuttu") || msg.startsWith("tutmadı")) {
            message.react('🆗');
        } else {
            message.delete();
            return message.channel.send(`⚠️ Mesajın **Tuttu** veya **Tutmadı** ile başlamalı!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    // 3. Kelime Oyunu (TDK Kontrollü)
    if (botVerisi.kelime[message.channel.id]) {
        const data = botVerisi.kelime[message.channel.id];
        const kelime = message.content.trim().toLowerCase();
        if (message.author.id === data.sonKullanici) { message.delete(); return; }
        if (data.sonKelime !== "" && kelime[0] !== data.sonKelime.slice(-1)) {
            message.delete();
            return message.channel.send(`❌ Kelime **"${data.sonKelime.slice(-1)}"** harfiyle başlamalı!`).then(m => setTimeout(() => m.delete(), 3000));
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

    // --- YETKİ KONTROLÜ ---
    const isStaff = message.member.permissions.has(PermissionFlagsBits.Administrator) || 
                    message.member.roles.cache.some(r => botVerisi.yetkiliRoller.includes(r.id));

    // --- HERKESİN KULLANABİLECEĞİ KOMUTLAR ---
    if (command === 'komutlar') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ MEM | Komut Listesi')
            .setDescription('Botun tüm özellikleri aşağıdadır.')
            .setColor('#2F3136')
            .addFields(
                { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`', inline: true },
                { name: '🎫 Bilet', value: '`/setup` (Admin Özel)', inline: true },
                { name: '🛡️ Moderasyon', value: '`ban`, `kick`, `mute`, `unmute`, `sil`, `lock`, `unlock`, `duyuru`, `yetkilisec`', inline: false },
                { name: '🎮 Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`, `tuttututmadı`', inline: true }
            )
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    if (command === 'owner') {
        const owner = await message.guild.fetchOwner();
        return message.reply(`👑 Sunucu Sahibi: **${owner.user.tag}**`);
    }

    if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        return message.reply(user.displayAvatarURL({ dynamic: true, size: 1024 }));
    }

    if (command === 'afk') {
        botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul";
        veriKaydet();
        return message.reply("✅ Artık AFK modundasın.");
    }

    // --- YÖNETİCİ VE YETKİLİ KOMUTLARI ---
    if (!isStaff) return;

    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Lütfen yetkili rolleri etiketleyin!");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply(`✅ Yetkili rolleri başarıyla güncellendi.`);
    }

    if (command === 'setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const filter = m => m.author.id === message.author.id;
        try {
            message.channel.send('1️⃣ **Panel kanalı?** (#etiketle)');
            const c1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const kanal = c1.first().mentions.channels.first();

            message.channel.send('2️⃣ **Bilet Yetkili rolleri?** (@etiketle - Çoklu olabilir)');
            const c2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const ticketRolleri = c2.first().mentions.roles.map(r => r.id);

            message.channel.send('3️⃣ **Log kanalı?** (#etiketle)');
            const c3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const logKanal = c3.first().mentions.channels.first();

            botVerisi.sunucuAyarlar[message.guild.id] = { panelID: kanal.id, ticketRoller: ticketRolleri, logID: logKanal.id };
            veriKaydet();

            const embed = new EmbedBuilder()
                .setTitle('MEM | Destek Sistemi')
                .setDescription('Kategori seçerek bilet açabilirsiniz.')
                .setColor('#FF0000');
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Kategori seçiniz...').addOptions([
                    { label: 'Şikayet / Geri Bildirim', value: 'Şikayet', emoji: '📝' },
                    { label: 'Öneri / İstek', value: 'Öneri', emoji: '💡' },
                    { label: 'Partnerlik', value: 'Partnerlik', emoji: '🤝' },
                    { label: 'Yetkililerle İletişim', value: 'İletişim', emoji: '👑' }
                ])
            );
            await kanal.send({ embeds: [embed], components: [row] });
            message.reply('✅ Bilet sistemi kuruldu!');
        } catch (e) { message.reply('❌ Hata oluştu.'); }
    }

    if (command === 'sil') {
        let sayi = parseInt(args[0]);
        if (sayi > 0 && sayi <= 100) {
            await message.channel.bulkDelete(sayi, true);
            return message.channel.send(`✅ ${sayi} mesaj silindi.`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        if (user) {
            await message.guild.members.ban(user);
            message.reply("✅ Yasaklandı.");
        }
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const dak = parseInt(args[1]) || 10;
        if (member) {
            await member.timeout(dak * 60 * 1000);
            message.reply(`✅ ${dak} dakika susturuldu.`);
        }
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply("🔒 Kanal kilitlendi.");
    }

    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        message.reply("🔓 Kanal açıldı.");
    }

    // Oyun Kurulumları
    if (['sayısaymaca', 'tuttututmadı', 'kelimeoyunu'].includes(command)) {
        const kanal = message.mentions.channels.first();
        if (!kanal) return message.reply("❌ Kanal etiketle!");
        if (command === 'sayısaymaca') botVerisi.sayi[kanal.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'tuttututmadı') botVerisi.tuttu[kanal.id] = true;
        if (command === 'kelimeoyunu') botVerisi.kelime[kanal.id] = { sonKelime: "", sonKullanici: null };
        veriKaydet();
        return message.reply(`✅ ${command} başlatıldı.`);
    }
});

// --- INTERACTION (TICKET & BUTTONS) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const ayar = botVerisi.sunucuAyarlar[interaction.guild.id];
        if (!ayar) return;
        botVerisi.ticketCount++;
        veriKaydet();

        const pOverwrites = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ];
        ayar.ticketRoller.forEach(rID => {
            pOverwrites.push({ id: rID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        });

        const kanal = await interaction.guild.channels.create({
            name: `ticket-${botVerisi.ticketCount}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: pOverwrites
        });

        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_kapat').setLabel('Kapat').setStyle(ButtonStyle.Danger));
        await kanal.send({ content: `${interaction.user} Hoş geldin! Kategori: ${interaction.values[0]}`, components: [btn] });
        await interaction.reply({ content: `Bilet açıldı: ${kanal}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'tk_kapat') {
        const ayar = botVerisi.sunucuAyarlar[interaction.guild.id];
        const msgs = await interaction.channel.messages.fetch({ limit: 100 });
        const logStr = msgs.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
        const logKanal = interaction.guild.channels.cache.get(ayar.logID);
        if (logKanal) {
            const file = new AttachmentBuilder(Buffer.from(logStr), { name: 'transcript.txt' });
            logKanal.send({ content: `Bilet Kapatıldı: ${interaction.channel.name}`, files: [file] });
        }
        await interaction.reply("Bilet siliniyor...");
        setTimeout(() => interaction.channel.delete(), 3000);
    }
});

client.login(process.env.TOKEN);
