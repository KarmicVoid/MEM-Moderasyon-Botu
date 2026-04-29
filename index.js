const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const afkUsers = new Map();

function isAuthorized(member) {
    const authorizedRoles = ['1483795032547917972', '1483795032589992075'];
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;
    if (member.roles.cache.some(role => authorizedRoles.includes(role.id))) return true;
    return false;
}

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('mem!') || message.author.bot) return;

    const args = message.content.slice(4).split(' ');
    const command = args.shift().toLowerCase();

    if (command === 'ban') {
        if (!isAuthorized(message.member)) return message.reply("❌ Yetkin yok.");
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(' ');
        if (!member) return message.reply("Kullanıcı etiketle.");
        try {
            await member.ban({ reason });
            message.channel.send(`${member.user.username} başarıyla banlandı.`);
        } catch {
            message.channel.send(`${member.user.username} banlanamadı.`);
        }
    }

    if (command === 'at') {
        if (!isAuthorized(message.member)) return message.reply("❌ Yetkin yok.");
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(' ');
        if (!member) return message.reply("Kullanıcı etiketle.");
        try {
            await member.kick(reason);
            message.channel.send(`${member.user.username} adlı kişi ${reason} dolayından dolayı sunucudan atıldı.`);
        } catch {
            message.channel.send(`${member.user.username} adlı kişi atılamadı.`);
        }
    }

    if (command === 'sustur') {
        if (!isAuthorized(message.member)) return message.reply("❌ Yetkin yok.");
        const member = message.mentions.members.first();
        const duration = args[1];
        const reason = args.slice(2).join(' ') || "Sebep yok";
        const roleId = "1483795032589992075";
        if (!member) return message.reply("Kullanıcı etiketle.");
        try {
            await member.roles.add(roleId);
            message.channel.send(`${member.user.username} adlı kişi ${reason} dolayından dolayı ${duration} Mute yemiştir.`);
        } catch {
            message.channel.send(`${member.user.username} adlı kişi susturulamadı.`);
        }
    }

    if (command === 'uyarı') {
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(' ');
        if (!member) return message.reply("Kullanıcı etiketle.");
        try {
            await member.send(`Merhaba ${member.user.toString()}, MEM sunucusunda ${reason} dolayından dolayı uyarı aldınız.`);
            message.reply("✅ Uyarı gönderildi.");
        } catch {
            message.reply("❌ Uyarı gönderilemedi.");
        }
    }

    if (command === 'sil') {
        if (!isAuthorized(message.member)) return message.reply("❌ Yetkin yok.");
        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 150) return message.reply("1-150 arası sayı gir.");
        try {
            await message.channel.bulkDelete(amount + 1, true);
            message.channel.send(`${amount} adet mesaj başarıyla silindi.`);
        } catch {
            message.channel.send("❌ Mesajlar silinemedi.");
        }
    }

    if (command === 'lock') {
        if (!isAuthorized(message.member)) return message.reply("❌ Yetkin yok.");
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            message.channel.send(`${message.channel.name} adlı kanal başarıyla kilitlendi.`);
        } catch {
            message.channel.send("❌ Kanal kilitlenemedi.");
        }
    }

    if (command === 'afk') {
        const reason = args.join(' ') || "Sebep yok";
        afkUsers.set(message.author.id, reason);
        message.reply("✅ Artık AFK'sın.");
    }

    if (command === 'duyuru') {
        if (!isAuthorized(message.member)) return message.reply("❌ Yetkin yok.");
        const channel = message.mentions.channels.first();
        const msg = args.slice(1).join(' ');
        if (!channel || !msg) return message.reply("Hatalı kullanım.");
        try {
            await channel.send(`📢 ${msg}`);
            message.reply("✅ Duyuru atıldı.");
        } catch {
            message.reply("❌ Duyuru atılamadı.");
        }
    }
});

client.on('messageCreate', (message) => {
    if (afkUsers.has(message.author.id)) {
        afkUsers.delete(message.author.id);
        message.reply("✅ AFK durumundan çıktın.");
    }
    message.mentions.users.forEach(user => {
        if (afkUsers.has(user.id)) {
            message.channel.send(`${user.username} adlı kişi ${afkUsers.get(user.id)} dolayından dolayı afk.`);
        }
    });
});

client.login(process.env.TOKEN);

