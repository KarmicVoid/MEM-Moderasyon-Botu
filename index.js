const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const fs = require('fs');
const express = require('express');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// --- 7/24 AKTİF TUTMA SİSTEMİ ---
const app = express();
app.get('/', (req, res) => res.send('MEM Süper Bot 7/24 Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const prefix = "mem!";
let botVerisi = { 
    uyarilar: {}, 
    ticketCount: 0, 
    sunucuAyarlar: {}, 
    sayi: {}, 
    kelime: {}, 
    tuttu: {}, 
    yetkiliRoller: [], 
    afk: {}, 
    linkEngel: {},
    cekilisler: {},
    davetler: {}, 
    modLogKanallari: {}, 
    girisCikisKanallari: {} 
};

if (fs.existsSync('./database.json')) {
    try { botVerisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { console.log("Veri dosyası yükleme hatası."); }
}
function veriKaydet() { fs.writeFileSync('./database.json', JSON.stringify(botVerisi, null, 2)); }

// --- DAVET TAKİP MOTORU ---
const sunucuDavetleri = new Map();

client.on('ready', async () => {
    console.log(`${client.user.tag} | TÜM SİSTEMLER AKTİF!`);
    
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const invites = await guild.invites.fetch();
            sunucuDavetleri.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
        } catch (e) { console.log(`${guild.name} sunucusunda davet yetkim yok.`); }
    }

    // Bot açıldığında veritabanındaki aktif çekilişlerin zamanlayıcılarını yeniden başlatır
    if (botVerisi.cekilisler) {
        for (const msgId in botVerisi.cekilisler) {
            const cekilis = botVerisi.cekilisler[msgId];
            if (!cekilis.bitti) {
                const kalanSure = cekilis.bitisTimestamp - Date.now();
                if (kalanSure <= 0) {
                    cekilisBitir(msgId);
                } else {
                    setTimeout(() => { cekilisBitir(msgId); }, kalanSure);
                }
            }
        }
    }
});

client.on('inviteCreate', invite => {
    const amap = sunucuDavetleri.get(invite.guild.id) || new Map();
    amap.set(invite.code, invite.uses);
    sunucuDavetleri.set(invite.guild.id, amap);
});

// --- HOŞ GELDİN SİSTEMİ ---
client.on('guildMemberAdd', async (member) => {
    try {
        const eskiDavetler = sunucuDavetleri.get(member.guild.id);
        const yeniDavetler = await member.guild.invites.fetch();
        sunucuDavetleri.set(member.guild.id, new Map(yeniDavetler.map(inv => [inv.code, inv.uses])));

        let davetEden = null;
        for (const [code, invite] of yeniDavetler) {
            const eskiKullanim = eskiDavetler?.get(code) || 0;
            if (invite.uses > eskiKullanim) {
                davetEden = invite.inviter;
                break;
            }
        }

        let davetMetni = "Bilinmiyor ❌";

        if (davetEden) {
            if (!botVerisi.davetler[member.guild.id]) botVerisi.davetler[member.guild.id] = {};
            if (!botVerisi.davetler[member.guild.id][davetEden.id]) {
                botVerisi.davetler[member.guild.id][davetEden.id] = { sayi: 0, girenler: [], cikanlar: [], tekrarGirenler: [] };
            }

            let dVeri = botVerisi.davetler[member.guild.id][davetEden.id];
            
            if (dVeri.cikanlar.includes(member.user.tag)) {
                if (!dVeri.tekrarGirenler.includes(member.user.tag)) {
                    dVeri.tekrarGirenler.push(member.user.tag);
                }
            } else {
                if (!dVeri.girenler.includes(member.user.tag)) {
                    dVeri.girenler.push(member.user.tag);
                }
            }
            dVeri.sayi++;
            veriKaydet();
            davetMetni = `${davetEden} (**${dVeri.sayi}** davet)`;
        }

        const hgKanalId = botVerisi.girisCikisKanallari[member.guild.id];
        if (hgKanalId) {
            const hgKanal = member.guild.channels.cache.get(hgKanalId);
            if (hgKanal) {
                const hgEmbed = new EmbedBuilder()
                    .setTitle("📥 Aramıza Yeni Biri Katıldı!")
                    .setDescription(`Hoş geldin ${member}! Seninle birlikte **${member.guild.memberCount}** kişi olduk.\n\n👤 Davet Eden: ${davetMetni}`)
                    .setColor("Green")
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                hgKanal.send({ embeds: [hgEmbed] });
            }
        }
    } catch (e) { console.log(e); }
});

// --- HOŞ ÇAKAL SİSTEMİ ---
client.on('guildMemberRemove', async (member) => {
    try {
        const gId = member.guild.id;
        if (botVerisi.davetler[gId]) {
            for (const davetciId in botVerisi.davetler[gId]) {
                let dVeri = botVerisi.davetler[gId][davetciId];
                if (dVeri.girenler.includes(member.user.tag)) {
                    dVeri.girenler = dVeri.girenler.filter(u => u !== member.user.tag);
                    if (!dVeri.cikanlar.includes(member.user.tag)) dVeri.cikanlar.push(member.user.tag);
                    dVeri.sayi = Math.max(0, dVeri.sayi - 1);
                    veriKaydet();
                    break;
                }
            }
        }

        const hcKanalId = botVerisi.girisCikisKanallari[gId];
        if (hcKanalId) {
            const hcKanal = member.guild.channels.cache.get(hcKanalId);
            if (hcKanal) {
                const hcEmbed = new EmbedBuilder()
                    .setTitle("📤 Bir Üye Aramızdan Ayrıldı")
                    .setDescription(`Görüşmek üzere **${member.user.tag}**! Sunucumuz artık **${member.guild.memberCount}** kişi.`)
                    .setColor("Red")
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                hcKanal.send({ embeds: [hcEmbed] });
            }
        }
    } catch (e) { console.log(e); }
});

// --- MODERN LOG MOTORU ---
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    const logKanalId = botVerisi.modLogKanallari[message.guild.id];
    if (!logKanalId) return;
    const logKanal = message.guild.channels.cache.get(logKanalId);
    if (!logKanal) return;

    const embed = new EmbedBuilder()
        .setTitle("🗑️ Mesaj Silindi")
        .setColor("Red")
        .addFields(
            { name: "Yazan Kullanıcı", value: `${message.author} (${message.author.id})` },
            { name: "Kanal", value: `${message.channel}` },
            { name: "Silinen İçerik", value: message.content || "_İçerik tespit edilemedi (Fotoğraf/Ek olabilir)_" }
        )
        .setTimestamp();
    logKanal.send({ embeds: [embed] }).catch(() => {});
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logKanalId = botVerisi.modLogKanallari[oldMessage.guild.id];
    if (!logKanalId) return;
    const logKanal = oldMessage.guild.channels.cache.get(logKanalId);
    if (!logKanal) return;

    const embed = new EmbedBuilder()
        .setTitle("📝 Mesaj Düzenlendi")
        .setColor("Orange")
        .addFields(
            { name: "Yazan Kullanıcı", value: `${oldMessage.author}` },
            { name: "Kanal", value: `${oldMessage.channel}` },
            { name: "Eski Mesaj", value: oldMessage.content || "_Boş_" },
            { name: "Yeni Mesaj", value: newMessage.content || "_Boş_" }
        )
        .setTimestamp();
    logKanal.send({ embeds: [embed] }).catch(() => {});
});

// --- ÇEKİLİŞ SONUÇLANDIRMA FONKSİYONU ---
async function cekilisBitir(mesajId) {
    const cekilis = botVerisi.cekilisler?.[mesajId];
    if (!cekilis || cekilis.bitti) return;

    cekilis.bitti = true;
    veriKaydet();

    const kanal = client.channels.cache.get(cekilis.kanalId);
    if (!kanal) return;

    try {
        const mesaj = await kanal.messages.fetch(mesajId);
        
        // Butonu devre dışı bırak
        const kapaliButon = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cekilis_katil_bitti').setEmoji('🎉').setStyle(ButtonStyle.Primary).setDisabled(true)
        );

        if (cekilis.katilanlar.length === 0) {
            const iptalEmbed = EmbedBuilder.from(mesaj.embeds[0])
                .setColor("Grey")
                .setTitle("❌ ÇEKİLİŞ SONUÇLANDI (Katılım Yetersiz)")
                .setDescription("Çekilişe hiç katılan olmadığı için kazanan seçilemedi.");
            await mesaj.edit({ embeds: [iptalEmbed], components: [kapaliButon] });
            return kanal.send(`⚠️ **${cekilis.odul}** çekilişine katılan olmadığı için kazanan seçilemedi! Başlatan: <@${cekilis.baslatan}>`);
        }

        // Rastgele kazananları karıştırıp seçme işlemi
        const kazanacaklar = [];
        const katilanKopyasi = [...cekilis.katilanlar];
        const cekilecekKisiSayisi = Math.min(cekilis.kazananSayisi, katilanKopyasi.length);

        for (let i = 0; i < cekilecekKisiSayisi; i++) {
            const randIndex = Math.floor(Math.random() * katilanKopyasi.length);
            kazanacaklar.push(katilanKopyasi.splice(randIndex, 1)[0]);
        }

        const etiketlenenKazananlar = kazanacaklar.map(id => `<@${id}>`).join(', ');

        const bitisEmbed = EmbedBuilder.from(mesaj.embeds[0])
            .setColor("Green")
            .setTitle("🎉 ÇEKİLİŞ SONUÇLANDI 🎉")
            .addFields({ name: "🏆 Kazanan(lar):", value: etiketlenenKazananlar });

        await mesaj.edit({ embeds: [bitisEmbed], components: [kapaliButon] });

        // Kazananı tebrik eden ve başlatanı etiketleyen mesaj
        return kanal.send(`🥳 **Tebrikler!** ${etiketlenenKazananlar} çekilişi kazandınız!\n🎁 Ödülünüz: **${cekilis.odul}**\n👑 Çekilişi Başlatan: <@${cekilis.baslatan}>`);

    } catch (e) { console.log("Çekiliş bitirme hatası:", e); }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const canUse = message.member.permissions.has(PermissionFlagsBits.Administrator) || botVerisi.yetkiliRoller.some(r => message.member.roles.cache.has(r));

    if (botVerisi.linkEngel?.[message.guild.id] && !canUse) {
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        const discordInviteRegex = /(discord\.(gg|io|me|li)\/[^\s]+)/g;
        if (linkRegex.test(message.content) || discordInviteRegex.test(message.content) || message.attachments.size > 0) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, bu sunucuda link veya dosya paylaşımı yasaktır!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    if (botVerisi.sayi[message.channel.id]) {
        const d = botVerisi.sayi[message.channel.id];
        const n = parseInt(message.content);
        if (isNaN(n)) {
            await message.delete().catch(() => {});
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

    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (botVerisi.afk?.[user.id]) message.channel.send(`📌 **${user.username}** AFK! Sebep: **${botVerisi.afk[user.id]}**`);
        });
    }
    if (botVerisi.afk?.[message.author.id]) {
        delete botVerisi.afk[message.author.id]; veriKaydet();
        message.channel.send(`👋 Hoş geldin **${message.author.username}**, AFK modun kapatıldı.`);
    }

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

    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const tumKomutlar = ['komutlar', 'afk', 'owner', 'avatar', 'mute', 'unmute', 'ban', 'kick', 'sil', 'lock', 'unlock', 'uyarı', 'rolver', 'rolal', 'yetkilisec', 'sayısaymaca', 'ship', 'duyuru', 'kurallar', 'linkengel-on', 'linkengel-off', 'yavaşmod', 'çekiliş', 'invitesay', 'tuttututmadı', 'logs', 'hoşgeldin', 'hoşçakal'];
    if (!tumKomutlar.includes(command)) return message.reply(`❌ \`${prefix}${command}\` komutu bulunamadı.`);

    const genelKomutlar = ['ship', 'komutlar', 'afk', 'avatar', 'owner', 'tuttututmadı'];
    if (!genelKomutlar.includes(command) && !canUse) {
        return message.reply("❌ Bu komutu kullanmak için yetkiniz (Yönetici veya Yetkili Rol) bulunmuyor.");
    }

    if (command === 'tuttututmadı') {
        const tahmin = args.join(" ");
        if (!tahmin) return message.reply(`❌ Yanlış Kullanım! Örnek: \`${prefix}tuttututmadı Alttaki üye kod yazmayı biliyor.\``);
        const secenekler = ["🟢 TUTTU!", "🔴 TUTMADI!"];
        const sonuc = secenekler[Math.floor(Math.random() * secenekler.length)];
        const tuttuEmbed = new EmbedBuilder()
            .setTitle("🎮 Tuttu mu? Tutmadı mı?")
            .setDescription(`**${message.author.username}** dedi ki:\n"${tahmin}"\n\n**Cevap:** ${sonuc}`)
            .setColor(sonuc.includes("TUTTU") ? "Green" : "Red")
            .setTimestamp();
        return message.reply({ embeds: [tuttuEmbed] });
    }

    if (command === 'logs') {
        const hedefKanal = message.mentions.channels.first() || message.channel;
        botVerisi.modLogKanallari[message.guild.id] = hedefKanal.id;
        veriKaydet();
        return message.reply(`✅ Moderasyon log kanalı başarıyla ${hedefKanal} olarak ayarlandı.`);
    }

    if (command === 'hoşgeldin') {
        const hedefKanal = message.mentions.channels.first() || message.channel;
        botVerisi.girisCikisKanallari[message.guild.id] = hedefKanal.id;
        veriKaydet();
        return message.reply(`✅ Hoş geldin (Giriş) kanalı başarıyla ${hedefKanal} olarak ayarlandı.`);
    }

    if (command === 'hoşçakal') {
        const hedefKanal = message.mentions.channels.first() || message.channel;
        botVerisi.girisCikisKanallari[message.guild.id] = hedefKanal.id;
        veriKaydet();
        return message.reply(`✅ Hoş çakal (Çıkış) kanalı başarıyla ${hedefKanal} olarak ayarlandı.`);
    }

    if (command === 'invitesay') {
        const hedefKullanici = message.mentions.users.first() || message.author;
        const gId = message.guild.id;
        if (!botVerisi.davetler[gId] || !botVerisi.davetler[gId][hedefKullanici.id]) {
            return message.reply(`📊 **${hedefKullanici.username}** kullanıcısının bu sunucuda henüz kayıtlı bir davet verisi bulunmuyor.`);
        }
        const dVeri = botVerisi.davetler[gId][hedefKullanici.id];
        const davetEmbed = new EmbedBuilder()
            .setTitle(`📊 Davet İstatistikleri: ${hedefKullanici.username}`)
            .setColor("Green")
            .setThumbnail(hedefKullanici.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "✨ Toplam Aktif Davet Sayısı", value: `**${dVeri.sayi}** kişi` },
                { name: "📥 Sunucuya Getirdikleri", value: dVeri.girenler.length > 0 ? dVeri.girenler.map(u => `\`${u}\``).join(', ') : "_Kimse yok_" },
                { name: "📤 Sunucudan Çıkanlar", value: dVeri.cikanlar.length > 0 ? dVeri.cikanlar.map(u => `\`${u}\``).join(', ') : "_Kimse yok_" }
            )
            .setTimestamp();
        return message.reply({ embeds: [davetEmbed] });
    }

    // --- YENİLİKÇİ SÜRELİ ÇEKİLİŞ KOMUTU ---
    if (command === 'çekiliş') {
        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("1️⃣ **Çekiliş kaç saniye sürsün?** *(Lütfen sadece sayı yazın, Örn: 60)*");
            const q1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const saniye = parseInt(q1.first().content);
            if (isNaN(saniye) || saniye <= 0) return message.reply("❌ Geçersiz süre girdiniz, işlem iptal edildi.");

            const bitisTimestamp = Date.now() + (saniye * 1000);

            const sartEmbed = new EmbedBuilder()
                .setTitle("🎯 Çekiliş Katılım Şartı")
                .setDescription("Lütfen aşağıdaki butonları kullanarak çekilişin katılım şartını seçiniz:")
                .setColor("Blue");

            const sartButonlar = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sart_invite').setLabel('1. İnvite Şartı').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('sart_rol').setLabel('2. Rol Şartı').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('sart_yok').setLabel('3. Şart Yok').setStyle(ButtonStyle.Success)
            );

            const sartMesaj = await message.reply({ embeds: [sartEmbed], components: [sartButonlar] });
            const butonEtkilesim = await sartMesaj.awaitMessageComponent({ filter: i => i.user.id === message.author.id, time: 30000 });

            let sartTuru = 'yok', sartDetay = 'Herkes Katılabilir';

            if (butonEtkilesim.customId === 'sart_invite') {
                sartTuru = 'invite';
                const modal = new ModalBuilder().setCustomId('modal_invite').setTitle('İnvite Şartı Girişi');
                const inviteInput = new TextInputBuilder().setCustomId('invite_count').setLabel('Gereken davet sayısı?').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inviteInput));
                await butonEtkilesim.showModal(modal);
                const modalSubmit = await butonEtkilesim.awaitModalSubmit({ time: 30000 });
                sartDetay = modalSubmit.fields.getTextInputValue('invite_count');
                await modalSubmit.reply({ content: `✅ İnvite şartı kaydedildi.`, ephemeral: true });
            } 
            else if (butonEtkilesim.customId === 'sart_rol') {
                sartTuru = 'rol';
                const modal = new ModalBuilder().setCustomId('modal_rol').setTitle('Rol Şartı Girişi');
                const rolInput = new TextInputBuilder().setCustomId('rol_id').setLabel('Rol ID girin:').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(rolInput));
                await butonEtkilesim.showModal(modal);
                const modalSubmit = await butonEtkilesim.awaitModalSubmit({ time: 30000 });
                sartDetay = modalSubmit.fields.getTextInputValue('rol_id');
                await modalSubmit.reply({ content: `✅ Rol şartı kaydedildi.`, ephemeral: true });
            } 
            else {
                await butonEtkilesim.reply({ content: "✅ Şartsız olarak devam ediliyor.", ephemeral: true });
            }

            await message.channel.send("3️⃣ **Çekiliş ödülü nedir?**");
            const q4 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const odul = q4.first().content;

            await message.channel.send("4️⃣ **Çekilişi kaç kişi kazanabilir?** *(Örn: 1)*");
            const q5 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const kazananSayisi = parseInt(q5.first().content);
            if (isNaN(kazananSayisi) || kazananSayisi <= 0) return message.channel.send("❌ Hatalı sayı girdiniz.");

            let sartGosterim = sartTuru === 'invite' ? `📩 ${sartDetay} Davet Şartı` : (sartTuru === 'rol' ? `🛡️ <@&${sartDetay}> Rol Şartı` : "✨ Şart Yok");

            const cekilisEmbed = new EmbedBuilder()
                .setTitle("🎉 DEV ÇEKİLİŞ BAŞLADI 🎉")
                .setColor("Blue")
                .setDescription(`Aşağıdaki 🎉 butonuna basarak çekilişe katılabilirsiniz!\nSüre bitince kazanan otomatik açıklanacaktır.`)
                .addFields(
                    { name: "🎁 Çekiliş Ödülü:", value: `**${odul}**` },
                    { name: "🎯 Çekilişe Katılım Şartı:", value: `${sartGosterim}` },
                    { name: "⏰ Bitiş Zamanı:", value: `<t:${Math.floor(bitisTimestamp / 1000)}:R>` },
                    { name: "👥 Kazanacak Kişi Sayısı:", value: `**${kazananSayisi} Üye**` },
                    { name: "👑 Çekilişi Başlatan:", value: `${message.author}` }
                )
                .setTimestamp();

            const katilButon = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cekilis_katil').setEmoji('🎉').setStyle(ButtonStyle.Primary)
            );

            const msg = await message.channel.send({ embeds: [cekilisEmbed], components: [katilButon] });

            if (!botVerisi.cekilisler) botVerisi.cekilisler = {};
            botVerisi.cekilisler[msg.id] = {
                mesajId: msg.id,
                kanalId: message.channel.id,
                odul,
                kazananSayisi,
                sartTuru,
                sartDetay,
                baslatan: message.author.id,
                bitisTimestamp,
                bitti: false,
                katilanlar: []
            };
            veriKaydet();

            // Zamanlayıcıyı Başlat
            setTimeout(() => {
                cekilisBitir(msg.id);
            }, saniye * 1000);

            return message.channel.send("✅ Çekiliş başarıyla oluşturuldu ve zamanlayıcı başlatıldı!");

        } catch (e) { console.log(e); return message.reply("❌ Kurulum esnasında zaman aşımı veya bir hata oluştu."); }
    }

    if (command === 'duyuru') {
        const hedefKanal = message.mentions.channels.first();
        const duyuruMesaji = args.slice(1).join(" ");
        if (!hedefKanal || !duyuruMesaji) return message.reply(`❌ Yanlış Kullanım! Örnek: \`${prefix}duyuru #kanal [Mesaj]\``);
        const duyuruEmbed = new EmbedBuilder().setTitle("📢 YENİ DUYURU").setDescription(duyuruMesaji).setColor("Red").setTimestamp();
        await hedefKanal.send({ embeds: [duyuruEmbed] });
        return message.reply(`✅ Duyuru başarıyla gönderildi.`);
    }

    if (command === 'kurallar') {
        const kurallarEmbed = new EmbedBuilder()
            .setTitle(`📜 ${message.guild.name} Sunucu Kuralları`)
            .setDescription("Sunucu düzeni için lütfen kurallara uyunuz:")
            .setColor("Red")
            .addFields(
                { name: "⚖️ 1. Saygı ve Hoşgörü", value: "Küfür, hakaret ve argo kesinlikle yasaktır." },
                { name: "🚫 2. Reklam ve Spam", value: "Reklam yapmak, spam veya flood yapmak yasaktır." }
            ).setTimestamp();
        return message.channel.send({ content: "@everyone", embeds: [kurallarEmbed] });
    }

    if (command === 'linkengel-on') {
        botVerisi.linkEngel[message.guild.id] = true; veriKaydet();
        return message.reply("✅ Link koruma sistemi aktif edildi!");
    }
    if (command === 'linkengel-off') {
        botVerisi.linkEngel[message.guild.id] = false; veriKaydet();
        return message.reply("❌ Link koruma sistemi kapatıldı.");
    }

    if (command === 'yavaşmod') {
        const sure = parseInt(args[0]);
        if (isNaN(sure) || sure < 0) return message.reply("❌ Geçerli saniye girin.");
        await message.channel.setRateLimitPerUser(sure);
        return message.reply(`⏱️ Kanal yavaş modu **${sure} saniye** yapıldı.`);
    }

    if (command === 'ship') {
        const mList = await message.guild.members.fetch();
        const baskaUyeler = mList.filter(m => !m.user.bot && m.id !== message.author.id);
        if (baskaUyeler.size === 0) return message.reply("❌ Shiplenecek kimse yok!");
        const shipKisi = baskaUyeler.random().user;
        const askYuzdesi = Math.floor(Math.random() * 101);

        const canvas = createCanvas(600, 250);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#232428'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        try {
            const av1 = await loadImage(message.author.displayAvatarURL({ forceStatic: true, extension: 'png', size: 128 }));
            const av2 = await loadImage(shipKisi.displayAvatarURL({ forceStatic: true, extension: 'png', size: 128 }));
            ctx.drawImage(av1, 40, 65, 120, 120); ctx.drawImage(av2, 440, 65, 120, 120);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(`%${askYuzdesi}`, 280, 130);
            const attachment = new AttachmentBuilder(await canvas.toBuffer(), { name: 'ship.png' });
            return message.reply({ content: `💞 **${message.author.username}** ve **${shipKisi.username}** shiplendi! Uyumluluk: %${askYuzdesi}`, files: [attachment] });
        } catch (e) {
            return message.reply(`💞 **${message.author.username}** ve **${shipKisi.username}** shiplendi! Uyumluluk: %${askYuzdesi}`);
        }
    }

    if (command === 'lock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply("🔒 Kanal kilitlendi.");
    }
    if (command === 'unlock') {
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply("🔓 Kanal açıldı.");
    }

    if (command === 'komutlar') {
        const helpEmbed = new EmbedBuilder().setTitle('🛡️ MEM Bot Komut Paneli').setColor('Blue').addFields(
            { name: '👤 Genel / Eğlence', value: '`afk`, `owner`, `avatar`, `komutlar`, `ship`' },
            { name: '🛡️ Moderasyon / Yönetim', value: '`ban`, `kick`, `mute`, `unmute`, `uyarı`, `sil`, `lock`, `unlock`, `yetkilisec`, `duyuru`, `kurallar`, `linkengel-on`, `linkengel-off`, `yavaşmod`, `çekiliş`, `invitesay`, `logs`, `hoşgeldin`, `hoşçakal`' },
            { name: '🎮 Oyun / Eğlence', value: '`sayısaymaca`, `tuttututmadı`' },
            { name: '🎫 Destek', value: '`/setup`' }
        );
        return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'ban') {
        const user = message.mentions.users.first();
        if (!user) return message.reply("❌ Üye etiketleyin.");
        await message.guild.members.ban(user);
        return message.reply(`✅ Üye yasaklandı.`);
    }
    if (command === 'kick') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Üye etiketleyin.");
        await member.kick();
        return message.reply(`✅ Üye atıldı.`);
    }
    if (command === 'mute') {
        const member = message.mentions.members.first();
        const sure = parseInt(args[1]);
        if (!member || isNaN(sure)) return message.reply("❌ Hatalı kullanım.");
        await member.timeout(sure * 60 * 1000);
        return message.reply(`✅ Susturuldu.`);
    }
    if (command === 'unmute') {
        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Üye etiketleyin.");
        await member.timeout(null);
        return message.reply(`✅ Susturma kaldırıldı.`);
    }
    if (command === 'sil') {
        const sayi = parseInt(args[0]);
        if (isNaN(sayi) || sayi < 1 || sayi > 100) return message.reply("❌ 1-100 arası sayı girin.");
        await message.channel.bulkDelete(sayi, true);
        return message.channel.send(`✅ Temizlendi.`).then(m => setTimeout(() => m.delete(), 3000));
    }
    if (command === 'uyarı') {
        const member = message.mentions.members.first();
        const sebep = args.slice(1).join(" ") || "Belirtilmedi";
        if (!member) return message.reply("❌ Üye etiketleyin.");
        if (!botVerisi.uyarilar[member.id]) botVerisi.uyarilar[member.id] = [];
        botVerisi.uyarilar[member.id].push({ sebep, yetkili: message.author.tag });
        veriKaydet();
        return message.reply(`⚠️ ${member.user.tag} uyarıldı. Toplam: ${botVerisi.uyarilar[member.id].length}`);
    }
    if (command === 'rolver') {
        const member = message.mentions.members.first();
        const role = message.mentions.roles.first();
        if (!member || !role) return message.reply("❌ Eksik giriş.");
        await member.roles.add(role);
        return message.reply(`✅ Rol verildi.`);
    }
    if (command === 'rolal') {
        const member = message.mentions.members.first();
        const role = message.mentions.roles.first();
        if (!member || !role) return message.reply("❌ Eksik giriş.");
        await member.roles.remove(role);
        return message.reply(`✅ Rol alındı.`);
    }
    if (command === 'yetkilisec') {
        const role = message.mentions.roles.first();
        if (!role) return message.reply("❌ Rol etiketleyin.");
        if (!botVerisi.yetkiliRoller.includes(role.id)) botVerisi.yetkiliRoller.push(role.id);
        veriKaydet();
        return message.reply(`✅ Bot yetkilisi eklendi.`);
    }
    if (command === 'sayısaymaca') {
        const kanal = message.mentions.channels.first() || message.channel;
        botVerisi.sayi[kanal.id] = { sonSayi: 0, sonKullanici: null };
        veriKaydet();
        return message.reply(`✅ Sayı saymaca oyunu ${kanal} üzerinde başlatıldı.`);
    }
    if (command === 'afk') {
        botVerisi.afk[message.author.id] = args.join(" ") || "Belirtilmedi"; veriKaydet();
        return message.reply(`📌 AFK moduna geçildi.`);
    }
    if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        return message.reply(`${user.displayAvatarURL({ dynamic: true, size: 1024 })}`);
    }
    if (command === 'owner') {
        return message.reply(`👑 Sunucu Sahibi: <@${message.guild.ownerId}>`);
    }
});

// --- INTERACTION ETKİLEŞİMLERİ ---
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;

    if (i.isButton() && i.customId === 'cekilis_katil') {
        const cVeri = botVerisi.cekilisler?.[i.message.id];
        if (!cVeri || cVeri.bitti) return i.reply({ content: "❌ Bu çekiliş tamamlanmış veya süresi dolmuş.", ephemeral: true });

        if (cVeri.katilanlar.includes(i.user.id)) {
            return i.reply({ content: "⚠️ Çekilişe zaten katılmış durumdasın!", ephemeral: true });
        }

        if (cVeri.sartTuru === 'rol') {
            if (!i.member.roles.cache.has(cVeri.sartDetay)) {
                return i.reply({ content: `❌ Bu çekiliş için gerekli olan <@&${cVeri.sartDetay}> rolüne sahip değilsiniz!`, ephemeral: true });
            }
        } 
        else if (cVeri.sartTuru === 'invite') {
            const gerekenInvite = parseInt(cVeri.sartDetay);
            const userInviteVeri = botVerisi.davetler[i.guild.id]?.[i.user.id]?.sayi || 0;
            if (userInviteVeri < gerekenInvite) {
                return i.reply({ content: `❌ Gerekli davet sayısına sahip değilsiniz! Gereken: **${gerekenInvite}**, Sizin: **${userInviteVeri}**`, ephemeral: true });
            }
        }

        cVeri.katilanlar.push(i.user.id);
        veriKaydet();
        return i.reply({ content: "🎉 Çekilişe başarıyla katıldınız! Bol şanslar! 🍀", ephemeral: true });
    }

    const ayar = botVerisi.sunucuAyarlar[i.guild.id];
    if (!ayar) return;

    if (i.isStringSelectMenu() && i.customId === 'ticket_kategori') {
        botVerisi.ticketCount++; veriKaydet();
        const secilenKat = i.values[0];
        const channel = await i.guild.channels.create({
            name: `${secilenKat}-${i.user.username}`,
            type: ChannelType.GuildText,
            topic: i.user.id, 
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.yetkiliRoller.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });

        const welcomeEmbed = new EmbedBuilder().setColor("Green").setDescription(`Merhaba ${i.user}, sorununu anlatabilirsin.`);
        const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_kapat_menusu').setLabel('Ticketi Kapat').setStyle(ButtonStyle.Danger));
        await channel.send({ content: `${i.user}`, embeds: [welcomeEmbed], components: [closeBtn] });
        return i.reply({ content: `✅ Biletiniz oluşturuldu: ${channel}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'tk_kapat_menusu') {
        const reasonMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('tk_final_kapat').setPlaceholder('Bilet kapatılma sebebi...').addOptions([
                { label: 'Sorun Çözüldü', value: 'Sorun Çözüldü ✅' },
                { label: 'Geçersiz Talep', value: 'Geçersiz Talep ❌' }
            ])
        );
        return i.reply({ content: "⚠️ Lütfen bir sebep seçin:", components: [reasonMenu] });
    }

    if (i.isStringSelectMenu() && i.customId === 'tk_final_kapat') {
        const secilenSebep = i.values[0];
        const acanKisiId = i.channel.topic; 
        const logKanal = i.guild.channels.cache.get(ayar.logKanal);

        const messages = await i.channel.messages.fetch({ limit: 100 });
        const logString = messages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
        const attachment = new AttachmentBuilder(Buffer.from(logString), { name: `transcript-${i.channel.name}.txt` });

        const logEmbed = new EmbedBuilder().setTitle("🔒 Bilet Kapatıldı").setColor("Red").addFields(
            { name: "🎫 Açan Üye", value: acanKisiId ? `<@${acanKisiId}>` : "`Bilinmiyor`" },
            { name: "👮 Kapatan Yetkili", value: `${i.user}` },
            { name: "📝 Neden", value: `**${secilenSebep}**` }
        ).setTimestamp();

        if (logKanal) await logKanal.send({ embeds: [logEmbed], files: [attachment] });
        await i.reply("🔒 Bilet 5 saniye içinde kapatılıyor...");
        return setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
});

client.login(process.env.TOKEN);
