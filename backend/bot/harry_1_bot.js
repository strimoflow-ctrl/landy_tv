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

// Token for Harry 1 Bot (@hrrrrrrrrry_bot)
const HARRY_1_BOT_TOKEN = (
  process.env.HARRY_1_BOT_TOKEN || 
  process.env.HARRY1_BOT_TOKEN || 
  process.env.HARRY1BOTTOKEN || 
  '8858220246:AAEyh1HdH7X4G3Mxr7-pw_ZXrz5tNVNdrBs'
).trim();

const LANDY_BOT_USERNAME = (process.env.LANDY_BOT_USERNAME || 'landytv_bot').replace('@', '').trim();

console.log('🤖 Harry 1 Bot (@hrrrrrrrrry_bot) Initializing...');

if (!HARRY_1_BOT_TOKEN || HARRY_1_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.log('⚠️ [NOTICE] No HARRY_1_BOT_TOKEN configured in backend/.env');
} else {
  try {
    const bot = new TelegramBot(HARRY_1_BOT_TOKEN, { polling: true });

    // Catch ANY message (command, text, media)
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        await saveOrUpdateUser(user);
      } catch (err) {
        console.warn('[Harry 1 Bot] User save notice:', err.message);
      }

      const { isSubscribed, unjoined } = await verifyAllChannels(bot, user.id);

      if (!isSubscribed) {
        const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_harry1', 'start');
        bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => console.error('Harry 1 Bot message error:', err.message));
      } else {
        const landyBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        bot.sendMessage(chatId, `🎉 **Access Verified!**\n\nClick below to open Landy TV Bot:`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: "🎬 Open Landy TV Bot", url: landyBotUrl }]]
          }
        }).catch(() => {});
      }
    });

    // Callback Query Handler
    bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data && data.startsWith('verify_harry1')) {
        try {
          await saveOrUpdateUser(user);
        } catch (e) {}

        const { isSubscribed, unjoined } = await verifyAllChannels(bot, user.id);

        if (!isSubscribed) {
          await bot.answerCallbackQuery(query.id, {
            text: `⚠️ You still need to join ${unjoined.length} channel(s) below!`,
            show_alert: true
          }).catch(() => {});

          const { text, keyboard } = buildDynamicLockMessage(unjoined, 'verify_harry1', 'start');
          return bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
          }).catch(() => {});
        }

        await bot.answerCallbackQuery(query.id, {
          text: '🎉 All channels verified! Opening Landy TV...',
          show_alert: false
        }).catch(() => {});

        const landyBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

        const unlockedText = 
          `✅ **Verification Successful!**\n\n` +
          `Aapka access unlock ho chuka hai. Niche diye gaye button par click karke **Landy TV Bot** start karein! 👇`;

        const redirectKeyboard = [
          [{ text: "🎬 Open Landy TV Bot", url: landyBotUrl }],
          [{ text: "📢 Join Main Channel", url: "https://t.me/landy_tv" }]
        ];

        bot.sendMessage(chatId, unlockedText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: redirectKeyboard }
        }).catch(err => console.error('Harry 1 Bot redirect error:', err.message));
      }
    });

    bot.on('polling_error', (error) => {
      if (error.code === 'EFATAL' || error.message?.includes('404') || error.message?.includes('401')) {
        console.error('⚠️ [Harry 1 Bot] Token unauthorized or invalid:', error.message);
      }
    });

    console.log(`✅ Harry 1 Bot (@hrrrrrrrrry_bot) is LIVE with smart dynamic verification!`);
  } catch (err) {
    console.error('Failed to initialize Harry 1 Bot:', err.message);
  }
}
