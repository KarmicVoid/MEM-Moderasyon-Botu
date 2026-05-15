const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// --- 7/24 AKTİF TUTMA SİSTEMİ ---
const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot 7/24 Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { uyarilar: {}, ticketCount: 0, sunucuAyarlar: {}, sayi: {}, kelime: {}, tuttu: {}, yetkiliRoller: [], afk: {} };

// Veritabanı Dosyası Yükleme
if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası yükleme hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} | TÜM SİSTEMLER EKSİKSİZ AKTİF!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- 1. KORUMALI OYUN MOTORLARI ---
    // Sayı Saymaca Korunmuş Kanal Kontrolü
    if (botVerisi.sayi[message.channel.id]) {
        const d = botVerisi.sayi[message.channel.id];
        const n = parseInt(message.content);
        if (isNaN(n)) {
            await message.delete();
            return message.channel.send(`⚠️ ${message.author}, sadece sayı yaz!`).then(m => setTimeout(() => m.delete(), 2000));
        }
        if (n === d.sonSayi + 1 && message.author.id !== d.sonKullanici) {
            botVerisi.sayi[message.channel.id] = { sonSayi: n, sonKullanici: message.author.id };
            return message.react('✅');
        } else {
            message.reply(`❌ Sıra bozuldu! Sayı: **${d.sonSayi + 1}** olmalıydı. Oyun sıfırlandı! Başlangıç: 1`);
            botVerisi.sayi[message.channel.id] = { sonSayi: 0, sonKullanici: null };
            return veriKaydet();
        }
    }

    // --- 2. AFK SİSTEMİ ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.channel.send(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.channel.send(`👋 Hoş geldin **${message.author.username}**, AFK modun kapatıldı.`);
    }

    // --- 3. /SETUP TICKET KURULUM KOMUTU ---
    if (message.content === '/setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("❌ Bu kurulumu sadece yöneticiler yapabilir.");

        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("1️⃣ **Ticket panelinin kurulacağı kanalı etiketle (#kanal):**");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const pKanal = q1.first().mentions.channels.first();
            if (!pKanal) return message.reply("❌ Kanal etiketlemedin, iptal edildi.");

            await message.reply("2️⃣ **Ticket yetkilisi rollerini etiketle (@rol):**");
            const q2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const pRoller = q2.first().mentions.roles.map(r => r.id);
            if (pRoller.length === 0) return message.reply("❌ Rol etiketlemedin, iptal edildi.");

            await message.reply("3️⃣ **Transcript (Log) kanalını etiketle (#kanal):**");
            const q3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const pLog = q3.first().mentions.channels.first();
            if (!pLog) return message.reply("❌ Log kanalı etiketlemedin, iptal edildi.");

            botVerisi.sunucuAyarlar[message.guild.id] = { panelKanal: pKanal.id, yetkiliRoller: pRoller, logKanal: pLog.id };
            veriKaydet();

            const panelEmbed = new EmbedBuilder()
                .setTitle("🎫 Destek Sistemi")
                .setDescription("Aşağıda bulunan **\"Kategori Seç...\"** butonuna basarak yaşadığınız sorun hakkında olan kategoriye basarak ticket oluşturabilirsiniz.")
                .setColor("Blue");

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_kategori')
                    .setPlaceholder('Kategori seç...')
                    .addOptions([
                        { label: 'Partner İletişim', value: 'partner', emoji: '🤝' },
                        { label: 'Şikayet ve Geri Bildirim', value: 'sikayet', emoji: '📢' },
                        { label: 'Yetkililerle İletişim', value: 'yetkili', emoji: '👨‍✈️' },
                        { label: 'İstek ve Öneriler', value: 'istek', emoji: '💡' },
                        { label: 'Hata ve Bug Bildirimleri', value: 'bug', emoji: '🐛' }
                    ])
            );

            await pKanal.send({ embeds: [panelEmbed], components: [menu] });
            return message.reply("✅ Ticket sistemi başarıyla kuruldu!");
        } catch (e) { return message.reply("❌ Zaman aşımı veya kurulum hatası oluştu."); }
    }

    // --- 4. PREFIX'Lİ KOMUT KONTROLÜ ---
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Komut Havuzu Kontrolü (Hatalı komut uyarısı için)
    const tumKomutlar = ['komutlar', 'afk', 'owner', 'avatar', 'mute', 'unmute', 'ban', 'kick', 'sil', 'lock', 'unlock', 'uyarı', 'rolver', 'rolal', 'yetkilisec', 'sayısaymaca', 'ship'];
    if (!tumKomutlar.includes(command)) return message.reply(`❌ \`${prefix}${command}\` komutu bulunamadı.`);

    // 'ship', 'komutlar', 'afk', 'avatar', 'owner' komutları herkese açık olsun; diğer moderasyon komutları yetki istesin.
    const genelKomutlar = ['ship', 'komutlar', 'afk', 'avatar', 'owner'];
    if (!genelKomutlar.includes(command)) {
        const canUse = message.member.permissions.has(PermissionFlagsBits.Administrator) || botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));
        if (!canUse) return message.reply("❌ Bu komutu kullanmak için yetkiniz bulunmuyor.");
    }

    // --- SHIP KOMUTU (RESİMLİ VE TERMOMETRELİ) ---
    if (command === 'ship') {
        const mList = await message.guild.members.fetch();
        const baskaUyeler = mList.filter(m => !m.user.bot && m.id !== message.author.id);
        if (baskaUyeler.size === 0) return message.reply("❌ Sunucuda shiplenebilecek başka kimse yok!");

        const shipKisi = baskaUyeler.random().user;
        const askYuzdesi = Math.floor(Math.random() * 101);

        const sozler = [
            "Bu aşk tarihe yazılır, mükemmel uyum! ❤️", "Fena değil, aranızda tatlı bir elektrik var. ✨",
            "Biraz zor ama imkansız değil sanki? 🤔", "Gözlerinizden kalpler fışkırıyor resmen! 😍",
            "Arkadaş kalsanız iki taraf için de daha hayırlı gibi... 🥶", "Kaderiniz birbirine yazılmış, net! 🕊️"
        ];
        let soz = askYuzdesi > 80 ? sozler[0] : (askYuzdesi > 60 ? sozler[3] : (askYuzdesi > 40 ? sozler[1] : (askYuzdesi > 20 ? sozler[2] : sozler[4])));

        const canvas = createCanvas(600, 250);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#232428'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        try {
            const av1 = await loadImage(message.author.displayAvatarURL({ extension: 'png', size: 128 }));
            const av2 = await loadImage(shipKisi.displayAvatarURL({ extension: 'png', size: 128 }));

            ctx.save(); ctx.beginPath(); ctx.arc(100, 125, 60, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(av1, 40, 65, 120, 120); ctx.restore();
            ctx.save(); ctx.beginPath(); ctx.arc(500, 125, 60, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(av2, 440, 65, 120, 120); ctx.restore();

            // Aşk Ölçer Termometre Çizimi
            ctx.fillStyle = '#4f545c'; ctx.roundRect(285, 50, 30, 120, 15); ctx.fill();
            ctx.beginPath(); ctx.arc(300, 180, 25, 0, Math.PI * 2); ctx.fill();

            const red = Math.floor((askYuzdesi / 100) * 255);
            ctx.fillStyle = `rgb(${red}, 0, ${255 - red})`;
            const doluluk = (askYuzdesi / 100) * 120;
            ctx.roundRect(288, 170 - doluluk, 24, doluluk, 10); ctx.fill();
            ctx.beginPath(); ctx.arc(300, 180, 20, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(`%${askYuzdesi}`, 300, 235);

            const attachment = new AttachmentBuilder(await canvas.toBuffer(), { name: 'ship.png' });
            return message.reply({ content: `💞 ${message.author} artık **${shipKisi}** ile shiplendi!\n💘 **Aşk Seviyesi:** %${askYuzdesi}\n💬 *"${soz}"*`, files: [attachment] });
        } catch (e) {
            return message.reply(`💞 ${message.author} ve **${shipKisi}** shiplendi! \n💘 **Aşk Seviyesi:** %${askYuzdesi}\n💬 *"${soz}"*`);
        }
    }

    // --- KİLİT KOMUTLARI ---
    if (command === 'lock') {
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply("🔒 Kanal yetkililer dışındakilere kilitlendi.");
        } catch (e) { return message.reply("❌ Kanal kilitlenirken bir hata oluştu."); }
    }

    if (command === 'unlock') {
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply("🔓 Kanal kilidi başarıyla açıldı.");
        } catch (e) { return message.reply("❌ Kanal kilidi açılırken bir hata oluştu."); }
    }

    // --- YARDIM MENÜSÜ ---
    if (command === 'komutlar') {
        const helpEmbed = new EmbedBuilder().setTitle('🛡️ MEM Bot Komut Paneli').setColor('Blue').addFields(
            { name: '👤 Genel', value: '`afk`, `owner`, `avatar`, `komutlar`, `ship`' },
            { name: '🛡️ Moderasyon', value: '`ban`, `kick`, `mute`, `unmute`, `uyarı`, `sil`, `lock`, `unlock`, `yetkilisec`' },
            { name: '🎮 Oyun Ayar', value: '`sayısaymaca`' },
            { name: '🎫 Destek', value: '`/setup`' }
        );
        return message.reply({ embeds: [helpEmbed] });
    }

    // --- MODERASYON KOMUT GÖVDELERİ ---
    if (command === 'ban') {
        const user = message.mentions.users.first();
        const reason = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!user) return message.reply("❌ Yasaklanacak üyeyi etiketleyin.");
        try {
            await user.send(`🚫 **${message.guild.name}** sunucusundan yasaklandınız. Sebep: ${reason}`).catch(() => {});
            await message.guild.members.ban(user, { reason });
            return message.reply(`✅ **${user.tag}** sunucudan başarıyla yasaklandı.`);
        } catch (e) { return message.reply("❌ Bu üyeyi yasaklamak için yetkim yetmiyor."); }
    }

    if (command === 'kick') {
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Atılacak üyeyi etiketleyin.");
        try {
            await member.send(`🚪 **${message.guild.name}** sunucusundan atıldınız. Sebep: ${reason}`).catch(() => {});
            await member.kick(reason);
            return message.reply(`✅ **${member.user.tag}** sunucudan başarıyla atıldı.`);
        } catch (e) { return message.reply("❌ Bu üyeyi atmak için yetkim yetmiyor."); }
    }

    if (command === 'mute') {
        const member = message.mentions.members.first();
        const sure = parseInt(args[1]);
        const reason = args.slice(2).join(" ") || "Sebep belirtilmedi";
        if (!member || isNaN(sure)) return message.reply("❌ Kullanım: `mem!mute @kişi [dakika] [sebep]`");
        try {
            await member.timeout(sure * 60 * 1000, reason);
            await member.send(`🔇 **${message.guild.name}** sunucusunda ${sure} dakika susturuldunuz. Sebep: ${reason}`).catch(() => {});
            return message.reply(`✅ **${member.user.tag}** ${sure} dakika boyunca susturuldu.`);
        } catch (e) { return message.reply("❌ Susturma işlemi başarısız oldu, yetkilerimi kontrol edin."); }
    }

    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Susturması açılacak üyeyi etiketleyin.");
        try {
            await member.timeout(null);
            return message.reply(`✅ **${member.user.tag}** kullanıcısının susturması kaldırıldı.`);
        } catch (e) { return message.reply("❌ Susturma kaldırılamadı."); }
    }

    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ Lütfen 1-100 arasında silinecek mesaj sayısı girin.");
        await message.channel.bulkDelete(sayi, true);
        return message.channel.send(`✅ **${sayi}** adet mesaj temizlendi.`).then(m => setTimeout(() => m.delete(), 3000));
    }

    if (command === 'uyarı') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
        if (!member) return message.reply("❌ Lütfen birini etiketleyin.");
        if (!botVerisi.uyarilar[member.id]) botVerisi.uyarilar[member.id] = [];
        botVerisi.uyarilar[member.id].push({ sebep, yetkili: message.author.tag });
        const count = botVerisi.uyarilar[member.id].length;
        veriKaydet();
        const emb = new EmbedBuilder().setTitle("⚠️ Uyarı Kaydı").setColor("Orange").addFields(
            { name: "Kişi", value: member.user.tag, inline: true }, { name: "Sıra", value: `${count}. Uyarı`, inline: true }, { name: "Sebep", value: sebep }
        );
        await member.send({ embeds: [emb] }).catch(() => {});
        return message.reply({ embeds: [emb] });
    }

    if (command === 'rolver') {
        const member = message.mentions.members.first();
        const rolInput = args.slice(1).join(" ");
        const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolInput);
        if (!member || !role) return message.reply("❌ Kullanım: `mem!rolver @kişi @rol`");
        await member.roles.add(role);
        return message.reply(`✅ **${member.user.tag}** kişisine **${role.name}** rolü verildi.`);
    }

    if (command === 'rolal') {
        const member = message.mentions.members.first();
        const rolInput = args.slice(1).join(" ");
        const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name === rolInput);
        if (!member || !role) return message.reply("❌ Kullanım: `mem!rolal @kişi @rol`");
        await member.roles.remove(role);
        return message.reply(`✅ **${member.user.tag}** kişisinden **${role.name}** rolü geri alındı.`);
    }

    if (command === 'yetkilisec') {
        const role = message.mentions.roles.first();
        if (!role) return message.reply("❌ Bir rol etiketlemelisiniz.");
        if (!botVerisi.yetkiliRoller.includes(role.id)) botVerisi.yetkiliRoller.push(role.id);
        veriKaydet();
        return message.reply(`✅ **${role.name}** rolü bot yetkilisi olarak sisteme eklendi.`);
    }

    if (command === 'sayısaymaca') {
        const kanal = message.mentions.channels.first() || message.channel;
        botVerisi.sayi[kanal.id] = { sonSayi: 0, sonKullanici: null };
        veriKaydet();
        return message.reply(`✅ Sayı saymaca oyun kanalı ${kanal} olarak ayarlandı ve 1'den başlatıldı.`);
    }

    if (command === 'afk') {
        const sebep = args.join(" ") || "Belirtilmedi";
        botVerisi.afk[message.author.id] = sebep; veriKaydet();
        return message.reply(`📌 Başarıyla AFK moduna girdiniz. Sebep: **${sebep}**`);
    }

    if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        return message.reply(`${user.displayAvatarURL({ dynamic: true, size: 1024 })}`);
    }

    if (command === 'owner') {
        return message.reply(`👑 Sunucu Sahibi: <@${message.guild.ownerId}>`);
    }
});

// --- 5. INTERACTION ETKİLEŞİMLERİ (TICKET PANEL AÇMA - KAPATMA MENÜSÜ) ---
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const ayar = botVerisi.sunucuAyarlar[i.guild.id];
    if (!ayar) return;

    // Menüden Kategori Seçip Profesyonel Ticket Kanalı Açma
    if (i.isStringSelectMenu() && i.customId === 'ticket_kategori') {
        botVerisi.ticketCount++; veriKaydet();
        const secilenKat = i.values[0];

        const channel = await i.guild.channels.create({
            name: `${secilenKat}-${i.user.username}`,
            type: ChannelType.GuildText,
            topic: i.user.id, // Bilet açan kişinin ID'sini buraya gizliyoruz (Transcript için hayati)
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.yetkiliRoller.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });

        const welcomeEmbed = new EmbedBuilder()
            .setColor("Green")
            .setDescription(`Merhaba ${i.user}, En yakın zamanda yetkililerimiz senle ilgilenecektir, lütfen sorununu anlat.\n\n**Yetkililer:** ${ayar.yetkiliRoller.map(r => `<@&${r}>`).join(", ")}`);

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_kapat_menusu').setLabel('Ticketi Kapat').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${i.user} | ${ayar.yetkiliRoller.map(r => `<@&${r}>`).join(" ")}`, embeds: [welcomeEmbed], components: [closeBtn] });
        return i.reply({ content: `✅ Biletiniz başarıyla oluşturuldu: ${channel}`, ephemeral: true });
    }

    // Kapat butonuna basıldığında Sebep Seçme Menüsünün gelmesi
    if (i.isButton() && i.customId === 'tk_kapat_menusu') {
        const reasonMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('tk_final_kapat')
                .setPlaceholder('Biletin kapatılma sebebini seçiniz...')
                .addOptions([
                    { label: 'Sorun Çözüldü', value: 'Sorun Çözüldü ✅', emoji: '✅' },
                    { label: 'Geçersiz / Gereksiz Talep', value: 'Geçersiz Talep ❌', emoji: '❌' },
                    { label: 'Kullanıcı Odadan Ayrıldı/Yanıtsız', value: 'Kullanıcı Yanıtsızlığı ⏰', emoji: '⏰' },
                    { label: 'Vardiya Sonu Kapatıldı', value: 'Vardiya Sonu Kapanışı 🔒', emoji: '🔒' }
                ])
        );
        return i.reply({ content: "⚠️ Bu ticket kapatılacak. Lütfen sistem kaydı (Transcript) için geçerli bir kapatma sebebi seçin:", components: [reasonMenu] });
    }

    // Sebebe Basıldığında Log Atıp Kanalı Silen Final Bölümü
    if (i.isStringSelectMenu() && i.customId === 'tk_final_kapat') {
        const secilenSebep = i.values[0];
        const acanKisiId = i.channel.topic; // Topic'e sakladığımız id'yi geri okuyoruz
        const logKanal = i.guild.channels.cache.get(ayar.logKanal);

        // Mesajları çekip txt dosyasına dökme işlemi
        const messages = await i.channel.messages.fetch({ limit: 100 });
        const logString = messages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
        const attachment = new AttachmentBuilder(Buffer.from(logString), { name: `transcript-${i.channel.name}.txt` });

        const logEmbed = new EmbedBuilder()
            .setTitle("🔒 Bir Destek Bileti Kapatıldı")
            .setColor("Red")
            .addFields(
                { name: "🎫 Bileti Açan Üye", value: acanKisiId ? `<@${acanKisiId}>` : "`Bilinmiyor`", inline: true },
                { name: "👮 Kapatan Yetkili", value: `${i.user}`, inline: true },
                { name: "📝 Kapatılma Nedeni", value: `**${secilenSebep}**` }
            )
            .setTimestamp();

        if (logKanal) {
            await logKanal.send({ embeds: [logEmbed], files: [attachment] });
        }

        await i.reply("🔒 Kapatma sebebi onaylandı. Bilet kanalı 5 saniye içinde tamamen yok ediliyor...");
        return setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
});

client.login(process.env.TOKEN);
