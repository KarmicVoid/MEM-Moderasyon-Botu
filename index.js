const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- RENDER PORT HATASI ÇÖZÜMÜ ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('MEM Moderasyon Botu Aktif!'));
app.listen(port, () => console.log(`Port ${port} dinleniyor.`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Ayarlar dosyası kontrolü
let sunucuVerisi = {};
const dosyaYolu = './ayarlar.json';
if (fs.existsSync(dosyaYolu)) {
    sunucuVerisi = JSON.parse(fs.readFileSync(dosyaYolu, 'utf8'));
}

function veriKaydet() {
    fs.writeFileSync(dosyaYolu, JSON.stringify(sunucuVerisi, null, 2));
}

let afkKullanicilar = new Map();

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    // AFK Sistemi
    if (afkKullanicilar.has(message.author.id)) {
        afkKullanicilar.delete(message.author.id);
        message.reply(`Hoş geldin! Başarıyla AFK modundan çıktın. 👋`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (afkKullanicilar.has(user.id)) {
                const data = afkKullanicilar.get(user.id);
                message.reply(`**${user.username}** adlı kullanıcı **${data.sebep}** sebebiyle şu an AFK.`).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
            }
        });
    }

    const ayar = sunucuVerisi[message.guild.id];
    const yetkiliMi = message.member.permissions.has(PermissionFlagsBits.Administrator) || 
                     (ayar?.modRolleri && message.member.roles.cache.some(r => ayar.modRolleri.includes(r.id)));

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    // /yetkilisec
    if (command === '/yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply('❌ Lütfen rolleri etiketleyin.');
        
        sunucuVerisi[message.guild.id] = { ...ayar, modRolleri: roller.map(r => r.id) };
        veriKaydet();
        return message.reply(`Harika, **${roller.map(r => r.name).join(', ')}** adlı roller artık Moderatör komutlarını kullanabilecek.`);
    }

    // MODERASYON KOMUTLARI
    if (command === 'mem!ban') {
        if (!yetkiliMi) return;
        const user = message.mentions.users.first();
        const sebep = args.slice(2).join(' ') || 'Belirtilmedi';
        if (!user) return message.reply('❌ Kullanıcı etiketle!');
        await user.send(`⚠️ **${message.guild.name}** sunucusundan **${sebep}** sebebiyle banlandınız!`).catch(() => {});
        await message.guild.members.ban(user, { reason: sebep });
        message.reply(`✅ **${user.tag}** başarıyla banlandı.`);
    }

    if (command === 'mem!kick') {
        if (!yetkiliMi) return;
        const member = message.mentions.members.first();
        const sebep = args.slice(2).join(' ') || 'Belirtilmedi';
        if (!member) return message.reply('❌ Kullanıcı etiketle!');
        await member.send(`⚠️ **${message.guild.name}** sunucusundan **${sebep}** sebebiyle atıldınız!`).catch(() => {});
        await member.kick(sebep);
        message.reply(`✅ **${member.user.tag}** başarıyla atıldı.`);
    }

    if (command === 'mem!mute') {
        if (!yetkiliMi) return;
        const member = message.mentions.members.first();
        const sure = parseInt(args[2]); 
        const sebep = args.slice(3).join(' ') || 'Belirtilmedi';
        if (!member || !sure) return message.reply('❌ `mem!mute @kullanıcı [dakika] [sebep]`');
        await member.timeout(sure * 60 * 1000, sebep);
        await member.send(`⚠️ **${message.guild.name}** sunucusunda **${sebep}** sebebiyle **${sure}** dakika susturuldunuz!`).catch(() => {});
        message.reply(`✅ **${member.user.tag}** ${sure} dakika susturuldu.`);
    }

    if (command === 'mem!lock') {
        if (!yetkiliMi) return;
        message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        message.reply('🔒 Kanal kilitlendi.');
    }

    if (command === 'mem!unlock') {
        if (!yetkiliMi) return;
        message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
        message.reply('🔓 Kanal açıldı.');
    }

    if (command === 'mem!duyuru') {
        if (!yetkiliMi) return;
        const kanal = message.mentions.channels.first();
        const duyuruMesaji = args.slice(2).join(' ');
        if (!kanal || !duyuruMesaji) return;
        const embed = new EmbedBuilder().setTitle('📣 Duyuru').setDescription(duyuruMesaji).setColor('Red');
        kanal.send({ embeds: [embed] });
        message.reply('✅ Duyuru gönderildi.');
    }

    if (command === 'mem!uyarı') {
        if (!yetkiliMi) return;
        const user = message.mentions.users.first();
        const sebep = args.slice(2).join(' ') || 'Belirtilmedi';
        if (!user) return;
        await user.send(`⚠️ **${message.guild.name}** sunucusunda **${sebep}** sebebiyle uyarıldınız!`).catch(() => {});
        message.reply(`✅ **${user.tag}** uyarıldı.`);
    }

    if (command === 'mem!afk') {
        const sebep = args.slice(1).join(' ') || 'Belirtilmedi';
        afkKullanicilar.set(message.author.id, { sebep: sebep });
        message.reply(`✅ AFK moduna geçtin: **${sebep}**`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
});

client.login(process.env.TOKEN);
