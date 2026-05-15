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
let botVerisi = { afk: {}, yetkiliRoller: [], ticketCount: 0, sunucuAyarlar: {} };

// Veritabanı Kontrolü
if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası yükleme hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} | Sistemler ve Yetkiler Güncellendi!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK KONTROLÜ ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.reply(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK modun kapatıldı.`);
    }

    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : [message.content];
    const command = args.shift().toLowerCase();

    // --- YETKİ KONTROLÜ ---
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
    const isOwner = message.author.id === message.guild.ownerId;
    const canUse = isAdmin || isStaff || isOwner;

    // --- GENEL KOMUTLAR ---
    if (command === 'komutlar') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ MEM | Gelişmiş Komut Sistemi')
            .setDescription('Botun tüm özelliklerini aşağıda bulabilirsin. Kullanım ön eki: `mem!`')
            .setColor('#2F3136')
            .addFields(
                { name: '👤 Genel Komutlar', value: '`afk [sebep]` - AFK moduna girersiniz.\n`owner` - Sunucu sahibini gösterir.\n`avatar [@kişi]` - Profil fotoğrafını gösterir.' },
                { name: '🛡️ Moderasyon (Yetkili)', value: '`mute [@kişi] [dakika] [sebep]` - Süreli susturur ve DM atar.\n`unmute [@kişi]` - Susturmayı kaldırır.\n`ban [@kişi] [sebep]` - Yasaklar ve DM atar.\n`unban [ID]` - Yasak kaldırır.\n`kick [@kişi] [sebep]` - Atar ve DM atar.\n`sil [1-100]` - Mesajları temizler.\n`duyuru [#kanal] [mesaj]` - Havalı duyuru geçer.\n`lock` / `unlock` - Kanalı kilitler/açar.' },
                { name: '🎫 Ticket (Destek) Sistemi', value: '`/setup` - Ticket sistemini kurar.\n`Kategori Seç` - Bilet açar.\n`Ticketi Kapat` - Bilet kaydı (log) alır ve siler.' },
                { name: '⚙️ Yönetim', value: '`yetkilisec [@roller]` - Komutları kullanacak yetkili rolleri belirler.' }
            )
            .setFooter({ text: `${message.guild.name} Yönetim`, iconURL: message.guild.iconURL() })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    if (command === 'afk') { botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul"; veriKaydet(); return message.reply("✅ Başarıyla AFK moduna geçildi."); }
    if (command === 'owner') return message.reply(`👑 Sunucu Sahibi: <@${message.guild.ownerId}>`);
    if (command === 'avatar') { const u = message.mentions.users.first() || message.author; return message.reply(u.displayAvatarURL({ size: 1024, dynamic: true })); }

    // --- YETKİLİ KOMUTLARI BAŞLANGICI ---
    if (!canUse) return;

    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Lütfen yetkili olacak rolleri etiketle!");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply(`✅ Yetkili rolleri güncellendi.`);
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const sure = parseInt(args[1]);
        const sebep = args.slice(2).join(" ") || "Sebep belirtilmedi";
        if (!member || isNaN(sure)) return message.reply("❌ Doğru kullanım: `mem!mute @kişi dakika sebep`.");
        await member.timeout(sure * 60 * 1000, sebep);
        await member.send(`🔇 **${message.guild.name}** sunucusunda **${sebep}** nedeniyle **${sure}** dakika mutelendin.`).catch(() => {});
        return message.reply(`✅ ${member} kullanıcısı ${sure} dakika mutelendi.`);
    }

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Mutesini kaldırmak istediğin kişiyi etiketle.");
        await member.timeout(null);
        await member.send(`🔊 **${message.guild.name}** sunucusunda muten kaldırıldı.`).catch(() => {});
        return message.reply(`✅ ${member} mutesi kaldırıldı.`);
    }

    if (command === 'ban') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Yasaklamak istediğin kişiyi etiketle.");
        await member.send(`🚫 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle banlandın.`).catch(() => {});
        await member.ban({ reason: sebep });
        return message.reply(`✅ ${member} yasaklandı.`);
    }

    if (command === 'unban') {
        const id = args[0];
        if (!id) return message.reply("❌ Yasaklı kişinin ID'sini girmelisin.");
        await message.guild.members.unban(id);
        return message.reply(`✅ ${id} ID'li kullanıcının yasağı kaldırıldı.`);
    }

    if (command === 'kick') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Atmak istediğin kişiyi etiketle.");
        await member.send(`👢 **${message.guild.name}** sunucusundan **${sebep}** nedeniyle atıldın.`).catch(() => {});
        await member.kick(sebep);
        return message.reply(`✅ ${member} atıldı.`);
    }

    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ Lütfen 1-100 arası bir sayı gir.");
        await message.channel.bulkDelete(sayi, true);
        return message.channel.send(`✅ ${sayi} mesaj başarıyla temizlendi.`).then(m => setTimeout(() => m.delete(), 3000));
    }

    if (command === 'duyuru') {
        const kanal = message.mentions.channels.first();
        const mesaj = args.slice(1).join(" ");
        if (!kanal || !mesaj) return message.reply("❌ Kullanım: `mem!duyuru #kanal mesaj`.");
        const embed = new EmbedBuilder().setTitle("📢 DUYURU").setDescription(mesaj).setColor("Blue").setTimestamp().setFooter({ text: message.guild.name });
        return kanal.send({ embeds: [embed] });
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply("🔒 Kanal kilitlendi. Sadece yetkililer yazabilir.");
    }

    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply("🔓 Kanal kilidi açıldı. Herkes yazabilir.");
    }

    // --- TICKET SETUP ---
    if (command === '/setup' && isAdmin) {
        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("1️⃣ Ticket kanalını etiketle:");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const sKanal = q1.first().mentions.channels.first();

            await message.reply("2️⃣ Ticket yetkili rollerini etiketle:");
            const q2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const sRoller = q2.first().mentions.roles.map(r => r.id);

            await message.reply("3️⃣ Transcript (Log) kanalını etiketle:");
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
            const embed = new EmbedBuilder().setTitle("Destek Sistemi").setDescription("Aşağıda bulunan \"Kategori Seç...\" butonuna basarak yaşadığınız sorun hakkında olan kategoriye basarak ticket oluşturabilirsiniz.").setColor("Green");
            await sKanal.send({ embeds: [embed], components: [menu] });
            return message.reply("✅ Ticket sistemi kuruldu.");
        } catch (e) { return message.reply("❌ Süre doldu, kurulum iptal."); }
    }
});

// --- INTERACTION HANDLING (TICKET) ---
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

        const embed = new EmbedBuilder()
            .setDescription(`Merhaba ${i.user}, En yakın zamanda yetkililerimiz seninle ilgilenecektir, lütfen sorununu anlat.\n\nYetkililer: ${ayar.ticketRoller.map(r => `<@&${r}>`).join(", ")}`)
            .setColor("Yellow");
        const btn = new Action
