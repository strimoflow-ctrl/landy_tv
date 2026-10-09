// Polyfill File for older Node.js runtimes (Node 18)
if (typeof globalThis.File === 'undefined') {
  try {
    globalThis.File = class File {};
  } catch (e) {}
}

const TelegramBotPackage = require('node-telegram-bot-api');
const TelegramBot = TelegramBotPackage.default || TelegramBotPackage.TelegramBot || TelegramBotPackage;
const path = require('path');
const dotenv = require('dotenv');
const { saveOrUpdateUser, isUserBlocked, markUserBotBlocked } = require('../firebase');
const { 
  getActiveChannels, 
  verifyAllChannels, 
  buildDynamicLockMessage 
} = require('./verify');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BOT_TOKEN = process.env.BOT_TOKEN;
const LANDY_BOT_USERNAME = (process.env.LANDY_BOT_USERNAME || 'landytv_bot').replace('@', '').trim();

// Normalize WEB_APP_URL (ensure https:// if user passed domain only)
let rawAppUrl = (process.env.WEB_APP_URL || 'http://localhost:5000').trim();
if (rawAppUrl && !rawAppUrl.startsWith('http://') && !rawAppUrl.startsWith('https://')) {
  rawAppUrl = `https://${rawAppUrl}`;
}
const WEB_APP_URL = rawAppUrl;

console.log('🤖 Telegram Bot Service Initializing with dynamic Firebase channels...');

// Clean user-requested Welcome Message
const DEFAULT_WELCOME_MSG = `Welcome to Landy TV! 💦\n\nEnjoy streaming your favorite premium videos directly inside Telegram.\n\nClick the button below to start watching!`;

// Helper: Build Launch Buttons [ 📢 Join Channel ] [ 🎬 Watch Now ]
function getAppLaunchButtons(appUrl) {
  const channelUrl = "https://t.me/landy_tv";
  const isHttps = appUrl && appUrl.startsWith('https://');

  const watchButton = isHttps
    ? { text: "🎬 Watch Now", web_app: { url: appUrl } }
    : { text: "🎬 Watch Now", url: appUrl };

  return [
    [
      { text: "📢 Join Channel", url: channelUrl },
      watchButton
    ]
  ];
}

let mainBotInstance = null;

// ==============================================================
// 1. MAIN LANDY TV BOT INSTANCE
// ==============================================================
if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
  try {
    const mainBot = new TelegramBot(BOT_TOKEN, { 
      polling: {
        autoStart: true,
        params: {
          allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"]
        }
      } 
    });
    mainBotInstance = mainBot;

    // Delete any active webhook to guarantee polling receives all updates immediately
    mainBot.deleteWebHook().catch(() => {});

    // Common function to process user message / start
    async function handleUserStart(msg, startParam = '') {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user || user.is_bot) return;

      console.log(`[Main Bot] Received /start from user: ${user.id} (@${user.username || user.first_name})`);

      try {
        // Check if blocked
        const blocked = await isUserBlocked(user.id);
        if (blocked) {
          return mainBot.sendMessage(chatId, '🚫 Your account has been suspended by the administrator.').catch(() => {});
        }

        // Save user to Firebase
        await saveOrUpdateUser(user);

        // Build direct App launch buttons
        let appUrl = WEB_APP_URL;
        if (startParam && startParam !== 'none') {
          appUrl = `${WEB_APP_URL}?start=${encodeURIComponent(startParam)}`;
        }

        const keyboard = getAppLaunchButtons(appUrl);
        mainBot.sendMessage(chatId, DEFAULT_WELCOME_MSG, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => {
          console.error('Main Bot send error (retrying plain):', err.message);
          return mainBot.sendMessage(chatId, DEFAULT_WELCOME_MSG.replace(/[*_`]/g, ''), {
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
          }).catch(e => console.error('Main bot welcome failed:', e.message));
        });
      } catch (err) {
        console.error('Error in handleUserStart:', err.message);
      }
    }

    // Command: /start
    mainBot.onText(/\/start(.*)/, async (msg, match) => {
      const startParam = match[1] ? match[1].trim() : '';
      await handleUserStart(msg, startParam);
    });

    // Handle any message that is not a command
    mainBot.on('message', async (msg) => {
      if (msg.text && msg.text.startsWith('/start')) return; // Already handled
      if (msg.chat.type !== 'private') return; // Only in private chat
      await handleUserStart(msg, '');
    });

    // Listen for user block/unblock events (my_chat_member)
    mainBot.on('my_chat_member', async (update) => {
      try {
        const userId = update.from?.id;
        const newStatus = update.new_chat_member?.status;
        if (!userId) return;
        if (newStatus === 'kicked') {
          console.log(`[Bot Event] User ${userId} blocked or deleted the bot.`);
          await markUserBotBlocked(userId, true);
        } else if (newStatus === 'member') {
          console.log(`[Bot Event] User ${userId} unblocked/resumed the bot.`);
          await markUserBotBlocked(userId, false);
        }
      } catch (e) {
        console.warn('[my_chat_member error]:', e.message);
      }
    });

    let lastPollingErrTime = 0;
    mainBot.on('polling_error', (error) => {
      const now = Date.now();
      if (now - lastPollingErrTime > 60000) {
        lastPollingErrTime = now;
        if (error.code === 'EFATAL' || error.message?.includes('404') || error.message?.includes('401')) {
          console.warn('⚠️ Main Bot Token unauthorized or not active in Telegram BotFather.');
        }
      }
    });

    console.log('✅ Main Landy TV Bot started successfully with smart dynamic 4-channel lock & leave detection!');
  } catch (err) {
    console.error('Failed to start Main Bot:', err.message);
  }
}

module.exports = {
  getMainBot: () => mainBotInstance,
  verifyAllChannels
};

