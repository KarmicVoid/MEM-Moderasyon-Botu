const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
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

// --- VERİ TABANI ---
let botVerisi = { 
    afk: {}, 
    yetkiliRoller: [], // Moderasyon yetkilileri
    sayi: {}, 
    tuttu: {}, 
    kelime: {},
    ticketCount: 0,
    sunucuAyarlar: {} 
};

if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası hatası."); }
}

function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} Gelişmiş Sistemler Aktif!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK Kontrolü ---
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

    // --- Oyun Mantıkları (Öncekiyle Aynı) ---
    // (Sayı Saymaca, Kelime Oyunu ve Tuttu-Tutmadı mantıkları burada yer alır...)

    // --- KOMUTLAR ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;

    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. Gelişmiş Çoklu Rol Destekli Moderasyon Yetkilisi Seçimi
    if (command === 'yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Lütfen en az bir yetkili rolü etiketleyin!");
        
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        
        const isimler = roller.map(r => r.name).join(", ");
        return message.reply(`✅ Moderasyon yetkili rolleri başarıyla güncellendi: **${isimler}**`);
    }

    // 2. Gelişmiş /setup Komutu (Çoklu Rol Destekli)
    if (command === 'setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const filter = m => m.author.id === message.author.id;
        try {
            await message.channel.send('1️⃣ **Panel kanalı?** (#etiketle)');
            const c1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const kanal = c1.first().mentions.channels.first();

            await message.channel.send('2️⃣ **Bilet Yetkili rolleri?** (İstediğiniz kadar rol etiketleyebilirsiniz)');
            const c2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const ticketRolleri = c2.first().mentions.roles.map(r => r.id);
            if (ticketRolleri.length === 0) return message.reply("❌ Hiç rol etiketlemediniz, işlem iptal.");

            await message.channel.send('3️⃣ **Log kanalı?** (#etiketle)');
            const c3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const logKanal = c3.first().mentions.channels.first();

            botVerisi.sunucuAyarlar[message.guild.id] = { 
                panelID: kanal.id, 
                ticketRoller: ticketRolleri, 
                logID: logKanal.id 
            };
            veriKaydet();

            const embed = new EmbedBuilder()
                .setTitle('MEM | Destek Sistemi')
                .setDescription('Sorun yaşadığınız kategoriyi seçerek bilet açabilirsiniz.\n\n⚠️ **Gereksiz ticket açmayın!**')
                .setColor('#FF0000')
                .setFooter({ text: 'MEM Ticket Sistemi' });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Kategori seçiniz...').addOptions([
                    { label: 'Şikayet / Geri Bildirim', value: 'Şikayet', emoji: '📝' },
                    { label: 'Öneri / İstek', value: 'Öneri', emoji: '💡' },
                    { label: 'Partnerlik', value: 'Partnerlik', emoji: '🤝' },
                    { label: 'Yetkililerle İletişim', value: 'İletişim', emoji: '👑' }
                ])
            );

            await kanal.send({ embeds: [embed], components: [row] });
            message.reply(`✅ Kurulum tamamlandı! Seçilen yetkili rol sayısı: **${ticketRolleri.length}**`);
        } catch (e) { message.reply('⚠️ İşlem zaman aşımına uğradı veya hata oluştu.'); }
    }

    // --- DİĞER MODERASYON KOMUTLARI ---
    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller.includes(role.id));
    };

    if (command === 'ban' && yetkiliMi()) { /* Ban mantığı */ }
    if (command === 'lock' && yetkiliMi()) {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        // Tüm seçili rollere izin ver
        for (const rId of botVerisi.yetkiliRoller) {
            const r = message.guild.roles.cache.get(rId);
            if (r) await message.channel.permissionOverwrites.edit(r, { SendMessages: true });
        }
        message.reply("🔒 Kanal yetkililer dışındakilere kilitlendi.");
    }
    // ... Diğer komutlar (kick, mute, sil, sorgula vb.) ...
});

// --- INTERACTION HANDLING ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const ayar = botVerisi.sunucuAyarlar[interaction.guild.id];
        if (!ayar) return;

        botVerisi.ticketCount++;
        veriKaydet();

        const permissionOverwrites = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ];

        // Kurulumda seçilen tüm rollere bilet kanalını görme izni ver
        ayar.ticketRoller.forEach(roleId => {
            permissionOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        });

        const kanal = await interaction.guild.channels.create({
            name: `ticket-${botVerisi.ticketCount}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: permissionOverwrites
        });

        const embed = new EmbedBuilder()
            .setTitle(`Bilet Açıldı | ${interaction.values[0]}`)
            .setDescription(`Hoş geldin ${interaction.user}, yetkililer kısa süre içinde burada olacaktır.`)
            .setColor('Red');

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_kapat').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await kanal.send({ content: `${interaction.user} | ${ayar.ticketRoller.map(r => `<@&${r}>`).join(' ')}`, embeds: [embed], components: [btn] });
        await interaction.reply({ content: `Biletiniz açıldı: ${kanal}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'tk_kapat') {
        // Transcript ve silme mantığı (Aynı kalıyor)
        await interaction.reply("🚀 Bilet sonlandırılıyor...");
        setTimeout(() => interaction.channel.delete(), 3000);
    }
});

client.login(process.env.TOKEN);

