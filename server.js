// Sheriff Manfred Mainke - Discord Bot + Express Server + Twitch Chat Integration
// Multi-channel streaming chat overlay system with real-time WebSocket broadcasting

'use strict';

require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const tmi = require('tmi.js');

// ==================== CONFIGURATION ====================
const config = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.CLIENT_ID,
        guildId: process.env.DISCORD_GUILD_ID,
        targetUserId: process.env.DISCORD_TARGET_USER_ID,
        ownerUserId: process.env.DISCORD_OWNER_USER_ID,
        channelId: process.env.DISCORD_CHANNEL_ID
    },
    twitch: {
        botUsername: process.env.TWITCH_BOT_USERNAME,
        oauthToken: process.env.TWITCH_OAUTH_TOKEN,
        channels: (process.env.TWITCH_CHANNELS || '')
            .split(',')
            .map(ch => ch.trim().toLowerCase())
            .filter(ch => ch.length > 0)
    },
    server: {
        port: process.env.PORT || 3000,
        publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`,
        nodeEnv: process.env.NODE_ENV || 'development'
    }
};

// Validate critical config
if (!config.discord.token) {
    console.error('❌ FEHLER: DISCORD_TOKEN nicht in .env gesetzt!');
    process.exit(1);
}

// Initialize Express app & HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));
app.use(express.static(__dirname, {
    maxAge: '1h',
    etag: true
}));

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==================== STATE ====================
const state = {
    discord: {
        ready: false
    },
    twitch: {
        client: null,
        connected: false
    },
    websocket: {
        messagesByChannel: new Map(),
        maxMessages: 50,
        messageExpiry: 3600000 // 1 hour in ms
    }
};

// ==================== UTILITIES ====================
function normalizeInput(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 2000);
}

function safeField(value, maxLength = 1000) {
    const normalized = normalizeInput(value);
    return normalized.length <= maxLength
        ? normalized
        : `${normalized.slice(0, maxLength - 3)}...`;
}

function buildMessageId() {
    return `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash = hash & hash;
    }
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    return colors[Math.abs(hash) % colors.length];
}

// ==================== DISCORD HELPERS ====================
function buildContactEmbed({ name, email, subject, message, messageId, timestamp, ownerCopy = false }) {
    return {
        color: ownerCopy ? 0x003366 : 0xd4af37,
        title: ownerCopy ? '📨 Owner Copy - Website Nachricht' : '📨 Sheriff Website Nachricht',
        description: ownerCopy
            ? 'Zusätzliche Owner-Kopie einer neuen Kontaktanfrage.'
            : 'Neue Kontaktanfrage über das Sheriff Department Website-Formular.',
        fields: [
            { name: '🆔 Vorgangsnummer', value: `\`${messageId}\``, inline: false },
            { name: '👤 Name', value: safeField(name, 256), inline: true },
            { name: '📧 E-Mail', value: safeField(email, 256), inline: true },
            { name: '📝 Betreff', value: safeField(subject, 1024), inline: false },
            { name: '💬 Nachricht', value: safeField(message, 1024), inline: false },
            { name: '🌐 Quelle', value: config.server.publicUrl, inline: false }
        ],
        footer: { text: ownerCopy ? 'Sheriff • Owner Copy' : 'Sheriff Department System' },
        timestamp
    };
}

function buildDMText({ messageId }) {
    return `🚔 Neue Website-Kontaktanfrage eingegangen\nVorgangsnummer: ${messageId}`;
}

// Discord Status Rotation
const botStatusRotation = [
    { name: 'Sheriff Manfred Mainke', type: 'WATCHING' },
    { name: 'Community Protection', type: 'WATCHING' },
    { name: 'Live Stream Chats', type: 'MONITORING' },
    { name: 'Website Messages', type: 'LISTENING' },
    { name: 'County Safety', type: 'WATCHING' },
    { name: 'Twitch Integration', type: 'PLAYING' }
];

let currentStatusIndex = 0;

function rotateStatus() {
    if (!client.user) return;
    const status = botStatusRotation[currentStatusIndex];
    client.user.setPresence({
        activities: [{ name: status.name, type: status.type }],
        status: 'online'
    });
    currentStatusIndex = (currentStatusIndex + 1) % botStatusRotation.length;
}

// ==================== DISCORD EVENTS ====================
client.once('clientReady', () => {
    console.log(`\n✅ Discord Bot online: ${client.user.tag}`);
    state.discord.ready = true;
    rotateStatus();
    setInterval(rotateStatus, 30000);
    initializeTwitchChat();
});

client.on('error', error => {
    console.error('❌ Discord Error:', error.message);
});

process.on('unhandledRejection', error => {
    console.error('⚠️ Unhandled Rejection:', error?.message || error);
});

// ==================== EXPRESS ROUTES ====================
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        discord: state.discord.ready,
        twitch: state.twitch.connected,
        timestamp: new Date().toISOString()
    });
});

// Static pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/overlay', (req, res) => res.sendFile(path.join(__dirname, 'overlay.html')));
app.get('/obs-tutorial', (req, res) => res.sendFile(path.join(__dirname, 'obs-tutorial.html')));

// OAuth Callback (for future Discord oauth)
app.get('/auth/callback', (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html>
            <head><title>Discord OAuth</title></head>
            <body style="font-family: Arial, sans-serif; padding: 24px; background: #0b1a2b; color: #fff;">
                <h2>✅ OAuth Callback</h2>
                <p>Callback endpoint is ready.</p>
            </body>
        </html>
    `);
});

// Contact Form Handler
app.post('/api/contact', async (req, res) => {
    const name = normalizeInput(req.body?.name);
    const email = normalizeInput(req.body?.email);
    const subject = normalizeInput(req.body?.subject);
    const message = normalizeInput(req.body?.message);

    // Validation
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Alle Felder erforderlich' });
    }

    try {
        if (!state.discord.ready) {
            return res.status(503).json({ success: false, message: 'Bot nicht bereit' });
        }

        if (!config.discord.targetUserId || !config.discord.guildId) {
            console.error('❌ Discord Config incomplete');
            return res.status(500).json({ success: false, message: 'Server-Konfiguration unvollständig' });
        }

        // Fetch user and send DM
        const guild = await client.guilds.fetch(config.discord.guildId);
        const member = await guild.members.fetch(config.discord.targetUserId);
        const timestamp = new Date();
        const messageId = buildMessageId();

        await member.user.send({
            content: buildDMText({ messageId }),
            embeds: [buildContactEmbed({ name, email, subject, message, messageId, timestamp })]
        });

        // Send owner copy if configured
        if (config.discord.ownerUserId && config.discord.ownerUserId !== config.discord.targetUserId) {
            try {
                const ownerMember = await guild.members.fetch(config.discord.ownerUserId);
                await ownerMember.user.send({
                    content: buildDMText({ messageId }),
                    embeds: [buildContactEmbed({ name, email, subject, message, messageId, timestamp, ownerCopy: true })]
                });
            } catch (err) {
                console.warn('⚠️ Owner DM fehler:', err.message);
            }
        }

        // Log to Discord channel if configured
        if (config.discord.channelId) {
            try {
                const channel = await client.channels.fetch(config.discord.channelId);
                await channel.send({
                    content: `✅ [${messageId}] Kontaktformular: ${name}`,
                    embeds: [buildContactEmbed({ name, email, subject, message, messageId, timestamp })]
                });
            } catch (err) {
                console.warn('⚠️ Channel log fehler:', err.message);
            }
        }

        console.log(`✅ Contact Form: ${name} <${email}>`);
        res.json({ success: true, message: 'Nachricht versendet', messageId });

    } catch (error) {
        console.error('❌ Contact Handler Error:', error.message);
        res.status(500).json({ success: false, message: 'Fehler beim Versenden' });
    }
});

// ==================== WEBSOCKET ====================
function pruneOldMessages() {
    const now = Date.now();
    for (const [channel, messages] of state.websocket.messagesByChannel.entries()) {
        state.websocket.messagesByChannel.set(
            channel,
            messages.filter(msg => (now - msg.timestamp) < state.websocket.messageExpiry)
        );
    }
}

wss.on('connection', (ws) => {
    console.log('📱 WebSocket Client verbunden');

    // Send message history to new client
    const allMessages = Array.from(state.websocket.messagesByChannel.values()).flat();
    ws.send(JSON.stringify({
        type: 'history',
        messages: allMessages.slice(-state.websocket.maxMessages)
    }));

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'chat' && msg.message && msg.username) {
                const chatMessage = {
                    id: Date.now(),
                    username: String(msg.username).slice(0, 30),
                    message: String(msg.message).slice(0, 500).trim(),
                    timestamp: new Date().toLocaleTimeString('de-DE'),
                    color: msg.color || generateUserColor(msg.username),
                    source: 'custom'
                };

                const channel = 'all';
                if (!state.websocket.messagesByChannel.has(channel)) {
                    state.websocket.messagesByChannel.set(channel, []);
                }
                state.websocket.messagesByChannel.get(channel).push(chatMessage);

                // Trim if exceeds max
                const messages = state.websocket.messagesByChannel.get(channel);
                if (messages.length > state.websocket.maxMessages) {
                    messages.shift();
                }

                // Broadcast to all clients
                const broadcast = JSON.stringify({ type: 'new_message', message: chatMessage });
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(broadcast);
                    }
                });
            }
        } catch (error) {
            console.error('❌ WebSocket message error:', error.message);
        }
    });

    ws.on('close', () => {
        console.log('📱 WebSocket Client getrennt');
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket Error:', error.message);
    });
});

// Cleanup interval
setInterval(pruneOldMessages, 30 * 60 * 1000);

// ==================== SERVER STARTUP ====================
server.listen(config.server.port, () => {
    console.log(`\n${'━'.repeat(50)}`);
    console.log(`🚔 SHERIFF DEPARTMENT - SYSTEM GESTARTET`);
    console.log(`${'━'.repeat(50)}`);
    console.log(`✓ Port: ${config.server.port}`);
    console.log(`✓ URL: ${config.server.publicUrl}`);
    console.log(`✓ Environment: ${config.server.nodeEnv}`);
    console.log(`✓ WebSocket: Aktiv`);
    console.log(`✓ Discord: ${state.discord.ready ? '🟢 Ready' : '🟡 Verbindend...'}`);
    console.log(`✓ Twitch: ${state.twitch.connected ? '🟢 Verbunden' : '⏳ Initialisierung...'}`);
    console.log(`${'━'.repeat(50)}\n`);
});

// ==================== DISCORD AUTH ====================
try {
    client.login(config.discord.token);
} catch (error) {
    console.error('❌ Discord Login Fehler:', error.message);
    process.exit(1);
}

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', async () => {
    console.log('\n📴 Fahre Server herunter...');
    try {
        await client.destroy();
        wss.close();
        server.close();
        console.log('✅ Server sauber heruntergefahren');
    } catch (error) {
        console.error('❌ Shutdown Fehler:', error.message);
    }
    process.exit(0);
});

// Error handling für unerwartete Fehler
process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error.message);
    process.exit(1);
});

module.exports = { app, client, server, wss };
