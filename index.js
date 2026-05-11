const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot 7/24 Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { afk: {}, yetkiliRoller: [], sayi: {}, tuttu: {}, kelime: {}, ticketCount: 0, sunucuAyarlar: {} };

if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} YETKİLER DÜZELTİLDİ!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- AFK SİSTEMİ (HERKES) ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.reply(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.reply(`👋 Hoş geldin **${message.author.username}**, AFK bitti.`);
    }

    // --- KOMUTLAR ---
    if (!message.content.startsWith(prefix) && message.content !== '/setup') return;
    const args = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim().split(/ +/) : message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- YETKİ KONTROLÜ (GÜNCELLENMİŞ) ---
    // Sunucu sahibiysen veya Yöneticiliğin varsa HER ŞEYİ yapabilirsin.
    const isOwner = message.author.id === message.guild.ownerId;
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
    const canUse = isOwner || isAdmin || isStaff;

    // --- GENEL (YETKİSİZ) ---
    if (command === 'komutlar') {
        const embed = new EmbedBuilder().setTitle('🛡️ MEM | Komutlar').setColor('Green').addFields(
            { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`' },
            { name: '🛡️ Moderasyon', value: '`ban`, `kick`, `mute`, `unmute`, `sil`, `lock`, `unlock`, `yetkilisec`' },
            { name: '🎮 Oyunlar', value: '`sayısaymaca`, `kelimeoyunu`, `tuttututmadı`' }
        );
        return message.reply({ embeds: [embed] });
    }
    if (command === 'owner') return message.reply(`👑 Sahibi: <@${message.guild.ownerId}>`);
    if (command === 'avatar') return message.reply((message.mentions.users.first() || message.author).displayAvatarURL({ size: 1024 }));
    if (command === 'afk') { botVerisi.afk[message.author.id] = args.join(" ") || "Meşgul"; veriKaydet(); return message.reply("✅ AFK modundasın."); }

    // --- YETKİLİ KONTROLÜ BAŞLANGICI ---
    if (!canUse) return; // Buradan aşağısını yetkisi olmayan göremez.

    if (command === 'yetkilisec') {
        const roller = message.mentions.roles;
        if (roller.size === 0) return message.reply("❌ Rol etiketle!");
        botVerisi.yetkiliRoller = roller.map(r => r.id);
        veriKaydet();
        return message.reply(`✅ Yetkililer güncellendi.`);
    }

    if (command === 'sil') {
        const s = parseInt(args[0]);
        if (s > 0 && s <= 100) {
            await message.channel.bulkDelete(s, true);
            return message.channel.send(`✅ ${s} mesaj silindi.`).then(m => setTimeout(() => m.delete(), 2000));
        }
    }

    if (command === 'ban') {
        const u = message.mentions.members.first();
        if (!u) return message.reply("❌ Kimi?");
        await u.ban().then(() => message.reply("✅ Uçuruldu.")).catch(e => message.reply(`❌ Hata: ${e.message}`));
    }

    if (command === 'mute') {
        const m = message.mentions.members.first();
        const d = parseInt(args[1]) || 10;
        if (!m) return message.reply("❌ Kimi?");
        await m.timeout(d * 60 * 1000).then(() => message.reply(`✅ ${d} dk sustu.`)).catch(e => message.reply(`❌ Hata: ${e.message}`));
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply("🔒 Kilitlendi.");
    }
    
    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply("🔓 Açıldı.");
    }

    if (command === 'setup' && isAdmin) {
        // ... (Ticket kurulum kodları)
        message.reply("🛠️ Setup çalışıyor, kanala bak.");
    }

    // Oyunlar
    if (['sayısaymaca', 'tuttututmadı', 'kelimeoyunu'].includes(command)) {
        const k = message.mentions.channels.first();
        if (!k) return message.reply("❌ Kanal?");
        if (command === 'sayısaymaca') botVerisi.sayi[k.id] = { sonSayi: 0, sonKullanici: null };
        if (command === 'tuttututmadı') botVerisi.tuttu[k.id] = true;
        if (command === 'kelimeoyunu') botVerisi.kelime[k.id] = { sonKelime: "", sonKullanici: null };
        veriKaydet(); return message.reply(`✅ ${command} aktif!`);
    }
});

// --- TICKET INTERACTION (AYNI MANTIK) ---
client.on('interactionCreate', async (i) => {
    if (i.isStringSelectMenu() && i.customId === 'ticket_menu') {
        const ayar = botVerisi.sunucuAyarlar[i.guild.id];
        if(!ayar) return i.reply({content: "Önce /setup yap!", ephemeral: true});
        botVerisi.ticketCount++; veriKaydet();
        const ch = await i.guild.channels.create({
            name: `ticket-${botVerisi.ticketCount}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.ticketRoller.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });
        const b = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_kapat').setLabel('Kapat').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `${i.user} Hoş geldin!`, components: [b] });
        await i.reply({ content: `Bilet: ${ch}`, ephemeral: true });
    }
    if (i.isButton() && i.customId === 'tk_kapat') { await i.reply("Bilet siliniyor..."); setTimeout(() => i.channel.delete(), 2000); }
});

client.login(process.env.TOKEN);

