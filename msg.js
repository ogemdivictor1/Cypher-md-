/**
 * CYPHER-MD MESSAGE HANDLER
 * Works with @whiskeysockets/baileys
 * Simplified, fast, and mobile-friendly
 */

const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

/**
 * Helper: send text message
 */
async function sendText(sock, jid, text) {
  try {
    await sock.sendMessage(jid, { text });
  } catch (err) {
    console.error("❌ Failed to send text:", err);
  }
}

/**
 * Helper: send image with optional caption
 */
async function sendImage(sock, jid, imagePathOrUrl, caption = "") {
  try {
    await sock.sendMessage(jid, {
      image: { url: imagePathOrUrl },
      caption
    });
  } catch (err) {
    console.error("❌ Failed to send image:", err);
  }
}

/**
 * Helper: send video with optional caption
 */
async function sendVideo(sock, jid, videoPathOrUrl, caption = "") {
  try {
    await sock.sendMessage(jid, {
      video: { url: videoPathOrUrl },
      caption
    });
  } catch (err) {
    console.error("❌ Failed to send video:", err);
  }
}

/**
 * Helper: send audio file
 */
async function sendAudio(sock, jid, audioPathOrUrl, ptt = false) {
  try {
    await sock.sendMessage(jid, {
      audio: { url: audioPathOrUrl },
      mimetype: "audio/mpeg",
      ptt
    });
  } catch (err) {
    console.error("❌ Failed to send audio:", err);
  }
}

/**
 * Download media message to file
 */
async function downloadMediaMessage(message, outputDir = "./downloads") {
  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const messageType = Object.keys(message.message)[0];
    const stream = await downloadContentFromMessage(
      message.message[messageType],
      messageType.replace("Message", "")
    );
    const buffer = Buffer.from([]);
    let fullBuffer = buffer;
    for await (const chunk of stream) {
      fullBuffer = Buffer.concat([fullBuffer, chunk]);
    }

    const filename = path.join(outputDir, `${Date.now()}.${messageType}`);
    fs.writeFileSync(filename, fullBuffer);
    console.log(`✅ Media saved: ${filename}`);
    return filename;
  } catch (err) {
    console.error("❌ Failed to download media:", err);
  }
}

/**
 * Simple Auto-Reply system
 */
async function autoReply(sock, msg) {
  try {
    const from = msg.key.remoteJid;
    const type = Object.keys(msg.message)[0];
    const text =
      msg.message.conversation ||
      msg.message[type]?.caption ||
      msg.message[type]?.text ||
      "";

    if (!text) return;

    const lower = text.toLowerCase();

    if (["hi", "hello", "hey"].includes(lower)) {
      await sendText(sock, from, "👋 Hey there! I'm *CYPHER-MD*, your WhatsApp assistant bot.");
    } else if (lower.includes("menu")) {
      await sendText(
        sock,
        from,
        "📜 *CYPHER-MD MENU*\n\n1. .alive – Check bot status\n2. .help – View command list\n3. .menu – Open this menu"
      );
    }
  } catch (err) {
    console.error("Auto-reply error:", err);
  }
}

/**
 * Main message event handler
 */
function sms(sock, msg) {
  try {
    autoReply(sock, msg);
  } catch (err) {
    console.error("Message handler error:", err);
  }
}

module.exports = {
  sms,
  sendText,
  sendImage,
  sendVideo,
  sendAudio,
  downloadMediaMessage
};