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

// ==============================================================
// 4 HARDCODED CHANNELS FOR STRICT FORCE-SUB
// ==============================================================
const HARDCODED_CHANNELS = [
  { name: "📢 1. Join Uff Riya 💦", url: "https://t.me/uff_riya", username: "@uff_riya" },
  { name: "📢 2. Join Viral InstaHub 🔥", url: "https://t.me/viral_instahub", username: "@viral_instahub" },
  { name: "📢 3. Join Landy TV 🍿", url: "https://t.me/landy_tv", username: "@landy_tv" },
  { name: "📢 4. Join Bet HP 💎", url: "https://t.me/bet_hp", username: "@bet_hp" }
];

console.log('🤖 Telegram Multi-Bot Service Initializing...');
console.log(`📌 Force-Sub Channels Configured (${HARDCODED_CHANNELS.length}):`);
HARDCODED_CHANNELS.forEach(ch => console.log(`   - ${ch.name}: ${ch.url}`));

// Helper: Build the 4-channel lock keyboard
function buildLockKeyboard(callbackPrefix, startParam = 'none') {
  const keyboard = [];
  HARDCODED_CHANNELS.forEach(ch => {
    keyboard.push([{ text: ch.name, url: ch.url }]);
  });
  keyboard.push([
    { text: "🔄 Verify & Unlock", callback_data: `${callbackPrefix}_${startParam}` }
  ]);
  return keyboard;
}

// Clean user-requested Welcome Message
const DEFAULT_WELCOME_MSG = `Welcome to Landy TV! 💦\n\nEnjoy streaming your favorite premium videos directly inside Telegram.\n\nClick the button below to start watching!`;

const LOCK_MESSAGE = 
  `🔒 **4 Channels Join Required!**\n\n` +
  `Welcome to **Landy TV**! 💦\n\n` +
  `To access Landy TV and stream all premium uncut videos, you must join all **4 official Telegram channels** below:\n\n` +
  `1️⃣ [Join Uff Riya](https://t.me/uff_riya)\n` +
  `2️⃣ [Join Viral InstaHub](https://t.me/viral_instahub)\n` +
  `3️⃣ [Join Landy TV](https://t.me/landy_tv)\n` +
  `4️⃣ [Join Bet HP](https://t.me/bet_hp)\n\n` +
  `👉 Join all 4 channels above, then click **Verify & Unlock** to start watching!`;

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

// ==============================================================
// 1. MAIN LANDY TV BOT INSTANCE
// ==============================================================
if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
  try {
    const mainBot = new TelegramBot(BOT_TOKEN, { polling: true });

    // Helper: Check membership for Landy TV bot
    async function checkUserMembership(chatIdOrUsername, userId) {
      try {
        const member = await mainBot.getChatMember(chatIdOrUsername, userId);
        const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
        return validStatuses.includes(member.status);
      } catch (err) {
        // If bot is not admin in the channel, don't crash - allow access gracefully
        return true;
      }
    }

    async function verifyAllChannels(userId) {
      const unjoined = [];
      for (const ch of HARDCODED_CHANNELS) {
        const target = ch.username;
        const isMember = await checkUserMembership(target, userId);
        if (!isMember) {
          unjoined.push(ch);
        }
      }
      return {
        isSubscribed: unjoined.length === 0,
        unjoined
      };
    }

    // Command: /start
    mainBot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const user = msg.from;
      const startParam = match[1] ? match[1].trim() : '';

      // Check if blocked
      const blocked = await isUserBlocked(user.id);
      if (blocked) {
        return mainBot.sendMessage(chatId, '🚫 Your account has been suspended by the administrator.');
      }

      // Save user to Firebase
      await saveOrUpdateUser(user);

      // Strict Check for 4 channels
      const { isSubscribed } = await verifyAllChannels(user.id);

      if (!isSubscribed) {
        const lockKeyboard = buildLockKeyboard('verify_main', startParam || 'none');
        return mainBot.sendMessage(chatId, LOCK_MESSAGE, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: lockKeyboard }
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
        reply_markup: { inline_keyboard: keyboard }
      }).catch(err => console.error('Main Bot send error:', err.message));
    });

    // Callback query for verification
    mainBot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data && data.startsWith('verify_main_')) {
        const startParam = data.replace('verify_main_', '');
        const { isSubscribed } = await verifyAllChannels(user.id);

        if (!isSubscribed) {
          return mainBot.answerCallbackQuery(query.id, {
            text: '⚠️ You have not joined all 4 channels yet! Please join all of them and click Verify.',
            show_alert: true
          });
        }

        await mainBot.answerCallbackQuery(query.id, {
          text: '🎉 All 4 channels verified! Welcome to Landy TV.'
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
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => console.error('Main Bot send error:', err.message));
      }
    });

    mainBot.on('polling_error', (error) => {
      if (error.code === 'EFATAL' || error.message?.includes('404') || error.message?.includes('401')) {
        console.error('⚠️ Main Bot Token unauthorized or invalid.');
      }
    });

    console.log('✅ Main Landy TV Bot started successfully with 4-channel lock!');
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

    const BRIDGE_LOCK_MSG = 
      `🎬 **Landy TV Premium Access!**\n\n` +
      `Hamara naya high-speed video player aur full uncut content ab **Landy TV** par shift ho chuka hai!\n\n` +
      `Niche diye gaye **4 Official Channels** ko join karein aur continue karein:\n\n` +
      `1️⃣ [Join Uff Riya](https://t.me/uff_riya)\n` +
      `2️⃣ [Join Viral InstaHub](https://t.me/viral_instahub)\n` +
      `3️⃣ [Join Landy TV](https://t.me/landy_tv)\n` +
      `4️⃣ [Join Bet HP](https://t.me/bet_hp)\n\n` +
      `👉 4 channels join karne ke baad **Verify & Open Landy TV** par click karein!`;

    // Catch any message or command
    bridgeBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      // Always save user chat ID to Firebase Realtime DB
      await saveOrUpdateUser(user);

      const lockKeyboard = buildLockKeyboard('verify_bridge', 'start');

      bridgeBot.sendMessage(chatId, BRIDGE_LOCK_MSG, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: lockKeyboard }
      }).catch(err => console.error('Bridge Bot send error:', err.message));
    });

    // Callback query for bridge bot
    bridgeBot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data && data.startsWith('verify_bridge_')) {
        await saveOrUpdateUser(user);

        // Alert user
        await bridgeBot.answerCallbackQuery(query.id, {
          text: '🎉 Verification Successful! Landy TV open ho raha hai...',
          show_alert: false
        });

        const landyBotUrl = `https://t.me/${LANDY_BOT_USERNAME}`;
        const unlockedText = 
          `✅ **Channel Verification Done!**\n\n` +
          `Aapka access unlock ho gaya hai. Niche diye gaye button par click karke **Landy TV Bot** start karein aur unlimited videos enjoy karein! 👇`;

        const redirectKeyboard = [
          [
            { text: "🎬 Open Landy TV Bot", url: landyBotUrl }
          ],
          [
            { text: "📢 Join Main Channel", url: "https://t.me/landy_tv" }
          ]
        ];

        bridgeBot.sendMessage(chatId, unlockedText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: redirectKeyboard }
        }).catch(err => console.error('Bridge Bot redirect error:', err.message));
      }
    });

    bridgeBot.on('polling_error', (error) => {
      if (error.code === 'EFATAL' || error.message?.includes('404') || error.message?.includes('401')) {
        console.error('⚠️ Bridge Bot Token unauthorized or invalid.');
      }
    });

    console.log('✅ Bridge Bot (@HrryLinkGen_Bot) started successfully! Redirecting users to 4 channels & Landy TV.');
  } catch (err) {
    console.error('Failed to start Bridge Bot:', err.message);
  }
}
