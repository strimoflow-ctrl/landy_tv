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
const { getBotSettings, saveOrUpdateUser, isUserBlocked } = require('../firebase');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BOT_TOKEN = process.env.BOT_TOKEN;

// Normalize WEB_APP_URL (ensure https:// if user passed domain only)
let rawAppUrl = (process.env.WEB_APP_URL || 'http://localhost:5000').trim();
if (rawAppUrl && !rawAppUrl.startsWith('http://') && !rawAppUrl.startsWith('https://')) {
  rawAppUrl = `https://${rawAppUrl}`;
}
const WEB_APP_URL = rawAppUrl;

console.log('🤖 Telegram Bot Service Starting...');

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.log('⚠️  [NOTICE] No BOT_TOKEN provided in backend/.env.');
  console.log('👉 To activate your Telegram Bot:');
  console.log('   1. Create a bot with @BotFather on Telegram.');
  console.log('   2. Paste the bot token in backend/.env: BOT_TOKEN=123456:ABC-DEF...');
  console.log('   3. Set WEB_APP_URL=https://your-railway-url.up.railway.app\n');
} else {
  try {
    const bot = new TelegramBot(BOT_TOKEN, { polling: true });

    // Clean user-requested Welcome Message
    const DEFAULT_WELCOME_MSG = `Welcome to Landy TV! 💦\n\nEnjoy streaming your favorite premium videos directly inside Telegram.\n\nClick the button below to start watching!`;

    // Helper: Check if user is a member of a channel
    async function checkUserMembership(chatIdOrUsername, userId) {
      try {
        const member = await bot.getChatMember(chatIdOrUsername, userId);
        const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
        return validStatuses.includes(member.status);
      } catch (err) {
        console.warn(`[Bot Warning] Check membership for ${chatIdOrUsername} error: ${err.message}`);
        // If bot is not admin in channel, don't crash - allow access
        return true;
      }
    }

    // Helper: Verify all required channels from DB
    async function verifyAllChannels(userId) {
      const settings = await getBotSettings();
      if (!settings.channelLockEnabled || !settings.channels || settings.channels.length === 0) {
        return { isSubscribed: true, unjoinedChannels: [] };
      }

      const unjoinedChannels = [];
      for (const ch of settings.channels) {
        let target = (ch.chatId || ch.username || '').trim();
        if ((!target || target === '@') && ch.url) {
          const parts = ch.url.split('/').filter(Boolean);
          const last = parts[parts.length - 1];
          if (last && !last.startsWith('+')) {
            target = `@${last.replace('@', '')}`;
          }
        }

        if (target && target.length > 2 && target !== '@') {
          const isMember = await checkUserMembership(target, userId);
          if (!isMember) {
            unjoinedChannels.push(ch);
          }
        }
      }

      return {
        isSubscribed: unjoinedChannels.length === 0,
        unjoinedChannels
      };
    }

    // Build exactly two buttons: [ 📢 Join Channel ] [ 🎬 Watch Now ]
    function getAppLaunchButtons(appUrl, settings) {
      const channelUrl = settings?.channels?.[0]?.url || "https://t.me/landy_tv";
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

    // Command: /start
    bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const user = msg.from;
      const startParam = match[1] ? match[1].trim() : '';

      // Check if user is blocked
      const blocked = await isUserBlocked(user.id);
      if (blocked) {
        return bot.sendMessage(chatId, '🚫 Your account has been suspended by the administrator.');
      }

      // Save user to Firebase
      await saveOrUpdateUser(user);

      // Fetch dynamic settings from Firebase
      const settings = await getBotSettings();

      // Check Channel Lock / Force Subscribe
      const { isSubscribed, unjoinedChannels } = await verifyAllChannels(user.id);

      if (!isSubscribed) {
        // Build lock inline keyboard
        const lockKeyboard = [];
        unjoinedChannels.forEach(ch => {
          lockKeyboard.push([{ text: ch.name || "📢 Join Channel", url: ch.url }]);
        });
        lockKeyboard.push([
          { text: "🔄 Verify Membership", callback_data: `verify_sub_${startParam || 'none'}` }
        ]);

        const lockMsg = settings.lockMessage || 
          `🔒 **Channel Join Required!**\n\nTo access **Landy TV**, you must join our official Telegram channel first.\n\nAfter joining, click the **Verify Membership** button below:`;

        return bot.sendMessage(chatId, lockMsg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: lockKeyboard }
        }).catch(err => console.error('Telegram send message error:', err.message));
      }

      // Unlocked: Send clean welcome text & 2 buttons
      let appUrl = WEB_APP_URL;
      if (startParam) {
        appUrl = `${WEB_APP_URL}?start=${encodeURIComponent(startParam)}`;
      }

      const keyboard = getAppLaunchButtons(appUrl, settings);

      bot.sendMessage(chatId, DEFAULT_WELCOME_MSG, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      }).catch(err => console.error('Telegram send message error:', err.message));
    });

    // Callback Query Handler: Verify Membership button
    bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const user = query.from;
      const data = query.data;

      if (data && data.startsWith('verify_sub_')) {
        const startParam = data.replace('verify_sub_', '');

        // Re-check membership
        const { isSubscribed } = await verifyAllChannels(user.id);

        if (!isSubscribed) {
          return bot.answerCallbackQuery(query.id, {
            text: '⚠️ You have not joined our channel yet! Please join and then verify.',
            show_alert: true
          });
        }

        await bot.answerCallbackQuery(query.id, {
          text: '🎉 Membership verified! Welcome to Landy TV.'
        });

        // Save active user
        await saveOrUpdateUser(user);

        // Delete previous lock message
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

        // Send unlocked message
        const settings = await getBotSettings();
        let appUrl = WEB_APP_URL;
        if (startParam && startParam !== 'none') {
          appUrl = `${WEB_APP_URL}?start=${encodeURIComponent(startParam)}`;
        }

        const keyboard = getAppLaunchButtons(appUrl, settings);

        bot.sendMessage(chatId, DEFAULT_WELCOME_MSG, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }).catch(err => console.error('Telegram send message error:', err.message));
      }
    });

    // Command: /help
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      const settings = await getBotSettings();
      const keyboard = getAppLaunchButtons(WEB_APP_URL, settings);

      bot.sendMessage(chatId, DEFAULT_WELCOME_MSG, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      }).catch(err => console.error('Help message error:', err.message));
    });

    bot.on('polling_error', (error) => {
      if (error.code === 'EFATAL' || error.message?.includes('404 Not Found')) {
        console.error('⚠️ Telegram Bot Token invalid or unauthorized. Please check BOT_TOKEN in .env');
      }
    });

    console.log('✅ Telegram Bot is LIVE and listening for commands with Channel Lock!\n');
  } catch (err) {
    console.error('Failed to initialize Telegram Bot:', err.message);
  }
}
