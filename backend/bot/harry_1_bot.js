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

// ==============================================================
// 4 HARDCODED CHANNELS FOR FORCE-SUB PROMOTION
// ==============================================================
const HARDCODED_CHANNELS = [
  { name: "📢 1. Join Uff Riya 💦", url: "https://t.me/uff_riya", username: "@uff_riya" },
  { name: "📢 2. Join Viral InstaHub 🔥", url: "https://t.me/viral_instahub", username: "@viral_instahub" },
  { name: "📢 3. Join Landy TV 🍿", url: "https://t.me/landy_tv", username: "@landy_tv" },
  { name: "📢 4. Join Bet HP 💎", url: "https://t.me/bet_hp", username: "@bet_hp" }
];

console.log('🤖 Harry 1 Bot (@hrrrrrrrrry_bot) Initializing...');

if (!HARRY_1_BOT_TOKEN || HARRY_1_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.log('⚠️ [NOTICE] No HARRY_1_BOT_TOKEN configured in backend/.env');
} else {
  try {
    const bot = new TelegramBot(HARRY_1_BOT_TOKEN, { polling: true });

    // Helper: Build the 4-channel lock keyboard
    function buildHarry1LockKeyboard() {
      const keyboard = [];
      HARDCODED_CHANNELS.forEach(ch => {
        keyboard.push([{ text: ch.name, url: ch.url }]);
      });
      keyboard.push([
        { text: "🔄 Verify & Open Landy TV 🎬", callback_data: "verify_harry1" }
      ]);
      return keyboard;
    }

    const HARRY1_PROMO_MSG = 
      `✨ **Welcome to Landy TV VIP Network!** ✨\n\n` +
      `Bihar Board, Premium Notes aur Unlimited Uncut Videos ka access ab **Landy TV** par live hai!\n\n` +
      `Access unlock karne ke liye pehle niche diye gaye **4 Official Channels** ko join karein:\n\n` +
      `1️⃣ [Join Uff Riya](https://t.me/uff_riya)\n` +
      `2️⃣ [Join Viral InstaHub](https://t.me/viral_instahub)\n` +
      `3️⃣ [Join Landy TV](https://t.me/landy_tv)\n` +
      `4️⃣ [Join Bet HP](https://t.me/bet_hp)\n\n` +
      `👉 Chaaro channels join karne ke baad **Verify & Open Landy TV** par click karein!`;

    // Catch ANY message (command, text, media)
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      // Automatically store/update user in Firebase Realtime DB
      try {
        await saveOrUpdateUser(user);
      } catch (err) {
        console.warn('[Harry 1 Bot] User save notice:', err.message);
      }

      const keyboard = buildHarry1LockKeyboard();

      bot.sendMessage(chatId, HARRY1_PROMO_MSG, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard }
      }).catch(err => console.error('Harry 1 Bot message error:', err.message));
    });

    // Callback Query Handler
    bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data === 'verify_harry1') {
        try {
          await saveOrUpdateUser(user);
        } catch (e) {}

        // Immediate responsive popup alert
        await bot.answerCallbackQuery(query.id, {
          text: '🎉 Verification Successful! Landy TV open ho raha hai...',
          show_alert: false
        }).catch(() => {});

        const landyBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        const unlockedText = 
          `✅ **Verification Successful!**\n\n` +
          `Aapka access unlock ho chuka hai. Niche diye gaye button par click karke **Landy TV Bot** start karein aur unlimited streaming enjoy karein! 👇`;

        const redirectKeyboard = [
          [
            { text: "🎬 Open Landy TV Bot", url: landyBotUrl }
          ],
          [
            { text: "📢 Join Main Channel", url: "https://t.me/landy_tv" }
          ]
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

    console.log(`✅ Harry 1 Bot (@hrrrrrrrrry_bot) is LIVE! Sending 4 channels and redirecting to Landy TV.`);
  } catch (err) {
    console.error('Failed to initialize Harry 1 Bot:', err.message);
  }
}
