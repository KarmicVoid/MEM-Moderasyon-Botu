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
let botVerisi = { afk: {}, yetkiliRoller: [], ticketCount: 0, sunucuAyarlar: {}, sayi: {}, tuttu: {}, kelime: {}, uyarilar: {} };

// Veritabanı Yükleme
if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} | Tüm Modüller ve Geri Bildirim Sistemi Aktif!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- OYUN MOTORLARI VE KORUMA ---
    if (botVerisi.sayi[message.channel.id]) {
        const d = botVerisi.sayi[message.channel.id];
        const n = parseInt(message.content);
        if (isNaN(n)) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, bu kanal sadece **sayı saymak** içindir!`).then(m => setTimeout(() => m.delete(), 3000));
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

    if (botVerisi.kelime[message.channel.id]) {
        const d = botVerisi.kelime[message.channel.id];
        const kelime = message.content.toLowerCase().trim();
        if (message.content.includes(" ")) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, sadece tek bir kelime yazabilirsin!`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (!d.sonKelime || (kelime.startsWith(d.sonKelime.slice(-1)) && message.author.id !== d.sonKullanici)) {
            botVerisi.kelime[message.channel.id] = { sonKelime: kelime, sonKullanici: message.author.id };
            message.react('📝');
            veriKaydet();
        } else {
            message.react('❌');
            message.reply(`❌ Hatalı kelime! **${d.sonKelime.slice(-1).toUpperCase()}** harfi ile başlamalısın.`);
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

    // --- KOMUT KONTROL ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : [message.content];
    const command = args.shift().toLowerCase();

    const komutListesi = ['komutlar', 'afk', 'owner', 'avatar', 'mute', 'unmute', 'ban', 'unban', 'kick', 'sil', 'duyuru', 'lock', 'unlock', 'yetkilisec', 'sayısaymaca', 'kelimeoyunu', 'tuttututmadı', 'uyarı', '/setup'];
    
    if (!komutListesi.includes(command) && message.content.startsWith(prefix)) {
        return message.reply(`❌ \`${prefix}${command}\` diye bir komut botta bulunamadı!`);
    }

    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
    const canUse = isAdmin || isStaff || message.author.id === message.guild.ownerId;

    // --- GENEL KOMUTLAR ---
    if (command === 'komutlar') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🛡️ MEM | Gelişmiş Sistem Paneli')
            .setColor('#2b2d31')
            .addFields(
                { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`' },
                { name: '🛡️ Moderasyon (DM Bildirimli)', value: '`ban`, `kick`, `mute`, `unmute`, `uyarı`, `sil`, `lock`, `unlock`, `unban`, `duyuru`' },
                { name: '🎮 Korumalı Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`, `tuttututmadı`' },
                { name: '🎫 Ticket', value: '`/setup` - Bilet sistemini kurar.' }
            ).setTimestamp();
        return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'afk') { botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul"; veriKaydet(); return message.reply("✅ Başarıyla AFK moduna geçildi."); }
    if (command === 'owner') return message.reply(`👑 Sunucu Sahibi: <@${message.guild.ownerId}>`);
    if (command === 'avatar') { const u = message.mentions.users.first() || message.author; return message.reply(u.displayAvatarURL({ size: 1024, dynamic: true })); }

    // --- YETKİLİ KOMUTLARI ---
    if (!canUse && message.content.startsWith(prefix)) return message.reply("❌ Bu komutu kullanmak için yetkiniz bulunmuyor!");

    if (command === 'uyarı') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Lütfen uyarılacak kişiyi etiketleyin.");

        if (!botVerisi.uyarilar[member.id]) botVerisi.uyarilar[member.id] = [];
        botVerisi.uyarilar[member.id].push({ sebep, yetkili: message.author.tag });
        const sayi = botVerisi.uyarilar[member.id].length;
        veriKaydet();

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Uyarı Alındı')
            .setColor('Orange')
            .addFields(
                { name: 'Kişi', value: `${member.user.tag}`, inline: true },
                { name: 'Yetkili', value: `${message.author.tag}`, inline: true },
                { name: 'Uyarı Sayısı', value: `${sayi}`, inline: true },
                { name: 'Sebep', value: sebep }
            );
        await member.send({ embeds: [embed] }).catch(() => {});
        return message.reply({ content: `✅ **${member.user.tag}** başarıyla uyarıldı.`, embeds: [embed] });
    }

    if (command === 'ban') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Belirtilmedi";
        if (!member) return message.reply("❌ Banlanacak kişiyi etiketle.");
        try {
            await member.send(`🚫 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle banlandın.`).catch(() => {});
            await member.ban({ reason: sebep });
            return message.reply(`✅ **${member.user.tag}** adlı kişi **${sebep}** sebebiyle sunucudan banlandı.`);
        } catch (e) { return message.reply(`❌ Kişi sunucudan **${e.message}** nedeniyle banlanamadı.`); }
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
        } catch (e) { return message.reply(`❌ Kişi **${e.message}** nedeniyle mutelenemedi.`); }
    }

    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası sayı gir.");
        await message.channel.bulkDelete(sayi, true);
        return message.channel.send(`✅ **${sayi}** mesaj silindi.`).then(m => setTimeout(() => m.delete(), 3000));
    }

    if (command === 'duyuru') {
        const kanal = message.mentions.channels.first();
        const msg = args.slice(1).join(" ");
        if (!kanal || !msg) return message.reply("❌ Kullanım: `mem!duyuru #kanal mesaj`.");
        const emb = new EmbedBuilder().setTitle("📢 Duyuru").setDescription(msg).setColor("Blue").setFooter({ text: message.guild.name });
        return kanal.send({ embeds: [emb] });
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply("🔒 Kanal kilitlendi.");
    }

    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply("🔓 Kanal kilidi açıldı.");
    }

    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Rol etiketle.");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply("✅ Yetkili rolleri başarıyla kaydedildi.");
    }

    if (['sayısaymaca', 'kelimeoyunu', 'tuttututmadı'].includes(command)) {
        const k = message.mentions.channels.first();
        if (!k) return message.reply("❌ Kanal etiketle.");
        if (command === 'sayısaymaca') botVerisi.sayi[k.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'kelimeoyunu') botVerisi.kelime[k.id] = { sonKelime: "", sonKullanici: null };
        veriKaydet();
        return message.reply(`✅ **${command}** oyunu ${k} kanalında aktif edildi.`);
    }

    // --- TICKET SETUP ---
    if (command === '/setup' && isAdmin) {
        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("1️⃣ Ticket kanalını etiketle:");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const sKanal = q1.first().mentions.channels.first();
            await message.reply("2️⃣ Yetkili rollerini etiketle:");
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
            await sKanal.send({ content: "**Destek Paneli**\nBilet açmak için aşağıdan kategori seçin.", components: [menu] });
            return message.reply("✅ Ticket sistemi başarıyla kuruldu.");
        } catch (e) { return message.reply("❌ Kurulum iptal edildi (Zaman aşımı)."); }
    }
});

// --- TICKET INTERACTION ---
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
        await ch.send({ content: `Merhaba ${i.user}, sorununu yazabilirsin. Yetkililer: ${ayar.ticketRoller.map(r => `<@&${r}>`).join(", ")}`, components: [btn] });
        await i.reply({ content: `Bilet açıldı: ${ch}`, ephemeral: true });
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
        const file = new AttachmentBuilder(Buffer.from(logs), { name: `log-${i.channel.name}.txt` });
        if (logC) await logC.send({ content: `✅ Ticket Kapatıldı: ${i.channel.name}`, files: [file] });
        await i.channel.delete();
    }
    if (i.isButton() && i.customId === 'tk_vazgec') await i.message.delete();
});

client.login(process.env.TOKEN);

