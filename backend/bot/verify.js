// Shared Verification & Dynamic Force-Sub Module for Landy TV Network
const { getBotSettings } = require('../firebase');

const DEFAULT_CHANNELS = [
  { name: "📢 Join Uff Riya 💦", url: "https://t.me/uff_riya", username: "@uff_riya" },
  { name: "📢 Join Viral InstaHub 🔥", url: "https://t.me/viral_instahub", username: "@viral_instahub" },
  { name: "📢 Join Landy TV 🍿", url: "https://t.me/landy_tv", username: "@landy_tv" },
  { name: "📢 Join Bet HP 💎", url: "https://t.me/bet_hp", username: "@bet_hp" }
];

async function getActiveChannels() {
  try {
    const settings = await getBotSettings();
    if (settings && Array.isArray(settings.channels) && settings.channels.length > 0) {
      return {
        channels: settings.channels,
        enabled: settings.channelLockEnabled !== false
      };
    }
  } catch (e) {}
  return { channels: DEFAULT_CHANNELS, enabled: true };
}

/**
 * Check if a user is a member of a given channel/chat.
 */
async function checkUserMembership(botInstance, chatIdOrUsername, userId) {
  if (!botInstance || !userId || !chatIdOrUsername) return false;
  try {
    const member = await botInstance.getChatMember(chatIdOrUsername, userId);
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    return validStatuses.includes(member.status);
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    
    // User is definitely NOT a member if Telegram says user not found / participant invalid / user left
    if (msg.includes('user not found') || msg.includes('participant') || msg.includes('left') || msg.includes('kicked')) {
      return false;
    }
    
    // If the bot itself is not an admin in the channel or chat is private/inaccessible
    if (msg.includes('admin') || msg.includes('inaccessible') || msg.includes('chat not found') || msg.includes('bot is not')) {
      console.warn(`[ForceSub Warning] Bot cannot access ${chatIdOrUsername}: ${err.message}`);
      // Gracefully treat as allowed so legitimate users aren't stuck on inaccessible channels
      return true;
    }

    return false;
  }
}

/**
 * Verify user against all dynamic channels from Firebase.
 */
async function verifyAllChannels(botInstance, userId) {
  const { channels, enabled } = await getActiveChannels();

  // If force sub is disabled globally from admin panel or no user id
  if (!enabled || !userId || String(userId) === '100000001') {
    return { isSubscribed: true, unjoined: [], joinedCount: channels.length, totalCount: channels.length, channels };
  }

  const unjoined = [];
  for (const ch of channels) {
    // 1. Resolve proper public target (prefer username e.g. @uff_riya, @landy_tv)
    let target = ch.username;
    if (!target && (ch.link || ch.url)) {
      const match = (ch.link || ch.url).match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (match && !match[1].startsWith('+')) {
        target = '@' + match[1];
      }
    }
    if (target && !target.startsWith('@') && !target.startsWith('-100')) {
      target = '@' + target;
    }
    if (!target) {
      target = ch.chatId || ch.id;
    }

    // Special fallback for Bet HP if username was misconfigured
    if (target === '@bethp_official' || target === 'bethp_official') {
      target = '@bet_hp';
    }

    const isMember = await checkUserMembership(botInstance, target, userId);
    if (!isMember) {
      unjoined.push(ch);
    }
  }

  return {
    isSubscribed: unjoined.length === 0,
    unjoined,
    joinedCount: channels.length - unjoined.length,
    totalCount: channels.length,
    channels
  };
}

/**
 * Build dynamic message text and inline keyboard based on unjoined channels.
 */
function buildDynamicLockMessage(unjoined, callbackPrefix = 'verify_main', startParam = 'none', totalCount = 4) {
  const remaining = unjoined.length;

  let text = 
    `Welcome to *Landy TV*! 💦\n\n` +
    `To access Landy TV and stream all premium uncut videos, you must join the *${remaining} official Telegram channel${remaining > 1 ? 's' : ''}* below:`;

  const keyboard = [];
  unjoined.forEach(ch => {
    const title = ch.name ? (ch.name.startsWith('📢') ? ch.name : `📢 Join ${ch.name}`) : '📢 Join Channel';
    let url = ch.url || ch.link;
    if (!url && ch.username) {
      url = `https://t.me/${ch.username.replace('@', '')}`;
    }
    if (!url) {
      url = 'https://t.me/landy_tv';
    }
    keyboard.push([{ text: title, url: url }]);
  });

  keyboard.push([
    { text: "🔄 Verify & Unlock", callback_data: `${callbackPrefix}_${startParam}` }
  ]);

  return { text, keyboard };
}

module.exports = {
  getActiveChannels,
  checkUserMembership,
  verifyAllChannels,
  buildDynamicLockMessage
};

