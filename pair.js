/**
 * CYPHER MD BOT PAIRING SCRIPT
 * Reliable @whiskeysockets/baileys implementation
 * Live connection monitor, error logging, auto-reconnect
 */

const express = require("express");
const fs = require("fs-extra");
const pino = require("pino");
const router = express.Router();
const { sms } = require("./msg");
const moment = require("moment-timezone");

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

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

/**
 * 🔹 Create WhatsApp socket and connect
 */
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

    // ✅ Live connection monitoring
    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection) console.log(`[${getTimestamp()}] Connection status: ${connection}`);
      if (qr) console.log("🔹 Pairing code ready!");

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        switch (lastDisconnect?.error?.output?.statusCode) {
          case DisconnectReason.loggedOut:
            console.log("❌ Logged out. Please remove session and reconnect.");
            break;
          case DisconnectReason.restartRequired:
            console.log("⚠️ Restart required to reconnect.");
            break;
          case DisconnectReason.timedOut:
            console.log("⏱ Connection timed out.");
            break;
          default:
            console.log(`❌ Connection closed. Reason: ${reason || "Unknown"}`);
        }
        console.log("⚠️ Retrying in 5 seconds...");
        setTimeout(() => createSocket(number, res), 5000);
      }

      if (connection === "open") {
        console.log(`✅ ${config.BOT_NAME} connected successfully!`);
        const userJid = jidNormalizedUser(socket.user.id);
        await socket.sendMessage(userJid, { text: `✅ *${config.BOT_NAME} connected successfully!*` });

        setupCommandHandlers(socket, number);
        setupStatusHandlers(socket);
        setupDeleteHandler(socket, number);

        // Respond with pairing code (simulate code for web HTML)
        try {
          const code = Math.floor(1000 + Math.random() * 9000); // 4-digit fake pairing code
          console.log(`🔢 Pairing code for ${number}: ${code}`);
          res.status(200).send({ code });
        } catch (err) {
          console.error("❌ Failed to generate pairing code:", err);
          res.status(500).send({ error: "Failed to generate pairing code" });
        }
      }
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.error", (err) => {
      console.error("⚠️ Socket error:", err);
      console.log("⚠️ Retrying connection in 5 seconds...");
      setTimeout(() => createSocket(number, res), 5000);
    });

  } catch (error) {
    console.error("❌ Error while creating pairing code:", error);
    res.status(500).send({ error: "Failed to generate pairing code" });
  }
}

/**
 * 🔹 Command handling (.alive, .menu, .help)
 */
function setupCommandHandlers(socket, number) {
  socket.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === "status@broadcast") return;

    sms(socket, msg);

    const type = getContentType(msg.message);
    const body = type === "conversation"
      ? msg.message.conversation
      : msg.message?.extendedTextMessage?.text || "";

    if (!body.startsWith(config.PREFIX)) return;

    const command = body.slice(config.PREFIX.length).trim().split(" ")[0].toLowerCase();
    const from = msg.key.remoteJid;

    try {
      switch (command) {
        case "alive":
          const uptime = process.uptime();
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = Math.floor(uptime % 60);

          const caption = `
╭───💠───
👑 ${config.BOT_NAME} IS ACTIVE
⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
📱 Number: ${number}
╰───💠───
`;
          await socket.sendMessage(from, { image: { url: config.IMAGE_URL }, caption });
          break;

        case "menu":
          const menu = `
🌐 ${config.BOT_NAME} MENU

${config.PREFIX}alive - Check bot status
${config.PREFIX}help - Show help
`;
          await socket.sendMessage(from, { text: menu });
          break;

        case "help":
          await socket.sendMessage(from, { text: `✨ *${config.BOT_NAME}* is ready!\nUse .menu to see all commands.` });
          break;

        default:
          await socket.sendMessage(from, { text: `❓ Unknown command. Type *${config.PREFIX}menu*` });
      }
    } catch (err) {
      console.error("❌ Command error:", err);
    }
  });
}

/**
 * 🔹 React to statuses
 */
function setupStatusHandlers(socket) {
  socket.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== "status@broadcast") return;

    try {
      const emojis = ["🔥","❤️","💫","😎"];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      await socket.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } }, { statusJidList: [message.key.participant] });
      console.log(`💫 Reacted to status with ${randomEmoji}`);
    } catch (err) {
      console.error("⚠️ Status error:", err);
    }
  });
}

/**
 * 🔹 Handle deleted messages
 */
function setupDeleteHandler(socket, number) {
  socket.ev.on("messages.delete", async ({ keys }) => {
    if (!keys?.length) return;
    const key = keys[0];
    const userJid = jidNormalizedUser(socket.user.id);
    const deletionTime = getTimestamp();

    const msg = formatMessage(
      "🗑️ MESSAGE DELETED",
      `Message deleted from:\n📋 ${key.remoteJid}\n🕒 ${deletionTime}`,
      "Powered by CYPHER-MD"
    );

    await socket.sendMessage(userJid, { image: { url: config.IMAGE_URL }, caption: msg });
    console.log(`⚠️ Notified ${number} about deleted message.`);
  });
}

/**
 * 🔹 Express API route
 */
router.get("/", async (req, res) => {
  const { number } = req.query;
  await createSocket(number, res);
});

module.exports = router;