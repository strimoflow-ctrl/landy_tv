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
const { saveOrUpdateUser } = require('../firebase');
const { 
  HARDCODED_CHANNELS, 
  verifyAllChannels, 
  buildDynamicLockMessage 
} = require('./verify');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const HERRY_BOT_TOKEN = process.env.HERRY_BOT_TOKEN || process.env.HERRYBOTTOKEN || '8899747292:AAGusFkBrquTmi2gA2DDEm_4f9Woh3Q5XQQ';
const LANDY_BOT_USERNAME = (process.env.LANDY_BOT_USERNAME || 'landytv_bot').replace('@', '').trim();

if (!HERRY_BOT_TOKEN || HERRY_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.log('⚠️ [NOTICE] No HERRY_BOT_TOKEN configured.');
} else {
  try {
    const harryBot = new TelegramBot(HERRY_BOT_TOKEN, { polling: true });

    // Catch ANY message (command, text, video, document) from users
    harryBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        await saveOrUpdateUser(user);
      } catch (err) {
        console.warn('[Harry Bot] User save notice:', err.message);
      }

      const { isSubscribed, unjoined } = await verifyAllChannels(harryBot, user.id);

      if (!isSubscribed) {
        const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_harry', 'start');
        harryBot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => console.error('Harry Bot message error:', err.message));
      } else {
        const landyBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        harryBot.sendMessage(chatId, `🎉 **Access Verified!**\n\nClick below to open Landy TV Bot:`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: "🎬 Open Landy TV Bot", url: landyBotUrl }]]
          }
        }).catch(() => {});
      }
    });

    // Handle Callback Query when user clicks "Verify & Open Landy TV"
    harryBot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data && data.startsWith('verify_harry')) {
        try {
          await saveOrUpdateUser(user);
        } catch (e) {}

        const { isSubscribed, unjoined } = await verifyAllChannels(harryBot, user.id);

        if (!isSubscribed) {
          await harryBot.answerCallbackQuery(query.id, {
            text: `⚠️ You still need to join ${unjoined.length} channel(s) below!`,
            show_alert: true
          }).catch(() => {});

          const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_harry', 'start');
          return harryBot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
          }).catch(() => {});
        }

        await harryBot.answerCallbackQuery(query.id, {
          text: '🎉 All channels verified! Opening Landy TV...',
          show_alert: false
        }).catch(() => {});

        const landyBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        harryBot.deleteMessage(chatId, query.message.message_id).catch(() => {});

        const unlockedText = 
          `✅ **Verification Successful!**\n\n` +
          `Aapka access unlock ho chuka hai. Niche diye gaye button par click karke **Landy TV Bot** start karein! 👇`;

        const redirectKeyboard = [
          [{ text: "🎬 Open Landy TV Bot", url: landyBotUrl }],
          [{ text: "📢 Join Main Channel", url: "https://t.me/landy_tv" }]
        ];

        harryBot.sendMessage(chatId, unlockedText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: redirectKeyboard }
        }).catch(err => console.error('Harry Bot redirect error:', err.message));
      }
    });

    harryBot.on('polling_error', (error) => {
      if (error.code === 'EFATAL' || error.message?.includes('404') || error.message?.includes('401')) {
        console.error('⚠️ [Harry Bot] Token invalid or unauthorized:', error.message);
      }
    });

    console.log(`✅ Harry Bot is LIVE with smart dynamic 4-channel verification!`);
  } catch (err) {
    console.error('Failed to initialize Harry Bot:', err.message);
  }
}
