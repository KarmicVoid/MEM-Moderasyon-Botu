const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => res.send('Bot aktif!'));
app.listen(port, () => console.log('Bot aktif.'));

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [131071] });

client.on('messageCreate', (message) => {
    if (message.author.bot || !message.content.startsWith('mem!')) return;
    message.reply('Bot çalışıyor!');
});

client.login(process.env.TOKEN);
