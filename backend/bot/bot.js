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
const { saveOrUpdateUser, isUserBlocked } = require('../firebase');
const { 
  HARDCODED_CHANNELS, 
  verifyAllChannels, 
  buildDynamicLockMessage 
} = require('./verify');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BOT_TOKEN = process.env.BOT_TOKEN;
const OLD_BOT_TOKEN = process.env.OLD_BOT_TOKEN || process.env.BRIDGE_BOT_TOKEN || '8899747292:AAGusFkBrquTmi2gA2DDEm_4f9Woh3Q5XQQ';
const LANDY_BOT_USERNAME = (process.env.LANDY_BOT_USERNAME || 'landytv_bot').replace('@', '').trim();

// Normalize WEB_APP_URL (ensure https:// if user passed domain only)
let rawAppUrl = (process.env.WEB_APP_URL || 'http://localhost:5000').trim();
if (rawAppUrl && !rawAppUrl.startsWith('http://') && !rawAppUrl.startsWith('https://')) {
  rawAppUrl = `https://${rawAppUrl}`;
}
const WEB_APP_URL = rawAppUrl;

console.log('🤖 Telegram Multi-Bot Service Initializing...');
console.log(`📌 Force-Sub Channels Configured (${HARDCODED_CHANNELS.length}):`);
HARDCODED_CHANNELS.forEach(ch => console.log(`   - ${ch.name}: ${ch.url}`));

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
        params: {
          allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"]
        }
      } 
    });
    mainBotInstance = mainBot;

    // Command: /start
    mainBot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const user = msg.from;
      const startParam = match[1] ? match[1].trim() : '';

      if (!user) return;

      // Check if blocked
      const blocked = await isUserBlocked(user.id);
      if (blocked) {
        return mainBot.sendMessage(chatId, '🚫 Your account has been suspended by the administrator.');
      }

      // Save user to Firebase
      await saveOrUpdateUser(user);

      // Strict Dynamic Check for 4 channels
      const { isSubscribed, unjoined } = await verifyAllChannels(mainBot, user.id);

      if (!isSubscribed) {
        const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_main', startParam || 'none');
        return mainBot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => console.error('Main Bot send error:', err.message));
      }

      // Unlocked
      let appUrl = WEB_APP_URL;
      if (startParam) {
        appUrl = `${WEB_APP_URL}?start=${encodeURIComponent(startParam)}`;
      }

      const keyboard = getAppLaunchButtons(appUrl);
      mainBot.sendMessage(chatId, DEFAULT_WELCOME_MSG, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard }
      }).catch(err => console.error('Main Bot send error:', err.message));
    });

    // Callback query for verification (Dynamic Remaining Channel Updates)
    mainBot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data && data.startsWith('verify_main_')) {
        const startParam = data.replace('verify_main_', '');
        const { isSubscribed, unjoined } = await verifyAllChannels(mainBot, user.id);

        if (!isSubscribed) {
          await mainBot.answerCallbackQuery(query.id, {
            text: `⚠️ You still need to join ${unjoined.length} channel(s) below!`,
            show_alert: true
          });

          // Dynamically update the message to show ONLY the remaining unjoined channels!
          const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_main', startParam || 'none');
          return mainBot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
          }).catch(() => {});
        }

        await mainBot.answerCallbackQuery(query.id, {
          text: '🎉 All channels verified! Welcome to Landy TV.'
        });

        await saveOrUpdateUser(user);
        mainBot.deleteMessage(chatId, query.message.message_id).catch(() => {});

        let appUrl = WEB_APP_URL;
        if (startParam && startParam !== 'none') {
          appUrl = `${WEB_APP_URL}?start=${encodeURIComponent(startParam)}`;
        }

        const keyboard = getAppLaunchButtons(appUrl);
        mainBot.sendMessage(chatId, DEFAULT_WELCOME_MSG, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => console.error('Main Bot send error:', err.message));
      }
    });

    // Instant Realtime Channel Leave Detection
    mainBot.on('chat_member', async (update) => {
      try {
        const newMember = update.new_chat_member;
        const oldMember = update.old_chat_member;
        const user = newMember?.user || oldMember?.user;

        if (!user || user.is_bot) return;

        // If user left or was kicked from any channel
        if (newMember && (newMember.status === 'left' || newMember.status === 'kicked')) {
          console.log(`⚠️ [Channel Leave] User ${user.id} (${user.first_name}) left channel ${update.chat?.title || update.chat?.id}`);

          // Check if they are now missing any channel
          const { isSubscribed, unjoined } = await verifyAllChannels(mainBot, user.id);

          if (!isSubscribed) {
            const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_main', 'none');
            const alertText = 
              `⚠️ **Access Revoked!**\n\n` +
              `Aapne channel leave kar diya hai. Landy TV access resume karne ke liye please channel re-join karein:\n\n` +
              text;

            mainBot.sendMessage(user.id, alertText, {
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
              reply_markup: { inline_keyboard: keyboard }
            }).catch(err => {
              console.warn(`[Leave Alert Notice] Could not message user ${user.id}:`, err.message);
            });
          }
        }
      } catch (err) {
        console.error('Error in chat_member handler:', err.message);
      }
    });

    mainBot.on('polling_error', (error) => {
      if (error.code === 'EFATAL' || error.message?.includes('404') || error.message?.includes('401')) {
        console.error('⚠️ Main Bot Token unauthorized or invalid.');
      }
    });

    console.log('✅ Main Landy TV Bot started successfully with smart dynamic 4-channel lock & leave detection!');
  } catch (err) {
    console.error('Failed to start Main Bot:', err.message);
  }
}

// ==============================================================
// 2. OLD / BRIDGE BOT (REDIRECTS USERS TO 4 CHANNELS & LANDY TV)
// ==============================================================
if (OLD_BOT_TOKEN && OLD_BOT_TOKEN !== BOT_TOKEN) {
  try {
    const bridgeBot = new TelegramBot(OLD_BOT_TOKEN, { polling: true });

    // Catch any message or command
    bridgeBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      // Always save user chat ID to Firebase Realtime DB
      await saveOrUpdateUser(user);

      const { isSubscribed, unjoined } = await verifyAllChannels(bridgeBot, user.id);

      if (!isSubscribed) {
        const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_bridge', 'start');
        bridgeBot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => console.error('Bridge Bot send error:', err.message));
      } else {
        const targetBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        bridgeBot.sendMessage(chatId, `🎉 **Access Verified!**\n\nClick below to start Landy TV:`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: "🎬 Open Landy TV Bot", url: targetBotUrl }]]
          }
        }).catch(() => {});
      }
    });

    // Callback query for bridge bot
    bridgeBot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data && data.startsWith('verify_bridge_')) {
        const { isSubscribed, unjoined } = await verifyAllChannels(bridgeBot, user.id);

        if (!isSubscribed) {
          await bridgeBot.answerCallbackQuery(query.id, {
            text: `⚠️ You still need to join ${unjoined.length} channel(s) below!`,
            show_alert: true
          });

          const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_bridge', 'start');
          return bridgeBot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
          }).catch(() => {});
        }

        await bridgeBot.answerCallbackQuery(query.id, {
          text: '🎉 Verified! Opening Landy TV...'
        });

        const targetBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        bridgeBot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        bridgeBot.sendMessage(chatId, `🎉 **All Channels Verified!**\n\nClick below to open Landy TV:`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: "🎬 Open Landy TV Bot", url: targetBotUrl }]]
          }
        }).catch(err => console.error('Bridge Bot redirect error:', err.message));
      }
    });

    console.log('✅ Bridge Bot active with smart channel verification!');
  } catch (err) {
    console.error('Failed to start Bridge Bot:', err.message);
  }
}

module.exports = {
  getMainBot: () => mainBotInstance,
  verifyAllChannels
};
