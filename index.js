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

client.on('ready', () => { console.log(`${client.user.tag} | Moderasyon, Ticket ve Korumalı Oyunlar Aktif!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- OYUN MOTORLARI VE KURAL KORUYUCU ---
    
    // 1. Sayı Saymaca Koruması
    if (botVerisi.sayi[message.channel.id]) {
        const d = botVerisi.sayi[message.channel.id];
        const n = parseInt(message.content);
        
        // Eğer mesaj bir sayı değilse
        if (isNaN(n)) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, bu kanal sadece **sayı saymak** içindir! Lütfen sohbet etme.`).then(m => setTimeout(() => m.delete(), 3000));
        }
        
        // Doğru sayı mı?
        if (n === d.sonSayi + 1 && message.author.id !== d.sonKullanici) {
            botVerisi.sayi[message.channel.id] = { sonSayi: n, sonKullanici: message.author.id };
            message.react('✅');
            veriKaydet();
        } else {
            message.react('❌');
            message.reply(`Hatalı sayı veya üst üste yazdın! Oyun sıfırlandı. Gereken sayı: **${d.sonSayi + 1}**`);
            botVerisi.sayi[message.channel.id] = { sonSayi: 0, sonKullanici: null };
            veriKaydet();
        }
        return; // Oyun kanalındaysa diğer komutları çalıştırma
    }

    // 2. Kelime Oyunu Koruması
    if (botVerisi.kelime[message.channel.id]) {
        const d = botVerisi.kelime[message.channel.id];
        const kelime = message.content.toLowerCase().split(" ")[0]; // Sadece ilk kelimeyi al
        
        // Eğer birden fazla kelime yazdıysa veya anlamsız karakterler varsa uyar
        if (message.content.includes(" ")) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, kelime oyununda sadece **tek bir kelime** yazabilirsin!`).then(m => setTimeout(() => m.delete(), 3000));
        }

        if (!d.sonKelime || (kelime.startsWith(d.sonKelime.slice(-1)) && message.author.id !== d.sonKullanici)) {
            botVerisi.kelime[message.channel.id] = { sonKelime: kelime, sonKullanici: message.author.id };
            message.react('📝');
            veriKaydet();
        } else {
            message.react('❌');
            const harf = d.sonKelime.slice(-1).toUpperCase();
            message.reply(`Hatalı kelime! **${harf}** harfi ile başlamalısın ve kendinden sonra yazamazsın.`);
        }
        return;
    }

    // --- AFK KONTROLÜ ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.reply(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK bitti.`);
    }

    // --- KOMUT BAŞLATICI ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : [message.content];
    const command = args.shift().toLowerCase();

    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
    const canUse = isAdmin || isStaff || message.author.id === message.guild.ownerId;

    // --- GENEL KOMUTLAR ---
    if (command === 'komutlar') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ MEM | Tam Donanımlı Bot')
            .setDescription('**Korumalı Oyunlar ve Gelişmiş Moderasyon**')
            .setColor('#2b2d31')
            .addFields(
                { name: '👤 Genel', value: '`afk`, `owner`, `avatar`' },
                { name: '🛡️ Moderasyon (DM Bildirimli)', value: '`mute`, `unmute`, `ban`, `unban`, `kick`, `sil`, `duyuru`, `lock`, `unlock`' },
                { name: '🎮 Korumalı Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`, `tuttututmadı`' },
                { name: '🎫 Ticket', value: '`/setup` - Bilet sistemini kurar.' }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'avatar') { const u = message.mentions.users.first() || message.author; return message.reply(u.displayAvatarURL({ size: 1024, dynamic: true })); }

    // --- YETKİLİ KOMUTLARI ---
    if (canUse) {
        if (command === 'mute') {
            const member = message.mentions.members.first();
            const sure = parseInt(args[1]);
            const sebep = args.slice(2).join(" ") || "Belirtilmedi";
            if (!member || isNaN(sure)) return message.reply("❌ `mem!mute @kişi dakika sebep`.");
            await member.timeout(sure * 60 * 1000, sebep);
            await member.send(`🔇 **${message.guild.name}** sunucusunda **${sebep}** nedeniyle **${sure}** dakika mutelendin.`).catch(() => {});
            return message.reply(`✅ ${member} susturuldu.`);
        }
        if (command === 'ban') {
            const member = message.mentions.members.first();
            const sebep = args.slice(1).join(" ") || "Belirtilmedi";
            if (!member) return message.reply("❌ Kişi etiketle.");
            await member.send(`🚫 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle banlandın.`).catch(() => {});
            await member.ban({ reason: sebep });
            return message.reply(`✅ ${member} yasaklandı.`);
        }
        if (command === 'sil') {
            const sayi = parseInt(args[0]);
            if (sayi > 0 && sayi <= 100) {
                await message.channel.bulkDelete(sayi, true);
                return message.channel.send(`✅ ${sayi} mesaj silindi.`).then(m => setTimeout(() => m.delete(), 3000));
            }
        }
        if (command === 'lock') {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply("🔒 Kanal kilitlendi.");
        }
        if (command === 'unlock') {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply("🔓 Kanal açıldı.");
        }
        if (command === 'yetkilisec') {
            botVerisi.yetkiliRoller = message.mentions.roles.map(r => r.id);
            veriKaydet();
            return message.reply("✅ Yetkili rolleri kaydedildi.");
        }

        // Oyun Kurulum
        if (['sayısaymaca', 'tuttututmadı', 'kelimeoyunu'].includes(command)) {
            const k = message.mentions.channels.first();
            if (!k) return message.reply("❌ Kanal etiketle!");
            if (command === 'sayısaymaca') botVerisi.sayi[k.id] = { sonSayi: 0, sonKullanici: null };
            if (command === 'tuttututmadı') botVerisi.tuttu[k.id] = true;
            if (command === 'kelimeoyunu') botVerisi.kelime[k.id] = { sonKelime: "", sonKullanici: null };
            veriKaydet();
            return message.reply(`✅ **${command}** kanalı ${k} olarak ayarlandı! Artık bu kanalda kural dışı mesajlar silinecek.`);
        }
    }

    // --- TICKET SETUP ---
    if (command === '/setup' && isAdmin) {
        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("1️⃣ Ticket kanalını etiketle:");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const sKanal = q1.first().mentions.channels.first();
            await message.reply("2️⃣ Yetkili rolleri etiketle:");
            const q2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const sRoller = q2.first().mentions.roles.map(r => r.id);
            await message.reply("3️⃣ Log kanalını etiketle:");
            const q3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const sLog = q3.first().mentions.channels.first();

            botVerisi.sunucuAyarlar[message.guild.id] = { ticketRoller: sRoller, logKanal: sLog.id };
            veriKaydet();

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_sec').setPlaceholder('Kategori Seç...').addOptions([
                    { label: 'Partner İletişim', value: 'partner' },
                    { label: 'Şikayet ve Geri Bildirim', value: 'sikayet' },
                    { label: 'Yetkililerle İletişim', value: 'yetkili' },
                    { label: 'İstek ve Öneriler', value: 'istek' },
                    { label: 'Hata ve Bug Bildirimleri', value: 'bug' }
                ])
            );
            await sKanal.send({ content: "**Destek Paneli**\nBilet açmak için kategori seçin.", components: [menu] });
            return message.reply("✅ Kurulum tamam.");
        } catch (e) { return message.reply("❌ Hata/Zaman aşımı."); }
    }
});

// --- INTERACTION (TICKET) ---
client.on('interactionCreate', async (i) => {
    if (i.isStringSelectMenu() && i.customId === 'ticket_sec') {
        const ayar = botVerisi.sunucuAyarlar[i.guild.id];
        botVerisi.ticketCount++; veriKaydet();
        const ch = await i.guild.channels.create({
            name: `ticket-${botVerisi.ticketCount}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.ticketRoller.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_kapat_sor').setLabel('Ticketi Kapat').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `Merhaba ${i.user}, yetkililer gelene kadar sorununu yazabilirsin.`, components: [btn] });
        await i.reply({ content: `Biletiniz açıldı: ${ch}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'tk_kapat_sor') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_evet').setLabel('Evet').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tk_vazgec').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary)
        );
        await i.reply({ content: "Kapatmak istediğine emin misin?", components: [row] });
    }

    if (i.isButton() && i.customId === 'tk_evet') {
        const ayar = botVerisi.sunucuAyarlar[i.guild.id];
        const logC = i.guild.channels.cache.get(ayar.logKanal);
        const msgs = await i.channel.messages.fetch();
        const logs = msgs.reverse().map(m => `${m.author.tag}: ${m.content}`).join("\n");
        const file = new AttachmentBuilder(Buffer.from(logs), { name: `ticket-log-${i.channel.name}.txt` });
        if (logC) await logC.send({ content: `✅ Ticket Kaydı: ${i.channel.name}`, files: [file] });
        await i.channel.delete();
    }
    if (i.isButton() && i.customId === 'tk_vazgec') await i.message.delete();
});

client.login(process.env.TOKEN);
