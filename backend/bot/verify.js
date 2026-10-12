// Shared Verification & Dynamic Force-Sub Module for Landy TV Network
const { getBotSettings } = require('../firebase');

const DEFAULT_CHANNELS = [
  { id: "uff_riya", name: "📢 Join Uff Riya 💦", url: "https://t.me/uff_riya", username: "@uff_riya", chatId: "-1003933938061" },
  { id: "viral_instahub", name: "📢 Join Viral InstaHub 🔥", url: "https://t.me/viral_instahub", username: "@viral_instahub", chatId: "-1003533323522" },
  { id: "landy_tv", name: "📢 Join Landy TV 🍿", url: "https://t.me/landy_tv", username: "@landy_tv", chatId: "-1003991386094" },
  { id: "bet_hp", name: "📢 Join Bet HP 💎", url: "https://t.me/bet_hp", username: "@bet_hp", chatId: "-1003906917982" }
];

// High-speed direct mapping for numeric chat IDs (eliminates DNS/username lookup latency)
const KNOWN_CHAT_IDS = {
  'uff_riya': '-1003933938061',
  '@uff_riya': '-1003933938061',
  '-1003933938061': '-1003933938061',
  'viral_instahub': '-1003533323522',
  '@viral_instahub': '-1003533323522',
  '-1003533323522': '-1003533323522',
  'landy_tv': '-1003991386094',
  '@landy_tv': '-1003991386094',
  '-1003991386094': '-1003991386094',
  'bet_hp': '-1003906917982',
  '@bet_hp': '-1003906917982',
  '@bethp_official': '-1003906917982',
  '-1003906917982': '-1003906917982'
};

// In-memory verification cache: `${userId}:${chatId}` -> timestamp (24h TTL)
const verifiedCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
 * Checks memory cache, queries numeric ID first, then username with @, and gracefully falls back.
 */
async function checkUserMembership(botInstance, chatIdOrUsername, userId) {
  if (!botInstance || !userId || !chatIdOrUsername) return false;

  const raw = String(chatIdOrUsername).trim();
  const cleanKey = raw.replace('@', '').toLowerCase();
  const numericId = KNOWN_CHAT_IDS[cleanKey] || KNOWN_CHAT_IDS[raw] || null;
  const cacheKey = `${userId}:${numericId || cleanKey}`;

  // 1. Check in-memory verified cache
  const cachedUntil = verifiedCache.get(cacheKey);
  if (cachedUntil && Date.now() < cachedUntil) {
    return true;
  }

  // 2. Targets to try: numeric chat ID first (ultra fast), then username with @
  const targets = [];
  if (numericId) targets.push(numericId);
  if (!cleanKey.startsWith('-100')) {
    targets.push(`@${cleanKey}`);
  }
  if (!targets.includes(raw)) {
    targets.push(raw);
  }

  for (const target of targets) {
    try {
      const member = await botInstance.getChatMember(target, userId);
      const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
      if (validStatuses.includes(member.status)) {
        // Cache successful verification for 24h
        verifiedCache.set(cacheKey, Date.now() + CACHE_TTL_MS);
        return true;
      }
      // If member status is explicitly 'left' or 'kicked', user is definitely not a member
      if (member.status === 'left' || member.status === 'kicked') {
        return false;
      }
    } catch (err) {
      const msg = (err.message || '').toLowerCase();

      // User is definitely NOT a member (explicit Telegram rejection of user)
      if (
        msg.includes('user not found') || 
        msg.includes('participant') || 
        msg.includes('user_not_participant') ||
        msg.includes('participant_id_invalid')
      ) {
        return false;
      }

      // If the bot cannot access chat or chat is private/inaccessible or bot not admin or chat not found
      if (
        msg.includes('admin') || 
        msg.includes('inaccessible') || 
        msg.includes('chat not found') || 
        msg.includes('bot is not') ||
        msg.includes('channel_private')
      ) {
        console.warn(`[ForceSub] Bot cannot access ${target}: ${err.message}. Gracefully allowing access.`);
        verifiedCache.set(cacheKey, Date.now() + CACHE_TTL_MS);
        return true;
      }

      // Telegram Bot API Rate Limits (429) or Network Hiccups (timeout, socket, 502/503/504)
      // NEVER block active users because Telegram is rate-limiting the bot!
      if (
        msg.includes('429') || 
        msg.includes('too many requests') || 
        msg.includes('retry after') ||
        msg.includes('timeout') || 
        msg.includes('econnreset') || 
        msg.includes('network') || 
        msg.includes('socket') || 
        msg.includes('502') || 
        msg.includes('503') || 
        msg.includes('504')
      ) {
        console.warn(`[ForceSub] Telegram API rate limit/network issue for ${target} (${err.message}). Gracefully allowing access.`);
        // Cache for 10 minutes so we don't bombard Telegram API during rate limit spikes
        verifiedCache.set(cacheKey, Date.now() + 10 * 60 * 1000);
        return true;
      }

      console.warn(`[ForceSub] getChatMember warning for ${target}:`, err.message);
    }
  }

  return false;
}

/**
 * Verify user against all dynamic channels in PARALLEL.
 */
async function verifyAllChannels(botInstance, userId) {
  const { channels, enabled } = await getActiveChannels();

  // If force sub is disabled globally or user is in mock/dev mode
  if (!enabled || !userId || String(userId) === '100000001') {
    return { isSubscribed: true, unjoined: [], joinedCount: channels.length, totalCount: channels.length, channels };
  }

  // Fast check: if all channels for this user are cached, return instantly
  const allCacheKey = `${userId}:all_channels_ok`;
  const allCached = verifiedCache.get(allCacheKey);
  if (allCached && Date.now() < allCached) {
    return { isSubscribed: true, unjoined: [], joinedCount: channels.length, totalCount: channels.length, channels };
  }

  // Check all channels concurrently in parallel
  const unjoined = [];
  await Promise.all(
    channels.map(async (ch) => {
      let target = ch.chatId;
      if (!target && ch.username) {
        target = ch.username.startsWith('@') ? ch.username : `@${ch.username}`;
      }
      if (!target && ch.id) {
        target = ch.id.startsWith('-100') ? ch.id : (ch.id.startsWith('@') ? ch.id : `@${ch.id}`);
      }
      if (!target && (ch.link || ch.url)) {
        const match = (ch.link || ch.url).match(/t\.me\/([a-zA-Z0-9_]+)/);
        if (match && !match[1].startsWith('+')) {
          target = '@' + match[1];
        }
      }
      if (!target) target = ch.name;

      // Special alias mapping
      const cleanTarget = String(target).replace('@', '').toLowerCase();
      if (cleanTarget === 'bethp_official') target = '@bet_hp';

      const isMember = await checkUserMembership(botInstance, target, userId);
      if (!isMember) {
        unjoined.push(ch);
      }
    })
  );

  const isSubscribed = unjoined.length === 0;
  if (isSubscribed) {
    verifiedCache.set(allCacheKey, Date.now() + CACHE_TTL_MS);
  }

  return {
    isSubscribed,
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
  buildDynamicLockMessage,
  KNOWN_CHAT_IDS
};
