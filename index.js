const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
let botVerisi = { afk: {}, yetkiliRoller: [] };

// Veriyi dosyadan yükle
if (fs.existsSync('./moderasyon.json')) {
    try { 
        botVerisi = JSON.parse(fs.readFileSync('./moderasyon.json', 'utf8')); 
    } catch (e) { 
        console.log("Veri dosyası okunurken hata oluştu."); 
    }
}

function veriKaydet() { 
    fs.writeFileSync('./moderasyon.json', JSON.stringify(botVerisi, null, 2)); 
}

client.on('ready', () => { 
    console.log(`${client.user.tag} Moderasyon Botu Görevde!`); 
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // AFK Sistemi
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

    // Komut Ayıklama
    if (!message.content.startsWith(prefix) && !message.content.startsWith('/yetkilisec')) return;
    
    const args = message.content.startsWith(prefix) 
        ? message.content.slice(prefix.length).trim().split(/ +/)
        : message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Yetki Kontrol Fonksiyonu
    const yetkiliMi = () => {
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        if (botVerisi.yetkiliRoller.length === 0) return false;
        return message.member.roles.cache.some(role => botVerisi.yetkiliRoller.includes(role.id));
    };

    // --- ÖZEL YETKİLİ SEÇME KOMUTU ---
    if (command === 'yetkilisec') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Lütfen yetkili olacak rolleri etiketleyin! Örn: `/yetkilisec @Moderatör` ");

        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        
        const isimler = roller.map(r => r.name).join(", ");
        return message.reply(`✅ Yetkili rolleri başarıyla güncellendi: **${isimler}**`);
    }

    // Yetkisiz Kullanım Uyarısı (AFK komutu hariç)
    if (command !== 'afk' && !yetkiliMi()) {
        return message.reply("❌ Sen bu sunucuda yetkili değilsin ve yetkili komutlarını kullanamazsın!");
    }

    // --- MODERASYON KOMUTLARI ---

    if (command === 'rolver') {
        const member = message.mentions.members.first();
        const rolIsmi = args.slice(1).join(" ");
        const rol = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolIsmi || r.id === rolIsmi);

        if (!member || !rolIsmi) return message.reply("❌ Kullanım: `mem!rolver @kişi Rolİsmi` ");
        if (!rol) return message.reply(`❌ **${rolIsmi}** rolü bulunamadı.`);

        try {
            await member.roles.add(rol);
            message.reply(`✅ **${member.user.username}** adlı kişiye başarıyla **${rol.name}** adlı rol verildi.`);
        } catch (e) {
            message.reply(`❌ **${member.user.username}** adlı kişiye **${rol.name}** adlı rol **botun yetkisi yetmediği için** verilemedi.`);
        }
    }

    if (command === 'rolal') {
        const member = message.mentions.members.first();
        const rolIsmi = args.slice(1).join(" ");
        const rol = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolIsmi || r.id === rolIsmi);

        if (!member || !rolIsmi) return message.reply("❌ Kullanım: `mem!rolal @kişi Rolİsmi` ");
        if (!rol) return message.reply(`❌ **${rolIsmi}** rolü bulunamadı.`);

        try {
            await member.roles.remove(rol);
            message.reply(`✅ **${member.user.username}** adlı kişiden başarıyla **${rol.name}** adlı rol alındı.`);
        } catch (e) {
            message.reply(`❌ **${member.user.username}** adlı kişiden **${rol.name}** adlı rol **botun yetkisi yetmediği için** alınamadı.`);
        }
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const dakika = parseInt(args[1]);
        if (!member || isNaN(dakika)) return message.reply("❌ Kullanım: `mem!mute @üye [dakika]` ");
        try {
            await member.timeout(dakika * 60 * 1000);
            message.reply(`✅ **${member.user.tag}** tam **${dakika}** dakika susturuldu.`);
        } catch (e) { message.reply("❌ Yetkim yetmiyor."); }
    }

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (!member) return;
        await member.timeout(null);
        message.reply(`✅ **${member.user.tag}** mutesi kaldırıldı.`);
    }

    if (command === 'unban') {
        const userId = args[0];
        if (!userId) return message.reply("❌ Banı açılacak kişinin ID'sini yaz!");
        try {
            await message.guild.members.unban(userId);
            message.reply(`✅ ID: **${userId}** olan kullanıcının banı kaldırıldı.`);
        } catch (e) { message.reply("❌ Ban kaldırılamadı."); }
    }

    if (command === 'sil') {
        let sayi = parseInt(args[0]);
        if (!sayi || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası sayı gir!");
        await message.channel.bulkDelete(sayi, true);
        message.channel.send(`✅ **${sayi}** mesaj silindi.`).then(m => setTimeout(() => m.delete(), 5000));
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        if (!user) return;
        try {
            await message.guild.members.ban(user);
            message.reply(`✅ ${user.tag} yasaklandı.`);
        } catch(e) { message.reply("❌ Yetkim yetmiyor."); }
    }

    if (command === 'kick') {
        const user = message.mentions.users.first();
        if (!user) return;
        try {
            await message.guild.members.kick(user);
            message.reply(`✅ ${user.tag} atıldı.`);
        } catch(e) { message.reply("❌ Yetkim yetmiyor."); }
    }

    if (command === 'lock') {
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply("🔒 Kanal kilitlendi.");
    }

    if (command === 'unlock') {
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
        message.reply("🔓 Kanal açıldı.");
    }

    if (command === 'afk') {
        const sebep = args.join(" ") || "Meşgul";
        botVerisi.afk[message.author.id] = sebep;
        veriKaydet();
        message.reply(`✅ AFK moduna girdin: **${sebep}**`);
    }
});

client.login(process.env.TOKEN);
