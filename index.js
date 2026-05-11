const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

// --- EXPRESS SERVER ---
const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot 7/24 Aktif!'));
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
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası yüklenemedi."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} TAM KOD AKTİF!`); });

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

    // --- OYUN SİSTEMLERİ ---
    if (botVerisi.sayi[message.channel.id]) {
        const data = botVerisi.sayi[message.channel.id];
        const girilen = parseInt(message.content);
        if (!isNaN(girilen)) {
            if (girilen !== data.sonSayi + 1 || message.author.id === data.sonKullanici) { message.delete(); }
            else { data.sonSayi = girilen; data.sonKullanici = message.author.id; message.react('✅'); veriKaydet(); }
            return;
        }
    }
    if (botVerisi.tuttu[message.channel.id]) {
        if (!message.content.toLowerCase().startsWith("tuttu") && !message.content.toLowerCase().startsWith("tutmadı")) { message.delete(); return; }
        else { message.react('🆗'); }
    }
    if (botVerisi.kelime[message.channel.id]) {
        const data = botVerisi.kelime[message.channel.id];
        const kelime = message.content.trim().toLowerCase();
        if (message.author.id === data.sonKullanici) { message.delete(); return; }
        if (data.sonKelime !== "" && kelime[0] !== data.sonKelime.slice(-1)) { message.delete(); return; }
        try {
            const res = await axios.get(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(kelime)}`);
            if (!res.data[0]) { message.delete(); return; }
            data.sonKelime = kelime; data.sonKullanici = message.author.id; message.react('📝'); veriKaydet();
        } catch (e) {} return;
    }

    // --- KOMUT BAŞLANGICI ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- YETKİ TANIMLAMA ---
    const isStaff = message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.roles.cache.some(r => botVerisi.yetkiliRoller.includes(r.id));

    // --- HERKES İÇİN KOMUTLAR ---
    if (command === 'komutlar') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ MEM | Komut Listesi')
            .setColor('Blue')
            .addFields(
                { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`' },
                { name: '🛡️ Moderasyon', value: '`ban`, `kick`, `mute`, `unmute`, `sil`, `lock`, `unlock`, `yetkilisec`' },
                { name: '🎮 Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`, `tuttututmadı`' },
                { name: '🎫 Bilet', value: '`/setup` (Admin)' }
            );
        return message.reply({ embeds: [embed] });
    }
    if (command === 'afk') { botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul"; veriKaydet(); return message.reply("✅ AFK moduna girdin."); }
    if (command === 'owner') return message.reply(`👑 Sunucu Sahibi: <@${message.guild.ownerId}>`);
    if (command === 'avatar') return message.reply((message.mentions.users.first() || message.author).displayAvatarURL({ size: 1024 }));

    // --- YETKİLİ KOMUTLARI ---
    if (!isStaff) return;

    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Bir veya birden fazla rol etiketle!");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply(`✅ Yetkili rolleri kaydedildi: ${roller.map(r => r.name).join(", ")}`);
    }

    if (command === 'setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const filter = m => m.author.id === message.author.id;
        message.channel.send("1️⃣ Panel Kanalı? (#etiketle)");
        const c1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
        const kanal = c1.first().mentions.channels.first();
        message.channel.send("2️⃣ Yetkili Roller? (@etiketle)");
        const c2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
        const tRoller = c2.first().mentions.roles.map(r => r.id);
        message.channel.send("3️⃣ Log Kanalı? (#etiketle)");
        const c3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
        const lKanal = c3.first().mentions.channels.first();

        botVerisi.sunucuAyarlar[message.guild.id] = { panelID: kanal.id, ticketRoller: tRoller, logID: lKanal.id };
        veriKaydet();

        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Kategori Seç...').addOptions([
            { label: 'Şikayet', value: 'Şikayet', emoji: '📝' }, { label: 'Öneri', value: 'Öneri', emoji: '💡' }, { label: 'Partnerlik', value: 'Partnerlik', emoji: '🤝' }, { label: 'İletişim', value: 'İletişim', emoji: '👑' }
        ]));
        await kanal.send({ embeds: [new EmbedBuilder().setTitle("MEM | Destek").setDescription("Bilet açmak için seçiniz.").setColor("Red")], components: [row] });
        return message.reply("✅ Ticket kuruldu.");
    }

    if (command === 'sil') {
        const s = parseInt(args[0]);
        if (s > 0 && s <= 100) await message.channel.bulkDelete(s, true).then(() => message.channel.send(`✅ ${s} mesaj silindi.`).then(m => setTimeout(() => m.delete(), 3000)));
    }
    if (command === 'ban') {
        const u = message.mentions.users.first();
        if (u) await message.guild.members.ban(u).then(() => message.reply("✅ Yasaklandı.")).catch(() => message.reply("❌ Yetkim yetmiyor!"));
    }
    if (command === 'mute') {
        const m = message.mentions.members.first();
        const d = parseInt(args[1]) || 10;
        if (m) await m.timeout(d * 60 * 1000).then(() => message.reply(`✅ ${d} dk susturuldu.`)).catch(() => message.reply("❌ Yetki hatası!"));
    }
    if (command === 'lock') { await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }); message.reply("🔒 Kilitlendi."); }
    if (command === 'unlock') { await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }); message.reply("🔓 Açıldı."); }
    
    if (['sayısaymaca', 'tuttututmadı', 'kelimeoyunu'].includes(command)) {
        const k = message.mentions.channels.first();
        if (!k) return message.reply("❌ Kanal etiketle!");
        if (command === 'sayısaymaca') botVerisi.sayi[k.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'tuttututmadı') botVerisi.tuttu[k.id] = true;
        if (command === 'kelimeoyunu') botVerisi.kelime[k.id] = { sonKelime: "", sonKullanici: null };
        veriKaydet(); return message.reply(`✅ ${command} aktif!`);
    }
});

// --- INTERACTION ---
client.on('interactionCreate', async (i) => {
    if (i.isStringSelectMenu() && i.customId === 'ticket_menu') {
        const ayar = botVerisi.sunucuAyarlar[i.guild.id];
        botVerisi.ticketCount++; veriKaydet();
        const pO = [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }];
        ayar.ticketRoller.forEach(r => pO.push({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }));
        const ch = await i.guild.channels.create({ name: `ticket-${botVerisi.ticketCount}`, type: ChannelType.GuildText, permissionOverwrites: pO });
        const b = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_kapat').setLabel('Kapat').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `${i.user} | Kategori: ${i.values[0]}`, components: [b] });
        await i.reply({ content: `Bilet açıldı: ${ch}`, ephemeral: true });
    }
    if (i.isButton() && i.customId === 'tk_kapat') {
        const ayar = botVerisi.sunucuAyarlar[i.guild.id];
        const logK = i.guild.channels.cache.get(ayar.logID);
        if (logK) {
            const msgs = await i.channel.messages.fetch({ limit: 100 });
            const logS = msgs.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
            logK.send({ content: `Bilet Kapatıldı: ${i.channel.name}`, files: [new AttachmentBuilder(Buffer.from(logS), { name: 'log.txt' })] });
        }
        await i.reply("Bilet siliniyor..."); setTimeout(() => i.channel.delete(), 3000);
    }
});

client.login(process.env.TOKEN);
