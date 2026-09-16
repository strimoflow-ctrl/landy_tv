// Polyfill File for older Node.js runtimes (Node 18)
if (typeof globalThis.File === 'undefined') {
  try {
    globalThis.File = class File {};
  } catch (e) {}
}

const { spawn } = require('child_process');
const path = require('path');

console.log('\n=============================================================');
console.log('   🍿 LANDY TV — FULLSTACK WEB SERVER & TELEGRAM BOT');
console.log('=============================================================\n');

// 1. Start Express Server
const serverProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'server.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// 2. Start Telegram Bot
const botProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'bot', 'bot.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// 3. Start Automatic Channel Poster Bot
const posterProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'bot', 'channel_poster.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

serverProcess.on('error', (err) => {
  console.error('Failed to start server process:', err);
});

botProcess.on('error', (err) => {
  console.error('Failed to start bot process:', err);
});

posterProcess.on('error', (err) => {
  console.error('Failed to start channel poster process:', err);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Landy TV services...');
  serverProcess.kill();
  botProcess.kill();
  posterProcess.kill();
  process.exit();
});
