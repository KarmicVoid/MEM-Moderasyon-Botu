const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Moderasyon Botu Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers
    ]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [] };

if (fs.existsSync('./moderasyon.json')) {
    try {
        botVerisi = JSON.parse(fs.readFileSync('./moderasyon.json', 'utf8'));
    } catch (e) { console.log("Veri dosyası okunurken hata oluştu, sıfırlandı."); }
}

function veriKaydet() {
    fs.writeFileSync('./moderasyon.json', JSON.stringify(botVerisi, null, 2));
}

client.on('ready', () => {
    console.log(`${client.user.tag} Moderasyon Botu Yayında!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK SİSTEMİ (MESAJ KONTROL) ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk && botVerisi.afk[user.id]) {
                const sebep = botVerisi.afk[user.id];
                message.reply(`📌 **${user.username}** şu an AFK! Sebep: **${sebep}**`);
            }
        });
    }

    if (botVerisi.afk && botVerisi.afk[message.author.id]) {
        delete botVerisi.afk[message.author.id];
        veriKaydet();
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK modundan çıkarıldın!`);
    }

    if (!message.content.startsWith(prefix) && message.content !== '/yetkilisec') return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = message.content.startsWith(prefix) ? args.shift().toLowerCase() : message.content;

    // Yetkili Kontrolü
    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller?.includes(role.id));
    };

    // --- YETKİLİ SEÇİMİ ---
    if (command === '/yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roller = message.mentions.roles.map(r => r.id);
        if (roller.length === 0) return message.reply("❌ Lütfen rolleri etiketleyin!");
        botVerisi.yetkiliRoller = roller;
        veriKaydet();
        message.reply(`✅ Yetkili rolleri güncellendi!`);
    }

    // --- MODERATÖR KOMUTLARI ---
    if (!yetkiliMi() && command !== 'afk') return;

    if (command === 'emojiekle') {
        const url = args[0];
        const isim = args[1] || `emoji_${Math.floor(Math.random() * 1000)}`;
        if (!url) return message.reply("❌ Kullanım: `mem!emojiekle [URL] [İsim]`");

        try {
            const emoji = await message.guild.emojis.create({ attachment: url, name: isim });
            message.reply(`✅ Emoji başarıyla eklendi: ${emoji.toString()}`);
        } catch (err) {
            message.reply("❌ Hata! URL'nin geçerli bir resim olduğundan emin olun.");
        }
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!user) return message.reply("❌ Kullanıcı etiketleyin.");
        
        await user.send(`🚫 **${message.guild.name}** sunucusundan banlandın. Sebep: ${sebep}`).catch(() => {});
        await message.guild.members.ban(user, { reason: sebep });
        message.reply(`✅ **${user.tag}** yasaklandı.`);
    }

    if (command === 'kick') {
        const user = message.mentions.users.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!user) return message.reply("❌ Kullanıcı etiketleyin.");
        
        await user.send(`👢 **${message.guild.name}** sunucusundan atıldın. Sebep: ${sebep}`).catch(() => {});
        await message.guild.members.kick(user, sebep);
        message.reply(`✅ **${user.tag}** atıldı.`);
    }

    if (command === 'mute') {
        const user = message.mentions.members.first();
        const sure = parseInt(args[1]);
        const sebep = args.slice(2).join(" ") || "Sebep yok";
        if (!user || !sure) return message.reply("❌ `mem!mute @üye [dakika] [sebep]`");

        await user.timeout(sure * 60 * 1000, sebep);
        await user.send(`🤫 **${message.guild.name}** sunucusunda ${sure} dakika susturuldun.`).catch(() => {});
        message.reply(`✅ **${user.user.tag}** susturuldu.`);
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply("🔒 Kanal kilitlendi.");
    }

    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
        message.reply("🔓 Kanal açıldı.");
    }

    if (command === 'duyuru') {
        const kanal = message.mentions.channels.first();
        const metin = args.slice(1).join(" ");
        if (!kanal || !metin) return message.reply("❌ `mem!duyuru #kanal [mesaj]`");
        const embed = new EmbedBuilder().setTitle("📢 Duyuru").setDescription(metin).setColor("Red");
        kanal.send({ embeds: [embed] });
        message.reply("✅ Gönderildi.");
    }

    if (command === 'uyarı') {
        const user = message.mentions.users.first();
        const sebep = args.slice(1).join(" ") || "Kurallara uyun.";
        if (!user) return message.reply("❌ Kullanıcı etiketleyin.");
        await user.send(`⚠️ **${message.guild.name}** sunucusunda uyarıldın! Sebep: ${sebep}`).catch(() => {});
        message.reply(`✅ **${user.tag}** uyarıldı.`);
    }

    // --- GENEL KOMUTLAR ---
    if (command === 'afk') {
        const sebep = args.join(" ") || "Meşgul";
        botVerisi.afk[message.author.id] = sebep;
        veriKaydet();
        message.reply(`✅ AFK moduna girildi: **${sebep}**`);
    }
});

client.login(process.env.TOKEN);
