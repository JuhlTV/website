// Sheriff Manfred Mainke - Discord Bot + Express Server
// This server handles website form submissions and sends Discord DMs

require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const cors = require('cors');
const path = require('path');

// Environment Variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
const DISCORD_TARGET_USER_ID = process.env.DISCORD_TARGET_USER_ID;
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname));

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

let botReady = false;

// Discord Bot Event - Ready
client.on('ready', () => {
    console.log(`✓ Discord Bot logged in as ${client.user.tag}`);
    console.log(`✓ Bot is ready to send DMs!`);
    botReady = true;
    
    // Set bot status
    client.user.setPresence({
        activities: [{
            name: 'Sheriff Department Website',
            type: 'WATCHING'
        }],
        status: 'online'
    });
});

// Discord Bot Event - Error handling
client.on('error', error => {
    console.error('Discord Client Error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled Rejection:', error);
});

// Express Route - Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Express Route - Handle form submissions
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
        return res.status(400).json({
            success: false,
            message: 'Alle Felder sind erforderlich'
        });
    }

    try {
        if (!botReady) {
            return res.status(503).json({
                success: false,
                message: 'Bot ist nicht bereit. Bitte versuchen Sie es später erneut.'
            });
        }

        // Validiere Environment-Variable
        if (!DISCORD_TARGET_USER_ID) {
            console.error('❌ DISCORD_TARGET_USER_ID nicht in .env gesetzt!');
            return res.status(500).json({
                success: false,
                message: 'Bot-Konfiguration unvollständig'
            });
        }

        // Get user and send DM
        const targetUser = await client.users.fetch(DISCORD_TARGET_USER_ID);
        
        // Format message
        const discordMessage = `
🚔 **NEUE NACHRICHT VOM WEBSITE KONTAKTFORMULAR** 🚔

**Name:** ${name}
**E-Mail:** ${email}
**Telefon:** (Falls angegeben)

**Betreff:** ${subject}

**Nachricht:**
${message}

---
⏰ Zeitstempel: ${new Date().toLocaleString('de-DE')}
        `.trim();

        // Send DM
        await targetUser.send({
            content: discordMessage,
            embeds: [{
                color: 0xd4af37, // Gold color
                title: '📨 Sheriff Department - Website Nachricht',
                fields: [
                    {
                        name: '👤 Name',
                        value: name,
                        inline: true
                    },
                    {
                        name: '📧 E-Mail',
                        value: email,
                        inline: true
                    },
                    {
                        name: '📝 Betreff',
                        value: subject,
                        inline: false
                    },
                    {
                        name: '💬 Nachricht',
                        value: message,
                        inline: false
                    }
                ],
                footer: {
                    text: 'Sheriff Department Contact System',
                    icon_url: 'https://raw.githubusercontent.com/discord/discord-api-docs/main/assets/png/icon.png'
                },
                timestamp: new Date()
            }]
        });

        console.log(`✓ Nachricht von ${name} wurde an Discord DM gesendet`);

        return res.status(200).json({
            success: true,
            message: 'Vielen Dank! Ihre Nachricht wurde erfolgreich übermittelt.'
        });

    } catch (error) {
        console.error('Fehler beim Senden der Discord DM:', error);
        return res.status(500).json({
            success: false,
            message: 'Es gab einen Fehler beim Übermitteln Ihrer Nachricht. Bitte versuchen Sie es später erneut.'
        });
    }
});

// Express Route - Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        botReady: botReady,
        timestamp: new Date().toISOString()
    });
});

// Express Route - Bot status
app.get('/api/bot-status', (req, res) => {
    res.status(200).json({
        botReady: botReady,
        botTag: botReady ? client.user.tag : 'Not connected',
        uptime: client.uptime
    });
});

// Start Express server
const server = app.listen(PORT, () => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚔 SHERIFF DEPARTMENT SERVER GESTARTET`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✓ Express Server läuft auf Port ${PORT}`);
    console.log(`✓ Public URL: ${PUBLIC_URL}`);
    console.log(`✓ Environment: ${NODE_ENV}`);
    console.log(`✓ Discord Bot ID: ${CLIENT_ID || '⏳ Nicht konfiguriert'}`);
    console.log(`✓ Target User: ${DISCORD_TARGET_USER_ID || '⏳ Nicht konfiguriert'}`);
    console.log(`✓ Warte auf Discord Bot Verbindung...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

// Login Discord Bot
// Discord Bot login mit Environment Token
if (!DISCORD_TOKEN) {
    console.error('❌ FEHLER: DISCORD_TOKEN nicht in .env gesetzt!');
    process.exit(1);
}

client.login(DISCORD_TOKEN);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n📴 Server wird heruntergefahren...');
    await client.destroy();
    server.close();
    process.exit(0);
});

module.exports = { app, client };
