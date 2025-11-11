const express = require("express");
const fs = require("fs-extra");
const pino = require("pino");
const router = express.Router();
const moment = require("moment-timezone");
const { sms } = require("./msg");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  getContentType,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const config = {
  PREFIX: ".",
  BOT_NAME: "CYPHER-MD",
  IMAGE_URL: "https://i.ibb.co/Zf1CzD5J/cypher-md-logo.jpg",
  TIMEZONE: "Africa/Lagos",
};

const SESSION_PATH = "./session-temp";
if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH, { recursive: true });

function getTimestamp() {
  return moment().tz(config.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

async function createSocket(number, res) {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: [config.BOT_NAME, "Chrome", "1.0.0"],
      getMessage: async key => ({ id: key.id, conversation: "" }),
    });

    if (!number) return res.status(400).send("❌ Number required");

    console.log("⏳ Connecting to WhatsApp... Please wait...");

    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      console.log(`[${getTimestamp()}] Connection status: ${connection}`);

      if (qr) console.log("🔹 Pairing code ready!");

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`❌ Connection closed. Reason: ${reason || "Unknown"}`);
        console.log("⚠️ Retrying in 5 seconds...");
        setTimeout(() => createSocket(number, res), 5000);
      }

      if (connection === "open") {
        console.log(`✅ ${config.BOT_NAME} connected successfully!`);
        const userJid = jidNormalizedUser(socket.user.id);

        // Send initial connected message
        await socket.sendMessage(userJid, { text: `✅ *${config.BOT_NAME} connected successfully!*` });

        // Setup command and status handlers
        socket.ev.on("messages.upsert", ({ messages }) => sms(socket, messages[0]));
        res.status(200).send({ code: "CONNECTED" });
      }
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.error", (err) => console.error("⚠️ Socket error:", err));

  } catch (error) {
    console.error("❌ Error while creating pairing code:", error);
    res.status(500).send({ error: "Failed to generate pairing code" });
  }
}

router.get("/", async (req, res) => {
  const { number } = req.query;
  await createSocket(number, res);
});

module.exports = router;