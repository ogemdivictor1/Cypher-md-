const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
require("events").EventEmitter.defaultMaxListeners = 500;

const app = express();
const PORT = process.env.PORT || 8000;

// Import pairing system
const pairRoute = require("./pair");

// Set project path
const __path = process.cwd();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__path));

// Routes
app.use("/code", pairRoute);

app.get("/pair", (req, res) => res.sendFile(path.join(__path, "pair.html")));
app.get("/", (req, res) => res.sendFile(path.join(__path, "main.html")));

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 CYPHER MD BOT Server Started
🌍 http://localhost:${PORT}
✅ Ready for WhatsApp Pairing
  `);
});

module.exports = app;