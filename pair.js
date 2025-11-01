/**
 * CYPHER-MD PAIRING SCRIPT
 * Clean private version using 6-digit pairing code.
 * Fully linked to msg.js for auto replies and message handling.
 * Powered by Cypher MD.
 */

const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();
const pino = require("pino");
const moment = require("moment-timezone");
const crypto = require("crypto");
const { sms } = require("./msg"); // ✅ connect auto-reply handler

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  delay,
  getContentType,
} = require("@whiskeysockets/baileys");

const config = {
  PREFIX: ".",
  BOT_NAME: "CYPHER-MD",
  IMAGE_URL: "https://i.ibb.co/Zf1CzD5J/cypher-md-logo.jpg",
  TIMEZONE: "Africa/Lagos",
};

const SESSION_PATH = "./session-temp";
if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH, { recursive: true });

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

function getTimestamp() {
  return moment().tz(config.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * 🔹 Create socket with 6-digit pairing code
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
    let code = await socket.requestPairingCode(number);
    console.log(`🔢 Pairing code for ${number}: ${code}`);
    res.status(200).send({ code });

    socket.ev.on("connection.update", async (update) => {
      const { connection } = update;

      if (connection === "open") {
        console.log(`✅ ${config.BOT_NAME} connected successfully!`);
        const userJid = jidNormalizedUser(socket.user.id);

        await socket.sendMessage(userJid, {
          text: `✅ *${config.BOT_NAME} connected successfully!*`,
        });

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, number);
        setupDeleteHandler(socket, number);

        // Clear session after connection ends
        socket.ev.on("connection.update", ({ connection }) => {
          if (connection === "close") {
            fs.emptyDirSync(SESSION_PATH);
            console.log("🧹 Session cleared after disconnect.");
          }
        });
      }
    });

    socket.ev.on("creds.update", saveCreds);
  } catch (error) {
    console.error("❌ Error while creating pairing code:", error);
    res.status(500).send({ error: "Failed to generate pairing code" });
  }
}

/**
 * 🔹 Auto view / react to statuses
 */
function setupStatusHandlers(socket) {
  socket.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== "status@broadcast") return;

    try {
      await socket.readMessages([message.key]);
      const emojis = ["🔥", "❤️", "💫", "😎"];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      await socket.sendMessage(
        message.key.remoteJid,
        { react: { text: randomEmoji, key: message.key } },
        { statusJidList: [message.key.participant] }
      );
      console.log(`💫 Reacted to a status with ${randomEmoji}`);
    } catch (error) {
      console.error("⚠️ Status error:", error);
    }
  });
}

/**
 * 🔹 Command handling (.alive, .menu, etc.)
 */
function setupCommandHandlers(socket, number) {
  socket.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === "status@broadcast") return;
    sms(socket, msg); // ✅ linked auto reply system

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
        case "alive":
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
          await socket.sendMessage(from, {
            image: { url: config.IMAGE_URL },
            caption,
          });
          break;

        case "menu":
          const menu = `
🌐 *${config.BOT_NAME} MENU*

${config.PREFIX}alive - Check bot status
${config.PREFIX}help - Show help
`;
          await socket.sendMessage(from, { text: menu });
          break;

        case "help":
          await socket.sendMessage(from, {
            text: `✨ *${config.BOT_NAME}* is ready!\nUse .menu to see all commands.`,
          });
          break;

        default:
          await socket.sendMessage(from, {
            text: `❓ Unknown command. Type *${config.PREFIX}menu*`,
          });
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
      "Powered by CYPHER-MD"
    );

    await socket.sendMessage(userJid, {
      image: { url: config.IMAGE_URL },
      caption: msg,
    });
    console.log(`⚠️ Notified ${number} about deleted message.`);
  });
}

/**
 * 🔹 API route
 */
router.get("/", async (req, res) => {
  const { number } = req.query;
  await createSocket(number, res);
});

module.exports = router;