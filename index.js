const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot aktif!'));
app.listen(3000);

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [131071] });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('mem!')) return;
    const args = message.content.slice(4).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const member = message.mentions.members.first();

    if (command === 'ban' && message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        if (!member) return message.reply("Kullanıcı etiketle.");
        await member.ban().catch(() => message.reply("Banlayamadım."));
        message.reply(member.user.username + " banlandı.");
    }

    if (command === 'at' && message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        if (!member) return message.reply("Kullanıcı etiketle.");
        await member.kick().catch(() => message.reply("Atamadım."));
        message.reply(member.user.username + " atıldı.");
    }

    if (command === 'sustur' && message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        if (!member || !args[1]) return message.reply("Kullanıcı etiketle ve süre (dk) gir.");
        await member.timeout(parseInt(args[1]) * 60000).catch(() => message.reply("Susturamadım."));
        message.reply(member.user.username + " susturuldu.");
    }

    if (command === 'sil' && message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 150) return message.reply("1-150 arası sayı gir.");
        await message.channel.bulkDelete(amount + 1, true).catch(() => message.reply("Hata oluştu."));
    }

    if (command === 'lock' && message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply("🔒 Kanal kilitlendi.");
    }

    if (command === 'duyuru' && message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const channel = message.mentions.channels.first();
        const msg = args.slice(1).join(' ');
        if (channel && msg) channel.send(`📢 ${msg}`);
    }
});

client.login(process.env.TOKEN);

