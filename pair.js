const PastebinAPI = require('pastebin-js'),
pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const axios = require('axios');

let router = express.Router();
const pino = require("pino");
const {
    default: Maher_Zubair,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("maher-zubair-baileys");

const GITHUB_REPO = "DATA-BASE-ID/session.json";
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/DEXTER-ID-PROJECT-ULTRA/DATA-BASE-ID/main/session.json`;
const GITHUB_API_URL = `https://api.github.com/repos/DEXTER-ID-PROJECT-ULTRA/DATA-BASE-ID/contents/session.json`;
const GITHUB_TOKEN = "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";

async function uploadToGitHub(sessionData) {
    try {
        let sha = null;
        try {
            const response = await axios.get(GITHUB_API_URL, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` },
            });
            sha = response.data.sha;
        } catch (err) {
            console.log("🔹 session.json not found in GitHub, creating a new one.");
        }

        await axios.put(GITHUB_API_URL, {
            message: "Updated Session Data",
            content: Buffer.from(sessionData).toString("base64"),
            sha: sha || undefined,
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` },
        });

        console.log("✅ Session data successfully uploaded to GitHub!");
    } catch (error) {
        console.error("❌ GitHub Upload Error:", error.response?.data || error.message);
    }
}

async function getSessionFromGitHub() {
    try {
        const response = await axios.get(GITHUB_RAW_URL);
        return JSON.stringify(response.data, null, 2);
    } catch (error) {
        console.error("❌ Failed to retrieve session data from GitHub");
        return null;
    }
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function START_WHATSAPP_BOT() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let bot = Maher_Zubair({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
            });

            bot.ev.on('creds.update', async () => {
                await saveCreds();
                let sessionData = fs.readFileSync(`./temp/${id}/creds.json`);
                await uploadToGitHub(sessionData);
            });

            bot.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    console.log("✅ WhatsApp Bot Connected!");
                    res.send({ status: "Connected" });

                    let sessionData = fs.readFileSync(`./temp/${id}/creds.json`);
                    await uploadToGitHub(sessionData);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.log("🔄 Reconnecting...");
                    await delay(2000);
                    START_WHATSAPP_BOT();
                }
            });

            bot.ev.on("messages.upsert", async (msg) => {
                try {
                    let message = msg.messages[0];
                    if (!message.message || message.key.fromMe) return;

                    let sender = message.key.remoteJid;
                    let text = message.message.conversation || message.message.extendedTextMessage?.text || "";

                    if (text.startsWith(".ping")) {
                        let start = Date.now();
                        await bot.sendMessage(sender, { text: "Pinging..." });
                        let end = Date.now();
                        let pingTime = end - start;

                        await bot.sendMessage(sender, { text: `🏓 Pong!\n⏳ Response Time: *${pingTime}ms*` });
                    }
                } catch (error) {
                    console.error("Ping Command Error:", error);
                }
            });
        } catch (err) {
            console.log("❌ Service Restarting...");
            if (!res.headersSent) {
                res.send({ code: "Service Unavailable" });
            }
        }
    }

    let storedSession = await getSessionFromGitHub();
    if (storedSession) {
        fs.writeFileSync(`./temp/${id}/creds.json`, storedSession);
    }

    return await START_WHATSAPP_BOT();
});

module.exports = router;
