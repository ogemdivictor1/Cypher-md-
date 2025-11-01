/**
 * CYPHER-MD MAIN SERVER
 * Clean, private version — runs pairing and serves your web pages.
 * Powered by Cypher MD.
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8000;
require('events').EventEmitter.defaultMaxListeners = 500;

// ✅ Import the WhatsApp pairing system
const pairRoute = require('./pair');

// ✅ Set current project path
const __path = process.cwd();

// ✅ Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Serve static assets (CSS, images, etc. if needed later)
app.use(express.static(__path));

// ✅ Route for WhatsApp code pairing
app.use('/code', pairRoute);

// ✅ Route for pairing page
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__path, 'pair.html'));
});

// ✅ Route for main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__path, 'main.html'));
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`
🚀 CYPHER-MD Server Started
🌍 http://localhost:${PORT}
✅ Ready for WhatsApp Pairing
  `);
});

module.exports = app;