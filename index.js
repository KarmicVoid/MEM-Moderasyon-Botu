const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot aktif!'));
app.listen(3000);

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [131071] });

const authorizedRoles = ['1483795032547917972', '1483795032589992075'];
const afkUsers = new Map();

function isAuthorized(member) {
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return member.roles.cache.some(role => authorizedRoles.includes(role.id));
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (afkUsers.has(message.author.id)) {
        afkUsers.delete(message.author.id);
        message.reply("✅ **AFK modundan çıktın. Tekrar hoş geldin!**").then(m => setTimeout(() => m.delete(), 5000));
    }

    message.mentions.users.forEach(user => {
        if (afkUsers.has(user.id)) {
            message.channel.send(`⚠️ **${user.username}** şu an AFK! \n💬 **Sebep:** ${afkUsers.get(user.id)}`);
        }
    });

    if (!message.content.startsWith('mem!')) return;
    const args = message.content.slice(4).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const member = message.mentions.members.first();

    if (command === 'afk') {
        const sebep = args.join(' ') || "Belirtilmedi";
        afkUsers.set(message.author.id, sebep);
        return message.reply(`✅ **Başarıyla AFK moduna geçtin.** \n📝 **Sebep:** ${sebep}`);
    }

    if (!isAuthorized(message.member)) return;

    if (command === 'ban') {
        if (!member) return message.reply("❌ **Hata:** Bir kullanıcı etiketlemelisin.");
        await member.send(`🚫 **${message.guild.name}** sunucusundan banlandın!`).catch(() => {});
        await member.ban().then(() => {
            message.reply(`✅ **${member.user.username}** başarıyla sunucudan yasaklandı.`);
        }).catch(() => message.reply("❌ **Hata:** Bu kullanıcıyı banlamaya yetkim yetmiyor."));
    }

    if (command === 'at') {
        if (!member) return message.reply("❌ **Hata:** Bir kullanıcı etiketlemelisin.");
        await member.send(`👞 **${message.guild.name}** sunucusundan atıldın!`).catch(() => {});
        await member.kick().then(() => {
            message.reply(`✅ **${member.user.username}** başarıyla sunucudan atıldı.`);
        }).catch(() => message.reply("❌ **Hata:** Bu kullanıcıyı atmaya yetkim yetmiyor."));
    }

    if (command === 'sustur') {
        const sure = parseInt(args[1]);
        if (!member || !sure) return message.reply("❌ **Hata:** Kullanıcı etiketle ve süre (dakika) gir.");
        await member.send(`🔇 **${message.guild.name}** sunucusunda **${sure}** dakika susturuldun.`).catch(() => {});
        await member.timeout(sure * 60000).then(() => {
            message.reply(`✅ **${member.user.username}**, **${sure}** dakika boyunca susturuldu.`);
        }).catch(() => message.reply("❌ **Hata:** Susturma işlemi başarısız."));
    }

    if (command === 'uyarı') {
        const sebep = args.slice(1).join(' ') || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ **Hata:** Bir kullanıcı etiketlemelisin.");
        await member.send(`⚠️ **${message.guild.name}** sunucusunda uyarıldın! \n📝 **Sebep:** ${sebep}`).then(() => {
            message.reply(`✅ **${member.user.username}** kullanıcısına uyarı mesajı gönderildi.`);
        }).catch(() => message.reply("❌ **Hata:** Kullanıcının DM kutusu kapalı olduğu için mesaj gönderilemedi."));
    }

    if (command === 'sil') {
        const miktar = parseInt(args[0]);
        if (!miktar || miktar < 1 || miktar > 100) return message.reply("❌ **Hata:** 1-100 arası bir sayı girmelisin.");
        await message.channel.bulkDelete(miktar + 1, true).then(() => {
            message.channel.send(`✅ **${miktar}** adet mesaj başarıyla silindi.`).then(m => setTimeout(() => m.delete(), 5000));
        }).catch(() => message.reply("❌ **Hata:** Mesajlar silinirken bir sorun oluştu."));
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).then(() => {
            message.reply("🔒 **Kanal başarıyla kilitlendi.**");
        }).catch(() => message.reply("❌ **Hata:** Kanal kilitlenemedi."));
    }

    if (command === 'duyuru') {
        const kanal = message.mentions.channels.first();
        const duyuruMesaji = args.slice(1).join(' ');
        if (!kanal || !duyuruMesaji) return message.reply("❌ **Hata:** Bir kanal etiketle ve mesajını yaz.");
        kanal.send(`📢 **DUYURU** \n\n${duyuruMesaji}`).then(() => {
            message.reply(`✅ Duyuru başarıyla ${kanal} kanalında paylaşıldı.`);
        }).catch(() => message.reply("❌ **Hata:** Duyuru gönderilemedi."));
    }
});

client.login(process.env.TOKEN);
