const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
    } catch (e) { botVerisi = { afk: {}, yetkiliRoller: [] }; }
}

function veriKaydet() {
    fs.writeFileSync('./moderasyon.json', JSON.stringify(botVerisi, null, 2));
}

client.on('ready', () => {
    console.log(`${client.user.tag} Moderasyon Sistemi Hazır!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK KONTROL ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk && botVerisi.afk[user.id]) {
                message.reply(`📌 **${user.username}** şu an AFK! Sebep: **${botVerisi.afk[user.id]}**`);
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

    // Yetki Kontrolü
    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller?.includes(role.id));
    };

    // --- YETKİLİ SEÇİMİ ---
    if (command === '/yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roller = message.mentions.roles.map(r => r.id);
        botVerisi.yetkiliRoller = roller;
        veriKaydet();
        message.reply(`✅ Yetkili rolleri güncellendi!`);
        return;
    }

    // --- MODERATÖR KOMUTLARI (YETKİ GEREKTİRİR) ---
    if (!yetkiliMi() && command !== 'afk') return;

    // --- YENİ: MESAJ SİLME KOMUTU (mem!sil) ---
    if (command === 'sil') {
        let miktar = parseInt(args[0]);
        if (!miktar || isNaN(miktar) || miktar < 1 || miktar > 110) {
            return message.reply("❌ Lütfen silinecek mesaj sayısını girin (Maksimum: 110).");
        }

        try {
            let silinenToplam = 0;
            if (miktar > 100) {
                const s1 = await message.channel.bulkDelete(100, true);
                const s2 = await message.channel.bulkDelete(miktar - 100, true);
                silinenToplam = s1.size + s2.size;
            } else {
                const s = await message.channel.bulkDelete(miktar, true);
                silinenToplam = s.size;
            }

            const onay = await message.channel.send(`✅ Başarıyla **${silinenToplam}** adet mesaj silindi!`);
            // Onay mesajını 5 saniye sonra siler (isteğe bağlı)
            setTimeout(() => onay.delete().catch(() => {}), 5000);
        } catch (err) {
            message.reply("❌ Mesajlar silinirken bir hata oluştu. (Not: 14 günden eski mesajlar teknik olarak silinemez).");
        }
    }

    // --- DİĞER MODERASYON KOMUTLARI ---
    if (command === 'emojiekle') {
        const url = args[0];
        const isim = args[1] || "emoji";
        if (!url) return message.reply("❌ URL belirtin.");
        try {
            const emoji = await message.guild.emojis.create({ attachment: url, name: isim });
            message.reply(`✅ Emoji eklendi: ${emoji.toString()}`);
        } catch (e) { message.reply("❌ Emoji eklenemedi."); }
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!user) return message.reply("❌ Üye etiketleyin.");
        await user.send(`🚫 **${message.guild.name}** sunucusundan banlandın.`).catch(() => {});
        await message.guild.members.ban(user, { reason: sebep });
        message.reply(`✅ **${user.tag}** banlandı.`);
    }

    if (command === 'kick') {
        const user = message.mentions.users.first();
        if (!user) return message.reply("❌ Üye etiketleyin.");
        await user.send(`👢 **${message.guild.name}** sunucusundan atıldın.`).catch(() => {});
        await message.guild.members.kick(user);
        message.reply(`✅ **${user.tag}** atıldı.`);
    }

    if (command === 'mute') {
        const user = message.mentions.members.first();
        const sure = parseInt(args[1]);
        if (!user || !sure) return message.reply("❌ `mem!mute @üye [dakika]`");
        await user.timeout(sure * 60 * 1000);
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
    }

    if (command === 'uyarı') {
        const user = message.mentions.users.first();
        if (!user) return message.reply("❌ Üye etiketleyin.");
        await user.send(`⚠️ **${message.guild.name}** sunucusunda uyarıldın!`).catch(() => {});
        message.reply(`✅ **${user.tag}** uyarıldı.`);
    }

    if (command === 'afk') {
        const sebep = args.join(" ") || "Meşgul";
        if (!botVerisi.afk) botVerisi.afk = {};
        botVerisi.afk[message.author.id] = sebep;
        veriKaydet();
        message.reply(`✅ AFK moduna girildi: **${sebep}**`);
    }
});

client.login(process.env.TOKEN);

