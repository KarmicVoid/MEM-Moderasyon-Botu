const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- 7/24 AKTİF TUTMA SİSTEMİ ---
const app = express();
app.get('/', (req, res) => res.send('MEM Bot 7/24 Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { uyarilar: {}, ticketCount: 0, sunucuAyarlar: {}, sayi: {}, kelime: {}, yetkiliRoller: [], afk: {} };

// Veritabanı Dosyası Yükleme
if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} | Tüm Kanallarda ve Sistemlerde Aktif!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- 1. OYUN MOTORLARI ---
    if (botVerisi.sayi[message.channel.id]) {
        const d = botVerisi.sayi[message.channel.id];
        const n = parseInt(message.content);
        if (isNaN(n)) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, sadece sayı yaz!`).then(m => setTimeout(() => m.delete(), 2000));
        }
        if (n === d.sonSayi + 1 && message.author.id !== d.sonKullanici) {
            botVerisi.sayi[message.channel.id] = { sonSayi: n, sonKullanici: message.author.id };
            return message.react('✅');
        } else {
            message.reply(`❌ Sıra bozuldu! Sayı: **${d.sonSayi + 1}** olmalıydı. Oyun sıfırlandı.`);
            botVerisi.sayi[message.channel.id] = { sonSayi: 0, sonKullanici: null };
            return veriKaydet();
        }
    }

    // --- 2. AFK SİSTEMİ ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.channel.send(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.channel.send(`👋 Hoş geldin **${message.author.username}**, AFK modun kapatıldı.`);
    }

    // --- 3. /SETUP KONTROLÜ (Çakışma Önleyicili) ---
    if (message.content === '/setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("❌ Bu kurulumu sadece yöneticiler yapabilir.");

        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("1️⃣ **Ticket panelinin kurulacağı kanalı etiketle (#kanal):**");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const pKanal = q1.first().mentions.channels.first();
            if (!pKanal) return message.reply("❌ Kanal etiketlemedin, iptal edildi.");

            await message.reply("2️⃣ **Ticket yetkilisi rollerini etiketle (@rol):**");
            const q2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const pRoller = q2.first().mentions.roles.map(r => r.id);
            if (pRoller.length === 0) return message.reply("❌ Rol etiketlemedin, iptal edildi.");

            await message.reply("3️⃣ **Transcript (Log) kanalını etiketle (#kanal):**");
            const q3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const pLog = q3.first().mentions.channels.first();
            if (!pLog) return message.reply("❌ Log kanalı etiketlemedin, iptal edildi.");

            botVerisi.sunucuAyarlar[message.guild.id] = { panelKanal: pKanal.id, yetkiliRoller: pRoller, logKanal: pLog.id };
            veriKaydet();

            const panelEmbed = new EmbedBuilder()
                .setTitle("🎫 Destek Sistemi")
                .setDescription("Aşağıda bulunan **\"Kategori Seç...\"** butonuna basarak yaşadığınız sorun hakkında olan kategoriye basarak ticket oluşturabilirsiniz.")
                .setColor("Blue");

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_kategori')
                    .setPlaceholder('Kategori seç...')
                    .addOptions([
                        { label: 'Partner İletişim', value: 'partner', emoji: '🤝' },
                        { label: 'Şikayet ve Geri Bildirim', value: 'sikayet', emoji: '📢' },
                        { label: 'Yetkililerle İletişim', value: 'yetkili', emoji: '👨‍✈️' },
                        { label: 'İstek ve Öneriler', value: 'istek', emoji: '💡' },
                        { label: 'Hata ve Bug Bildirimleri', value: 'bug', emoji: '🐛' }
                    ])
            );

            await pKanal.send({ embeds: [panelEmbed], components: [menu] });
            return message.reply("✅ Ticket sistemi başarıyla kuruldu!");
        } catch (e) { return message.reply("❌ Zaman aşımı veya kurulum hatası."); }
    }

    // --- 4. PREFIX'Lİ KOMUT KONTROLÜ ---
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Komut Havuzu
    const tumKomutlar = ['komutlar', 'afk', 'owner', 'avatar', 'mute', 'unmute', 'ban', 'kick', 'sil', 'lock', 'unlock', 'uyarı', 'rolver', 'rolal', 'yetkilisec', 'sayısaymaca', 'kelimeoyunu'];
    if (!tumKomutlar.includes(command)) return message.reply(`❌ \`${prefix}${command}\` komutu bulunamadı.`);

    const canUse = message.member.permissions.has(PermissionFlagsBits.Administrator) || botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
    if (!canUse) return message.reply("❌ Bu komutu kullanmak için yetkiniz bulunmuyor.");

    // --- KİLİT KOMUTLARI (İSTEDİĞİN METİNLERLE GÜNCELLENDİ) ---
    if (command === 'lock') {
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply("🔒 Kanal yetkililer dışındakilere kilitlendi.");
        } catch (e) { return message.reply("❌ Kanal kilitlenirken bir hata oluştu."); }
    }

    if (command === 'unlock') {
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply("🔓 Kanal kilidi başarıyla açıldı.");
        } catch (e) { return message.reply("❌ Kanal kilidi açılırken bir hata oluştu."); }
    }

    // --- DİĞER MODERASYON VE YÖNETİM KOMUTLARI ---
    if (command === 'komutlar') {
        const helpEmbed = new EmbedBuilder().setTitle('🛡️ MEM Bot Komut Paneli').setColor('Blue').addFields(
            { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`' },
            { name: '🛡️ Moderasyon', value: '`ban`, `kick`, `mute`, `unmute`, `uyarı`, `sil`, `lock`, `unlock`' },
            { name: '🎭 Rol Yönetimi', value: '`rolver`, `rolal`' },
            { name: '🎮 Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`' }
        );
        return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'uyarı') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Lütfen birini etiketleyin.");

        if (!botVerisi.uyarilar[member.id]) botVerisi.uyarilar[member.id] = [];
        botVerisi.uyarilar[member.id].push({ sebep, yetkili: message.author.tag });
        const count = botVerisi.uyarilar[member.id].length;
        veriKaydet();

        const emb = new EmbedBuilder().setTitle("⚠️ Uyarı Kaydı").setColor("Orange").addFields(
            { name: "Kişi", value: member.user.tag, inline: true },
            { name: "Sıra", value: `${count}. Uyarı`, inline: true },
            { name: "Sebep", value: sebep }
        );
        await member.send({ embeds: [emb] }).catch(() => {});
        return message.reply({ embeds: [emb] });
    }

    if (command === 'rolver') {
        const member = message.mentions.members.first();
        const rolInput = args.slice(1).join(" ");
        const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolInput);
        if (!member || !role) return message.reply("❌ Kullanım: `mem!rolver @kişi @rol` veya Rol Adı");
        try {
            await member.roles.add(role);
            return message.reply(`✅ **${member.user.tag}** kişisine **${role.name}** rolü başarıyla verildi.`);
        } catch (e) { return message.reply("❌ Rol verilemedi, yetkimi kontrol edin."); }
    }

    if (command === 'rolal') {
        const member = message.mentions.members.first();
        const rolInput = args.slice(1).join(" ");
        const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolInput);
        if (!member || !role) return message.reply("❌ Kullanım: `mem!rolal @kişi @rol` veya Rol Adı");
        try {
            await member.roles.remove(role);
            return message.reply(`✅ **${member.user.tag}** kişisinden **${role.name}** rolü başarıyla alındı.`);
        } catch (e) { return message.reply("❌ Rol alınamadı, yetkimi kontrol edin."); }
    }

    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası bir sayı girin.");
        await message.channel.bulkDelete(sayi, true);
        return message.channel.send(`✅ **${sayi}** adet mesaj temizlendi.`).then(m => setTimeout(() => m.delete(), 3000));
    }
});

// --- 5. INTERACTION ETKİLEŞİMLERİ (TICKET) ---
client.on('interactionCreate', async (i) => {
    const ayar = botVerisi.sunucuAyarlar[i.guild?.id];
    if (!ayar) return;

    if (i.isStringSelectMenu() && i.customId === 'ticket_kategori') {
        botVerisi.ticketCount++; veriKaydet();

        const channel = await i.guild.channels.create({
            name: `ticket-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.yetkiliRoller.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });

        const welcomeEmbed = new EmbedBuilder()
            .setColor("Green")
            .setDescription(`Merhaba ${i.user}, En yakın zamanda yetkililerimiz senle ilgilenecektir, lütfen sorununu anlat.\n\n**Yetkililer:** ${ayar.yetkiliRoller.map(r => `<@&${r}>`).join(", ")}`);

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_kapat_istek').setLabel('Ticketi Kapat').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${i.user} | ${ayar.yetkiliRoller.map(r => `<@&${r}>`).join(" ")}`, embeds: [welcomeEmbed], components: [closeBtn] });
        return i.reply({ content: `✅ Biletin oluşturuldu: ${channel}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'tk_kapat_istek') {
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_onay_evet').setLabel('Evet').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tk_onay_hayir').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary)
        );
        return i.reply({ content: "⚠️ Ticketi kapatmak istediğine emin misin?", components: [confirmRow] });
    }

    if (i.isButton() && i.customId === 'tk_onay_evet') {
        const logChannel = i.guild.channels.cache.get(ayar.logKanal);
        const messages = await i.channel.messages.fetch();
        const content = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
        const attachment = new AttachmentBuilder(Buffer.from(content), { name: `transcript-${i.channel.name}.txt` });

        if (logChannel) await logChannel.send({ content: `📁 **${i.channel.name}** bilet logları:`, files: [attachment] });
        await i.reply("🔒 Bilet kapatılıyor...");
        return setTimeout(() => i.channel.delete(), 2000);
    }

    if (i.isButton() && i.customId === 'tk_onay_hayir') {
        return i.message.delete();
    }
});

client.login(process.env.TOKEN);
