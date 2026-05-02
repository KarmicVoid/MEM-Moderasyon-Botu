const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { WelcomeLeave } = require('canvacord');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('MEM Moderasyon Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [], kanallar: {} };

if (fs.existsSync('./moderasyon.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./moderasyon.json', 'utf8')); } catch (e) { console.log("Veri dosyası hatası."); }
}
function veriKaydet() { fs.writeFileSync('./moderasyon.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} Moderasyon Botu Görevde!`); });

// --- GİRİŞ SİSTEMİ ---
client.on('guildMemberAdd', async (member) => {
    const kanalId = botVerisi.kanallar?.[member.guild.id]?.hosgeldin;
    if (!kanalId) return;
    const kanal = member.guild.channels.cache.get(kanalId);
    if (!kanal) return;

    const welcome = new WelcomeLeave()
        .setAvatar(member.user.displayAvatarURL({ extension: 'png' }))
        .setDisplayName(member.user.username)
        .setTitle("Hoş Geldin!")
        .setMemberCount(member.guild.memberCount)
        .setBackground("https://i.imgur.com/8PrZ94X.png");

    const data = await welcome.build();
    const attachment = new AttachmentBuilder(data, { name: 'hosgeldin.png' });

    kanal.send({
        content: `👋 **${member.user.username}** Sunucuya girdi, senin sayende **${member.guild.memberCount}** Olduk, Hoş geldin!`,
        files: [attachment]
    });
});

// --- ÇIKIŞ SİSTEMİ ---
client.on('guildMemberRemove', async (member) => {
    const kanalId = botVerisi.kanallar?.[member.guild.id]?.hoscakal;
    if (!kanalId) return;
    const kanal = member.guild.channels.cache.get(kanalId);
    if (!kanal) return;

    const leave = new WelcomeLeave()
        .setAvatar(member.user.displayAvatarURL({ extension: 'png' }))
        .setDisplayName(member.user.username)
        .setTitle("Hoşça Kal")
        .setMemberCount(member.guild.memberCount)
        .setBackground("https://i.imgur.com/8PrZ94X.png");

    const data = await leave.build();
    const attachment = new AttachmentBuilder(data, { name: 'hoscakal.png' });

    kanal.send({
        content: `😢 **${member.user.username}** Sunucudan ayrıldı, görüşmek üzere tekrardan bekleriz.`,
        files: [attachment]
    });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // AFK Sistemi Kontrolü
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

    if (!message.content.startsWith(prefix) && message.content !== '/yetkilisec') return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = message.content.startsWith(prefix) ? args.shift().toLowerCase() : message.content;

    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller?.includes(role.id));
    };

    if (command === '/yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        botVerisi.yetkiliRoller = message.mentions.roles.map(r => r.id);
        veriKaydet();
        return message.reply("✅ Yetkili rolleri kaydedildi.");
    }

    if (!yetkiliMi() && command !== 'afk') return;

    // Komutlar
    if (command === 'sil') {
        let sayi = parseInt(args[0]);
        if (!sayi || sayi < 1 || sayi > 110) return message.reply("❌ 1-110 arası sayı gir!");
        await message.channel.bulkDelete(sayi > 100 ? 100 : sayi, true);
        if (sayi > 100) await message.channel.bulkDelete(sayi - 100, true);
        message.channel.send(`✅ Başarıyla **${sayi}** mesaj silindi.`).then(m => setTimeout(() => m.delete(), 5000));
    }

    if (command === 'hoşgeldin') {
        const kanal = message.mentions.channels.first();
        if (!botVerisi.kanallar[message.guild.id]) botVerisi.kanallar[message.guild.id] = {};
        botVerisi.kanallar[message.guild.id].hosgeldin = kanal?.id;
        veriKaydet();
        message.reply(`✅ Hoş geldin kanalı ${kanal} olarak ayarlandı.`);
    }

    if (command === 'hoşçakal') {
        const kanal = message.mentions.channels.first();
        if (!botVerisi.kanallar[message.guild.id]) botVerisi.kanallar[message.guild.id] = {};
        botVerisi.kanallar[message.guild.id].hoscakal = kanal?.id;
        veriKaydet();
        message.reply(`✅ Hoşça kal kanalı ${kanal} olarak ayarlandı.`);
    }

    if (command === 'emojiekle') {
        const url = args[0]; const isim = args[1];
        if (!url || !isim) return message.reply("❌ `mem!emojiekle [URL] [İsim]`");
        message.guild.emojis.create({ attachment: url, name: isim })
            .then(e => message.reply(`✅ Emoji eklendi: ${e.toString()}`))
            .catch(() => message.reply("❌ Hata oluştu."));
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        const sebep = args.slice(1).join(" ") || "Sebep yok";
        if (!user) return;
        await user.send(`🚫 **${message.guild.name}** sunucusundan banlandın. Sebep: ${sebep}`).catch(() => {});
        message.guild.members.ban(user, { reason: sebep });
        message.reply(`✅ ${user.tag} yasaklandı.`);
    }

    if (command === 'kick') {
        const user = message.mentions.users.first();
        if (!user) return;
        await user.send(`👢 **${message.guild.name}** sunucusundan atıldın.`).catch(() => {});
        message.guild.members.kick(user);
        message.reply(`✅ ${user.tag} atıldı.`);
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const sure = parseInt(args[1]);
        if (!member || !sure) return;
        await member.timeout(sure * 60 * 1000);
        message.reply(`✅ ${member.user.tag} ${sure} dakika susturuldu.`);
    }

    if (command === 'lock') {
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply("🔒 Kanal kilitlendi.");
    }

    if (command === 'unlock') {
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
        message.reply("🔓 Kanal açıldı.");
    }

    if (command === 'duyuru') {
        const kanal = message.mentions.channels.first();
        const metin = args.slice(1).join(" ");
        if (!kanal || !metin) return;
        const embed = new EmbedBuilder().setTitle("📢 Duyuru").setDescription(metin).setColor("Red");
        kanal.send({ embeds: [embed] });
    }

    if (command === 'uyarı') {
        const user = message.mentions.users.first();
        if (!user) return;
        user.send(`⚠️ **${message.guild.name}** sunucusunda uyarıldın!`).catch(() => {});
        message.reply(`✅ ${user.tag} uyarıldı.`);
    }

    if (command === 'afk') {
        const sebep = args.join(" ") || "Meşgul";
        if (!botVerisi.afk) botVerisi.afk = {};
        botVerisi.afk[message.author.id] = sebep;
        veriKaydet();
        message.reply(`✅ AFK moduna girdin: **${sebep}**`);
    }
});

client.login(process.env.TOKEN);

