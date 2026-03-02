// Sheriff Manfred Mainke - Discord Bot + Express Server + Twitch Chat Integration
// This server handles website form submissions, sends Discord DMs, and streams Twitch chat

require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const tmi = require('tmi.js');

// Environment Variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_TARGET_USER_ID = process.env.DISCORD_TARGET_USER_ID;
const DISCORD_OWNER_USER_ID = process.env.DISCORD_OWNER_USER_ID;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const TWITCH_BOT_USERNAME = process.env.TWITCH_BOT_USERNAME;
const TWITCH_OAUTH_TOKEN = process.env.TWITCH_OAUTH_TOKEN;
const TWITCH_CHANNELS_RAW = process.env.TWITCH_CHANNELS || '';
const TWITCH_CHANNELS = TWITCH_CHANNELS_RAW
    .split(',')
    .map(ch => ch.trim().toLowerCase())
    .filter(ch => ch.length > 0);
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

function normalizeInput(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function safeField(value, maxLength = 1000) {
    const normalized = normalizeInput(value);
    if (!normalized) {
        return 'Nicht angegeben';
    }
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength - 3)}...`;
}

function buildMessageId() {
    const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `MSG-${Date.now()}-${randomSuffix}`;
}

function buildContactEmbed({ name, email, subject, message, messageId, timestamp, ownerCopy = false }) {
    return {
        color: ownerCopy ? 0x003366 : 0xd4af37,
        title: ownerCopy
            ? '📨 Owner Copy - Sheriff Website Nachricht'
            : '📨 Sheriff Manfred Mainke - Website Nachricht',
        description: ownerCopy
            ? 'Zusätzliche Owner-Kopie einer neuen Kontaktanfrage.'
            : 'Neue Kontaktanfrage über das Sheriff Department Website-Formular.',
        fields: [
            {
                name: '🆔 Vorgangsnummer',
                value: `\`${messageId}\``,
                inline: false
            },
            {
                name: '👤 Name',
                value: safeField(name, 256),
                inline: true
            },
            {
                name: '📧 E-Mail',
                value: safeField(email, 256),
                inline: true
            },
            {
                name: '📝 Betreff',
                value: safeField(subject, 1024),
                inline: false
            },
            {
                name: '💬 Nachricht',
                value: safeField(message, 1024),
                inline: false
            },
            {
                name: '🌐 Quelle',
                value: PUBLIC_URL,
                inline: false
            }
        ],
        footer: {
            text: ownerCopy ? 'Sheriff Department Contact System • Owner Copy' : 'Sheriff Department Contact System'
        },
        timestamp
    };
}

function buildDMText({ messageId }) {
    return `🚔 Neue Website-Kontaktanfrage eingegangen\nVorgangsnummer: ${messageId}`;
}

// Discord Bot Status Rotation
const botStatusRotation = [
    { name: 'Sheriff Manfred Mainke', type: 'WATCHING' },
    { name: 'Community Protection', type: 'WATCHING' },
    { name: '911 Dispatcher Calls', type: 'LISTENING' },
    { name: 'Law Enforcement Duties', type: 'PLAYING' },
    { name: 'Website Contact Forms', type: 'MONITORING' },
    { name: 'County Safety', type: 'WATCHING' }
];

let currentStatusIndex = 0;

function rotateStatus() {
    const status = botStatusRotation[currentStatusIndex];
    client.user.setPresence({
        activities: [{
            name: status.name,
            type: status.type
        }],
        status: 'online'
    });
    currentStatusIndex = (currentStatusIndex + 1) % botStatusRotation.length;
}

// Discord Bot Event - Ready
client.once('clientReady', () => {
    console.log(`✓ Discord Bot logged in as ${client.user.tag}`);
    console.log(`✓ Bot is ready to send DMs!`);
    console.log(`🤖 Sheriff M. Mainke Status aktiviert`);
    botReady = true;
    
    // Set initial status
    rotateStatus();
    
    // Rotate status every 30 seconds
    setInterval(rotateStatus, 30000);
    
    // Initialize Twitch Chat after Discord is ready
    initializeTwitchChat();
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

// Express Route - Serve chat page
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

// Express Route - Serve overlay page
app.get('/overlay', (req, res) => {
    res.sendFile(path.join(__dirname, 'overlay.html'));
});

// Express Route - Serve OBS tutorial
app.get('/obs-tutorial', (req, res) => {
    res.sendFile(path.join(__dirname, 'obs-tutorial.html'));
});

// Express Route - OAuth callback fallback page
app.get('/auth/callback', (req, res) => {
        const hasCode = Boolean(req.query && req.query.code);

        if (hasCode) {
                return res.status(200).send(`
                        <html>
                            <head><title>Discord OAuth Callback</title></head>
                            <body style="font-family: Arial, sans-serif; padding: 24px; background: #0b1a2b; color: #fff;">
                                <h2>✅ Callback erreicht</h2>
                                <p>Der Redirect funktioniert. Für einen normalen Bot-Invite brauchst du diesen OAuth-Code-Flow aber nicht.</p>
                                <p>Nutze stattdessen einen Invite-Link mit nur <b>bot</b> + <b>applications.commands</b>.</p>
                            </body>
                        </html>
                `);
        }

        return res.status(200).send('Discord OAuth callback endpoint is available.');
});

// Express Route - Handle form submissions
app.post('/api/contact', async (req, res) => {
    const name = normalizeInput(req.body?.name);
    const email = normalizeInput(req.body?.email);
    const subject = normalizeInput(req.body?.subject);
    const message = normalizeInput(req.body?.message);

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

        if (!DISCORD_GUILD_ID) {
            console.error('❌ DISCORD_GUILD_ID nicht in .env gesetzt!');
            return res.status(500).json({
                success: false,
                message: 'Bot-Konfiguration unvollständig (Guild fehlt)'
            });
        }

        // Stelle sicher, dass User und Bot denselben Server teilen
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch(DISCORD_TARGET_USER_ID);
        const targetUser = member.user;

        const timestamp = new Date();
        const messageId = buildMessageId();

        // Send DM
        await targetUser.send({
            content: buildDMText({ messageId }),
            embeds: [buildContactEmbed({
                name,
                email,
                subject,
                message,
                messageId,
                timestamp
            })]
        });

        if (DISCORD_OWNER_USER_ID && DISCORD_OWNER_USER_ID !== DISCORD_TARGET_USER_ID) {
            try {
                const ownerMember = await guild.members.fetch(DISCORD_OWNER_USER_ID);
                await ownerMember.user.send({
                    content: buildDMText({ messageId }),
                    embeds: [buildContactEmbed({
                        name,
                        email,
                        subject,
                        message,
                        messageId,
                        timestamp,
                        ownerCopy: true
                    })]
                });
                console.log('✓ Owner-Kopie wurde per DM gesendet');
            } catch (ownerError) {
                console.warn('⚠️ Owner-DM konnte nicht gesendet werden:', ownerError?.code || ownerError?.message || ownerError);
            }
        }

        // Send message to Discord channel if configured
        if (DISCORD_CHANNEL_ID) {
            try {
                const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
                if (channel && channel.isTextBased()) {
                    await channel.send({
                        content: `📢 Neue Kontaktanfrage eingegangen • ID: \`${messageId}\``,
                        embeds: [buildContactEmbed({
                            name,
                            email,
                            subject,
                            message,
                            messageId,
                            timestamp
                        })]
                    });
                    console.log(`✓ Nachricht in Channel ${DISCORD_CHANNEL_ID} gepostet`);
                }
            } catch (channelError) {
                console.warn('⚠️ Channel-Nachricht konnte nicht gesendet werden:', channelError?.code || channelError?.message || channelError);
            }
        }

        console.log(`✓ Nachricht ${messageId} von ${name} wurde an Discord DM gesendet`);

        return res.status(200).json({
            success: true,
            message: 'Vielen Dank! Ihre Nachricht wurde erfolgreich übermittelt.',
            messageId
        });

    } catch (error) {
        console.error('Fehler beim Senden der Discord DM:', error);

        if (error && (error.code === 50007 || error.code === '50007')) {
            return res.status(500).json({
                success: false,
                message: 'Discord blockiert DMs an diesen User (Privacy-Einstellung). Aktiviere "Direktnachrichten von Servermitgliedern zulassen" für den gemeinsamen Server.'
            });
        }

        if (error && (error.code === 10013 || error.code === '10013')) {
            return res.status(500).json({
                success: false,
                message: 'DISCORD_TARGET_USER_ID ist ungültig oder der User wurde nicht gefunden.'
            });
        }

        if (error && (error.code === 10004 || error.code === '10004')) {
            return res.status(500).json({
                success: false,
                message: 'DISCORD_GUILD_ID ist ungültig oder der Bot ist nicht auf dem Server.'
            });
        }

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
const server = http.createServer(app);

// WebSocket Server für Chat
const wss = new WebSocket.Server({ server });
const chatMessages = []; // In-Memory Storage für Chat-Messages
const messagesByChannel = new Map(); // Channel-specific message storage
const maxMessages = 50; // Max 50 Messages behalten
const MESSAGE_BATCH_SIZE = 5; // Batch messages before processing

// Cleanup function for memory management
function pruneOldMessages() {
    const now = Date.now();
    const MAX_MESSAGE_AGE_MS = 3600000; // 1 hour
    
    // Remove old global messages
    for (let i = 0; i < chatMessages.length; i++) {
        if (now - chatMessages[i].timestamp > MAX_MESSAGE_AGE_MS) {
            chatMessages.splice(i, 1);
            i--;
        }
    }
    
    // Cleanup channel-specific histories
    messagesByChannel.forEach((messages, channel) => {
        for (let i = 0; i < messages.length; i++) {
            if (now - messages[i].timestamp > MAX_MESSAGE_AGE_MS) {
                messages.splice(i, 1);
                i--;
            }
        }
        if (messages.length === 0) {
            messagesByChannel.delete(channel);
        }
    });
}

// Run cleanup every 30 minutes
const cleanupInterval = setInterval(pruneOldMessages, 1800000);

// Graceful shutdown
process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    wss.close();
    process.exit(0);
});

wss.on('connection', (ws) => {
    // Send existing messages to new client
    ws.send(JSON.stringify({ 
        type: 'history', 
        messages: chatMessages 
    }));

    ws.on('message', (data) => {
        try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'chat') {
                const username = String(parsed.username || 'Anonym').slice(0, 30);
                const message = String(parsed.message || '').slice(0, 500).trim();
                
                if (!message) return;

                const chatMessage = {
                    id: Date.now(),
                    username,
                    message,
                    timestamp: new Date().toLocaleTimeString('de-DE'),
                    color: generateUserColor(username),
                    source: 'custom'
                };

                chatMessages.push(chatMessage);
                
                // Keep only last 50 messages
                if (chatMessages.length > maxMessages) {
                    chatMessages.shift();
                }

                // Broadcast to all connected clients
                const msgData = JSON.stringify({ 
                    type: 'new_message', 
                    message: chatMessage 
                });
                
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(msgData);
                    }
                });
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        // Client disconnected
    });
});

function generateUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash = hash & hash;
    }
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#C39BD3'
    ];
    return colors[Math.abs(hash) % colors.length];
}

// Twitch Chat Integration via Bot
let twitchClient = null;
let twitchConnected = false;

function attachTwitchClientEvents(clientInstance) {
    clientInstance.on('message', (channel, userstate, message, self) => {
        if (self) return;

        const twitchMessage = {
            id: Date.now(),
            username: userstate['display-name'] || userstate.username,
            message: message,
            timestamp: new Date().toLocaleTimeString('de-DE'),
            color: userstate.color || generateUserColor(userstate.username),
            source: 'twitch',
            channel: channel.replace('#', ''),
            badges: userstate.badges ? Object.keys(userstate.badges) : []
        };

        const msgData = JSON.stringify({
            type: 'new_message',
            message: twitchMessage
        });

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msgData);
            }
        });

        console.log(`💬 Twitch Chat [${userstate['display-name'] || userstate.username}]: ${message}`);
    });

    clientInstance.on('connected', () => {
        twitchConnected = true;
        console.log(`✅ Mit Twitch Chat verbunden: ${TWITCH_CHANNELS.join(', ')}`);
    });

    clientInstance.on('disconnected', () => {
        twitchConnected = false;
        console.log('❌ Twitch Chat verbindung getrennt');
    });
}

async function connectAnonymousTwitchClient() {
    console.log('👤 Twitch Modus: Anonymous Read (ohne 2FA/Login)');
    twitchClient = new tmi.client({
        options: { debug: false },
        channels: TWITCH_CHANNELS
    });
    attachTwitchClientEvents(twitchClient);
    await twitchClient.connect();
}

function initializeTwitchChat() {
    if (TWITCH_CHANNELS.length === 0) {
        console.log('⚠️ Twitch Bot nicht konfiguriert - Twitch Chat deaktiviert');
        console.log('   Benötigt: TWITCH_CHANNELS');
        console.log('   TWITCH_CHANNELS sollte komma-getrennt sein (z.B. "kanal1,kanal2")');
        return;
    }

    try {
        const hasBotCredentials = Boolean(TWITCH_BOT_USERNAME && TWITCH_OAUTH_TOKEN);

        if (hasBotCredentials) {
            const normalizedTwitchUsername = String(TWITCH_BOT_USERNAME).trim().toLowerCase();
            const normalizedTwitchToken = String(TWITCH_OAUTH_TOKEN).trim();
            const twitchPassword = normalizedTwitchToken.startsWith('oauth:')
                ? normalizedTwitchToken
                : `oauth:${normalizedTwitchToken}`;

            twitchClient = new tmi.client({
                options: { debug: false },
                channels: TWITCH_CHANNELS,
                identity: {
                username: normalizedTwitchUsername,
                password: twitchPassword
                }
            });
            console.log('🤖 Twitch Modus: Bot-Login (auth)');
            attachTwitchClientEvents(twitchClient);

            twitchClient.connect().catch(async err => {
                console.error('Twitch Verbindungsfehler:', err);
                console.log('↩️ Fallback: Wechsle zu Anonymous Read Mode...');
                try {
                    await connectAnonymousTwitchClient();
                } catch (fallbackError) {
                    console.error('Anonymous Fallback fehlgeschlagen:', fallbackError);
                    twitchConnected = false;
                }
            });
        } else {
            connectAnonymousTwitchClient().catch(err => {
                console.error('Twitch Verbindungsfehler:', err);
                twitchConnected = false;
            });
        }

    } catch (error) {
        console.error('Fehler bei Twitch-Initialisierung:', error);
        twitchConnected = false;
    }
}

server.listen(PORT, () => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚔 SHERIFF DEPARTMENT SERVER GESTARTET`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✓ Express Server läuft auf Port ${PORT}`);
    console.log(`✓ Public URL: ${PUBLIC_URL}`);
    console.log(`✓ Environment: ${NODE_ENV}`);
    console.log(`✓ WebSocket Chat aktiviert`);
    console.log(`✓ Discord Bot ID: ${CLIENT_ID || '⏳ Nicht konfiguriert'}`);
    console.log(`✓ Guild ID: ${DISCORD_GUILD_ID || '⏳ Nicht konfiguriert'}`);
    console.log(`✓ Target User: ${DISCORD_TARGET_USER_ID || '⏳ Nicht konfiguriert'}`);
    console.log(`✓ Owner User: ${DISCORD_OWNER_USER_ID || '⏳ Nicht konfiguriert'}`);
    console.log(`✓ Log Channel: ${DISCORD_CHANNEL_ID || '⏳ Nicht konfiguriert'}`);
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
