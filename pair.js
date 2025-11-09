/**
 * CYPHER MD BOT - PAIRING SCRIPT
 * Clean version using baileys-mod (multi-number supported)
 * Optimized for Render free hosting
 */

const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();
const pino = require("pino");
const moment = require("moment-timezone");
const { sms } = require("./msg"); // auto-reply handler
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  getContentType
} = require("baileys");

const config = {
  PREFIX: ".",
  BOT_NAME: "CYPHER MD BOT",
  IMAGE_URL: "https://i.ibb.co/Zf1CzD5J/cypher-md-logo.jpg",
  TIMEZONE: "Africa/Lagos",
};

// ✅ Persistent session folder for Render
const SESSION_PATH = path.join(process.cwd(), "session-data");
if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH, { recursive: true });

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

function getTimestamp() {
  return moment().tz(config.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * 🔹 Create WhatsApp socket with pairing support
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
    });

    if (!number) return res.status(400).send("❌ Number required");

    console.log("⏳ Connecting to WhatsApp...");

    // 🔹 Handle connection updates
    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      console.log("Connection update:", update);

      if (connection === "open") {
        console.log(`✅ ${config.BOT_NAME} connected!`);
        const userJid = jidNormalizedUser(socket.user.id);
        await socket.sendMessage(userJid, {
          text: `✅ *${config.BOT_NAME} connected successfully!*`,
        });

        // Setup handlers
        setupStatusHandler(socket);
        setupCommandHandler(socket, number);
        setupDeleteHandler(socket, number);

        // Respond to pairing request only if session missing
        if (!fs.existsSync(path.join(SESSION_PATH, "state.json"))) {
          try {
            const code = await socket.requestPairingCode(number);
            console.log(`🔢 Pairing Code for ${number}: ${code}`);
            res.status(200).send({ code });
          } catch (err) {
            console.error("❌ Pairing code error:", err);
            res.status(500).send({ error: "Failed to generate pairing code" });
          }
        } else {
          res.status(200).send({ status: "already paired" });
        }
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.message;
        console.log(`⚠️ Connection closed: ${reason}`);

        // Only reconnect if not logged out
        if (reason !== "logged out") {
          console.log("⏳ Reconnecting in 5s...");
          setTimeout(() => createSocket(number, res), 5000);
        } else {
          console.log("❌ Logged out. Please pair again manually.");
        }
      }
    });

    // Save session updates
    socket.ev.on("creds.update", saveCreds);
  } catch (error) {
    console.error("❌ Error while creating pairing code:", error);
    res.status(500).send({ error: "Failed to generate pairing code" });
  }
}

/**
 * 🔹 React to WhatsApp statuses
 */
function setupStatusHandler(socket) {
  socket.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== "status@broadcast") return;

    try {
      await socket.readMessages([message.key]);
      const emojis = ["🔥", "❤️", "💫", "😎"];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      await socket.sendMessage(message.key.remoteJid, {
        react: { text: emoji, key: message.key },
      });
      console.log(`💫 Reacted to a status with ${emoji}`);
    } catch (err) {
      console.error("⚠️ Status error:", err);
    }
  });
}

/**
 * 🔹 Command handler
 */
function setupCommandHandler(socket, number) {
  socket.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === "status@broadcast") return;

    sms(socket, msg); // auto-reply

    const type = getContentType(msg.message);
    const body =
      type === "conversation"
        ? msg.message.conversation
        : msg.message?.extendedTextMessage?.text || "";

    if (!body.startsWith(config.PREFIX)) return;

    const command = body.slice(config.PREFIX.length).trim().split(" ")[0].toLowerCase();
    const from = msg.key.remoteJid;

    try {
      switch (command) {
        case "alive": {
          const uptime = process.uptime();
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = Math.floor(uptime % 60);

          const caption = `
╭───💠───
👑 *${config.BOT_NAME} IS ACTIVE*
⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
📱 Number: ${number}
╰───💠───
`;
          await socket.sendMessage(from, { image: { url: config.IMAGE_URL }, caption });
          break;
        }

        case "menu": {
          const menu = `
🌐 *${config.BOT_NAME} MENU*
${config.PREFIX}alive - Check bot status
${config.PREFIX}help - Show help
`;
          await socket.sendMessage(from, { text: menu });
          break;
        }

        case "help": {
          await socket.sendMessage(from, {
            text: `✨ *${config.BOT_NAME}* is ready!\nUse .menu to see all commands.`,
          });
          break;
        }

        default:
          await socket.sendMessage(from, { text: `❓ Unknown command. Type *${config.PREFIX}menu*` });
      }
    } catch (error) {
      console.error("Command error:", error);
    }
  });
}

/**
 * 🔹 Message delete handler
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
      `Powered by ${config.BOT_NAME}`
    );

    await socket.sendMessage(userJid, { image: { url: config.IMAGE_URL }, caption: msg });
    console.log(`⚠️ Notified ${number} about deleted message.`);
  });
}

// ✅ API endpoint to generate pairing code
router.get("/", async (req, res) => {
  const { number } = req.query;
  await createSocket(number, res);
});

module.exports = router;