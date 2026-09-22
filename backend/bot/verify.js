// Shared Verification & Dynamic Force-Sub Module for Landy TV Network

const HARDCODED_CHANNELS = [
  { name: "📢 Join Uff Riya 💦", url: "https://t.me/uff_riya", username: "@uff_riya" },
  { name: "📢 Join Viral InstaHub 🔥", url: "https://t.me/viral_instahub", username: "@viral_instahub" },
  { name: "📢 Join Landy TV 🍿", url: "https://t.me/landy_tv", username: "@landy_tv" },
  { name: "📢 Join Bet HP 💎", url: "https://t.me/bet_hp", username: "@bet_hp" }
];

/**
 * Check if a user is a member of a given channel/chat.
 */
async function checkUserMembership(botInstance, chatIdOrUsername, userId) {
  if (!botInstance || !userId) return false;
  try {
    const member = await botInstance.getChatMember(chatIdOrUsername, userId);
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    return validStatuses.includes(member.status);
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    
    // User is definitely NOT a member if Telegram says user not found / participant invalid
    if (msg.includes('user not found') || msg.includes('participant') || msg.includes('chat not found')) {
      return false;
    }
    
    // If the bot itself is not an admin in the channel (e.g. member list inaccessible)
    if (msg.includes('admin') || msg.includes('inaccessible')) {
      console.warn(`[ForceSub] Bot is not admin in ${chatIdOrUsername}: ${err.message}`);
      // Gracefully treat as allowed if bot lacks admin rights so legitimate users aren't stuck
      return true;
    }

    return false;
  }
}

/**
 * Verify user against all 4 hardcoded channels.
 */
async function verifyAllChannels(botInstance, userId) {
  const unjoined = [];
  
  if (!userId) {
    return { isSubscribed: true, unjoined: [], joinedCount: 4, totalCount: HARDCODED_CHANNELS.length };
  }

  for (const ch of HARDCODED_CHANNELS) {
    const isMember = await checkUserMembership(botInstance, ch.username, userId);
    if (!isMember) {
      unjoined.push(ch);
    }
  }

  return {
    isSubscribed: unjoined.length === 0,
    unjoined,
    joinedCount: HARDCODED_CHANNELS.length - unjoined.length,
    totalCount: HARDCODED_CHANNELS.length
  };
}

/**
 * Build dynamic message text and inline keyboard based on unjoined channels.
 * No channel IDs or URLs in message body; only buttons below.
 */
function buildDynamicLockMessage(unjoined, callbackPrefix = 'verify_main', startParam = 'none') {
  const total = HARDCODED_CHANNELS.length;
  const remaining = unjoined.length;

  let text = '';
  if (remaining >= total) {
    text = 
      `Welcome to **Landy TV**! 💦\n\n` +
      `To access Landy TV and stream all premium uncut videos, you must join all **4 official Telegram channels** below:`;
  } else {
    text = 
      `Welcome to **Landy TV**! 💦\n\n` +
      `To access Landy TV and stream all premium uncut videos, you must join the remaining **${remaining} official Telegram channel${remaining > 1 ? 's' : ''}** below:`;
  }

  const keyboard = [];
  unjoined.forEach(ch => {
    keyboard.push([{ text: ch.name, url: ch.url }]);
  });

  keyboard.push([
    { text: "🔄 Verify & Unlock", callback_data: `${callbackPrefix}_${startParam}` }
  ]);

  return { text, keyboard };
}

module.exports = {
  HARDCODED_CHANNELS,
  checkUserMembership,
  verifyAllChannels,
  buildDynamicLockMessage
};
