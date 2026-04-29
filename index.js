express();
const port = 3000;

app.get('/', (req, res) => res.send('Bot aktif!'));
app.listen(port, () => console.log(`Bot port ${port} üzerinde çalışıyor.`));
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
            message


