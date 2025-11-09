/**
 * CYPHER MD BOT MESSAGE HANDLER
 * Works with baileys-mod
 */

const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("baileys");

async function sendText(sock, jid, text) {
  try { await sock.sendMessage(jid, { text }); } 
  catch (err) { console.error("❌ Failed to send text:", err); }
}

async function sendImage(sock, jid, imagePathOrUrl, caption = "") {
  try { await sock.sendMessage(jid, { image: { url: imagePathOrUrl }, caption }); } 
  catch (err) { console.error("❌ Failed to send image:", err); }
}

async function sendVideo(sock, jid, videoPathOrUrl, caption = "") {
  try { await sock.sendMessage(jid, { video: { url: videoPathOrUrl }, caption }); } 
  catch (err) { console.error("❌ Failed to send video:", err); }
}

async function sendAudio(sock, jid, audioPathOrUrl, ptt = false) {
  try { await sock.sendMessage(jid, { audio: { url: audioPathOrUrl }, mimetype: "audio/mpeg", ptt }); } 
  catch (err) { console.error("❌ Failed to send audio:", err); }
}

async function downloadMediaMessage(message, outputDir = "./downloads") {
  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const messageType = Object.keys(message.message)[0];
    const stream = await downloadContentFromMessage(message.message[messageType], messageType.replace("Message",""));
    let fullBuffer = Buffer.from([]);
    for await (const chunk of stream) fullBuffer = Buffer.concat([fullBuffer, chunk]);
    const filename = path.join(outputDir, `${Date.now()}.${messageType}`);
    fs.writeFileSync(filename, fullBuffer);
    console.log(`✅ Media saved: ${filename}`);
    return filename;
  } catch (err) { console.error("❌ Failed to download media:", err); }
}

async function autoReply(sock, msg) {
  try {
    const from = msg.key.remoteJid;
    const type = Object.keys(msg.message)[0];
    const text = msg.message.conversation || msg.message[type]?.caption || msg.message[type]?.text || "";
    if (!text) return;
    const lower = text.toLowerCase();
    if (["hi","hello","hey"].includes(lower)) await sendText(sock, from, `👋 Hey! I'm *CYPHER MD BOT*`);
    else if (lower.includes("menu")) await sendText(sock, from, "📜 *CYPHER MD BOT MENU*\n1. .alive\n2. .help\n3. .menu");
  } catch(err){ console.error("Auto-reply error:", err); }
}

function sms(sock, msg) {
  try { autoReply(sock, msg); } catch(err){ console.error("Message handler error:", err); }
}

module.exports = { sms, sendText, sendImage, sendVideo, sendAudio, downloadMediaMessage };