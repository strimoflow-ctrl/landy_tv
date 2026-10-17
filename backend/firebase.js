const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from process or .env files
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBC_EvTsMlad61GfcNGZaQb927k5FAQ0u0",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "landytv-27da4.firebaseapp.com",
  databaseURL: (process.env.FIREBASE_DATABASE_URL || "https://landytv-27da4-default-rtdb.asia-southeast1.firebasedatabase.app").replace(/\/$/, ''),
  projectId: process.env.FIREBASE_PROJECT_ID || "landytv-27da4",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "landytv-27da4.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "764869287968",
  appId: process.env.FIREBASE_APP_ID || "1:764869287968:web:3722e4f83ea234052c9c45"
};

const DB_URL = (process.env.FIREBASE_DATABASE_URL || firebaseConfig.databaseURL).replace(/\/$/, '');
console.log(`[Firebase] Configured Database URL: ${DB_URL}`);

// Default fallback settings if none in DB
const DEFAULT_BOT_SETTINGS = {
  welcomeText: "Welcome to Landy TV! 💦\n\nEnjoy streaming your favorite premium videos directly inside Telegram.\n\nClick the button below to start watching!",
  lockMessage: "To access Landy TV and stream all premium uncut videos, you must join all official Telegram channels below:",
  channels: [
    { name: "📢 Join Uff Riya 💦", url: "https://t.me/uff_riya", username: "@uff_riya" },
    { name: "📢 Join Viral InstaHub 🔥", url: "https://t.me/viral_instahub", username: "@viral_instahub" },
    { name: "📢 Join Landy TV 🍿", url: "https://t.me/landy_tv", username: "@landy_tv" },
    { name: "📢 Join Bet HP 💎", url: "https://t.me/bet_hp", username: "@bet_hp" }
  ],
  supportUrl: "https://t.me/landy_tv",
  channelLockEnabled: true,
  referralRewardSeconds: 1800, // 30 minutes free watch time per referral
  newUserBonusSeconds: 300 // +5 minutes bonus for new invited user (total 10 min)
};

let cachedSettings = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Fetch bot settings from Firebase Realtime Database
 */
async function getBotSettings() {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsFetch < SETTINGS_CACHE_TTL)) {
    return cachedSettings;
  }

  try {
    const res = await axios.get(`${DB_URL}/bot_settings.json`, { timeout: 6000 });
    if (res.data) {
      cachedSettings = { ...DEFAULT_BOT_SETTINGS, ...res.data };
      lastSettingsFetch = now;
      return cachedSettings;
    } else {
      // Initialize defaults in Firebase
      await axios.put(`${DB_URL}/bot_settings.json`, DEFAULT_BOT_SETTINGS, { timeout: 6000 });
      cachedSettings = DEFAULT_BOT_SETTINGS;
      lastSettingsFetch = now;
      return cachedSettings;
    }
  } catch (err) {
    console.warn('[Firebase DB] Could not fetch bot settings, using defaults:', err.message);
    return cachedSettings || DEFAULT_BOT_SETTINGS;
  }
}

/**
 * Update bot settings in Firebase
 */
async function updateBotSettings(settings) {
  try {
    const updated = { ...(cachedSettings || DEFAULT_BOT_SETTINGS), ...settings };
    await axios.put(`${DB_URL}/bot_settings.json`, updated, { timeout: 6000 });
    cachedSettings = updated;
    lastSettingsFetch = Date.now();
    return { success: true, settings: updated };
  } catch (err) {
    console.error('[Firebase DB] Update settings error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Save or update user in Firebase
 */
async function saveOrUpdateUser(user) {
  if (!user || !user.id) return null;
  const userId = String(user.id);
  const now = Date.now();

  try {
    // Check existing
    let existing = null;
    try {
      const getRes = await axios.get(`${DB_URL}/users/${userId}.json`, { timeout: 5000 });
      existing = getRes.data;
    } catch (e) {}

    const payload = {
      id: userId,
      first_name: user.first_name !== undefined ? user.first_name : (existing?.first_name || ''),
      last_name: user.last_name !== undefined ? user.last_name : (existing?.last_name || ''),
      username: user.username !== undefined ? user.username : (existing?.username || ''),
      photo_url: user.photo_url !== undefined ? user.photo_url : (existing?.photo_url || ''),
      isBlocked: typeof user.isBlocked === 'boolean' ? user.isBlocked : Boolean(existing?.isBlocked),
      joinedAt: existing?.joinedAt || now,
      lastActive: now,
      // Default 1800s (30 minutes) free watch time gift for users
      watchTimeSeconds: existing?.watchTimeSeconds !== undefined ? existing.watchTimeSeconds : 1800,
      savedVideos: existing?.savedVideos || [],
      adPacksProgress: existing?.adPacksProgress || {},
      referredBy: existing?.referredBy || null,
      referralProcessed: existing?.referralProcessed !== undefined ? existing.referralProcessed : false,
      referralCount: existing?.referralCount !== undefined ? existing.referralCount : 0
    };

    await axios.put(`${DB_URL}/users/${userId}.json`, payload, { timeout: 5000 });
    return payload;
  } catch (err) {
    console.warn(`[Firebase DB] Error saving user ${userId}:`, err.message);
    return null;
  }
}

/**
 * Process referral: credit both referrer and new user if eligible.
 * Strictly prevents self-referrals, existing user abuse, and circular referral loops.
 */
async function processReferral(newUserId, referrerId, botInstance = null, isBrandNewVerified = false) {
  if (!newUserId || !referrerId) return { success: false, reason: 'missing_ids' };
  const uid = String(newUserId);
  const refId = String(referrerId);
  if (uid === refId) return { success: false, reason: 'self_referral' };

  try {
    const newUser = await getUserData(uid);
    if (!newUser) {
      return { success: false, reason: 'user_not_found' };
    }

    // 1. If user already was referred or referral already processed, reject
    if (newUser.referredBy || newUser.referralProcessed) {
      return { success: false, reason: 'already_referred' };
    }

    // 2. Strict New User Verification:
    // If not verified as brand-new at initial /start, check DB indicators to block existing users
    if (!isBrandNewVerified) {
      const now = Date.now();
      const joinedAt = Number(newUser.joinedAt) || 0;
      // If user joined more than 5 minutes ago, they are an existing user
      if (joinedAt > 0 && (now - joinedAt > 5 * 60 * 1000)) {
        console.log(`[Referral Ignored] User ${uid} joined earlier (${Math.round((now - joinedAt) / 1000)}s ago) - existing user.`);
        await axios.patch(`${DB_URL}/users/${uid}.json`, { referralProcessed: true }).catch(() => {});
        return { success: false, reason: 'already_existing_user' };
      }

      // If user already invited someone before, they are an existing active user
      if (Number(newUser.referralCount) > 0) {
        await axios.patch(`${DB_URL}/users/${uid}.json`, { referralProcessed: true }).catch(() => {});
        return { success: false, reason: 'already_existing_user' };
      }

      // If user has saved videos or ad pack progress
      if ((Array.isArray(newUser.savedVideos) && newUser.savedVideos.length > 0) || 
          (newUser.adPacksProgress && Object.keys(newUser.adPacksProgress).length > 0)) {
        await axios.patch(`${DB_URL}/users/${uid}.json`, { referralProcessed: true }).catch(() => {});
        return { success: false, reason: 'already_existing_user' };
      }
    }

    // 3. Referrer Validation & Strict Anti-Loop Checks
    const referrer = await getUserData(refId);
    if (!referrer) {
      return { success: false, reason: 'referrer_not_found' };
    }

    // Mutual loop prevention: If referrer was referred by this user
    if (referrer.referredBy && String(referrer.referredBy) === uid) {
      console.warn(`[Referral Anti-Fraud] Mutual referral loop detected between ${uid} and ${refId}`);
      await axios.patch(`${DB_URL}/users/${uid}.json`, { referralProcessed: true }).catch(() => {});
      return { success: false, reason: 'mutual_referral_loop' };
    }

    // Multi-hop circular loop prevention: Walk up referral chain (up to 5 hops)
    let currentHop = referrer;
    let hops = 0;
    while (currentHop && currentHop.referredBy && hops < 5) {
      if (String(currentHop.referredBy) === uid) {
        console.warn(`[Referral Anti-Fraud] Circular referral chain detected between ${uid} and ${refId}`);
        await axios.patch(`${DB_URL}/users/${uid}.json`, { referralProcessed: true }).catch(() => {});
        return { success: false, reason: 'circular_loop_detected' };
      }
      hops++;
      if (hops < 5 && currentHop.referredBy) {
        currentHop = await getUserData(currentHop.referredBy);
      } else {
        break;
      }
    }

    const settings = await getBotSettings();
    const referrerRewardSec = Number(settings.referralRewardSeconds) || 1800; // 30 min (1800s) for referrer
    const newUserBonusSec = Number(settings.newUserBonusSeconds) || 300; // +5 min bonus (total 10 min = 600s) for invited user

    // Update new user: save referredBy, referralProcessed: true, and set watch time to 10 min (600s)
    const newUserCurrentTime = newUser?.watchTimeSeconds !== undefined ? Number(newUser.watchTimeSeconds) : 300;
    const finalNewUserTime = Math.max(600, newUserCurrentTime + newUserBonusSec);
    await axios.patch(`${DB_URL}/users/${uid}.json`, {
      referredBy: refId,
      referralProcessed: true,
      referralRewardedAt: Date.now(),
      watchTimeSeconds: finalNewUserTime,
      lastActive: Date.now()
    }, { timeout: 5000 });

    // Update referrer: add +30 min (1800s) bonus time and increment referral count
    const refCurrentTime = referrer?.watchTimeSeconds !== undefined ? Number(referrer.watchTimeSeconds) : 300;
    const refCount = (Number(referrer.referralCount) || 0) + 1;
    await axios.patch(`${DB_URL}/users/${refId}.json`, {
      watchTimeSeconds: refCurrentTime + referrerRewardSec,
      referralCount: refCount,
      lastActive: Date.now()
    }, { timeout: 5000 });

    // Invalidate users cache so admin sees updated counts
    cachedUsers = null;

    // Send Telegram notification to referrer
    if (botInstance) {
      try {
        const rewardMin = Math.round(referrerRewardSec / 60);
        await botInstance.sendMessage(
          refId,
          `🎉 <b>Naya Friend Join Hua!</b>\n\nAapke invite link se ek naye friend ne Landy TV join kiya hai! 🍿\n\nAapko mil gaye hain <b>+${rewardMin} Minutes Free Watch Time</b>! 🔥\nTotal Friends Invited: <b>${refCount}</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        console.warn(`[Referral Notification] Message to ${refId} failed:`, e.message);
      }
    }

    return {
      success: true,
      rewardSeconds: referrerRewardSec,
      newUserRewardSeconds: finalNewUserTime,
      refCount
    };
  } catch (err) {
    console.error('[Process Referral Error]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get User Data from Firebase
 */
async function getUserData(userId) {
  try {
    const res = await axios.get(`${DB_URL}/users/${userId}.json`, { timeout: 5000 });
    return res.data || null;
  } catch (e) {
    return null;
  }
}

/**
 * Update User Watch Time (add/subtract delta seconds)
 */
async function updateUserWatchTime(userId, deltaSeconds) {
  try {
    const uData = await getUserData(userId);
    let current = uData?.watchTimeSeconds !== undefined ? uData.watchTimeSeconds : 300;
    let newTime = Math.max(0, current + Number(deltaSeconds));
    await axios.patch(`${DB_URL}/users/${userId}.json`, { watchTimeSeconds: newTime, lastActive: Date.now() }, { timeout: 5000 });
    return newTime;
  } catch (e) {
    console.warn(`[Firebase DB] Error updating watch time for ${userId}:`, e.message);
    return null;
  }
}

/**
 * Save / Update User Saved Videos in Firebase
 */
async function updateUserSavedVideos(userId, savedVideos) {
  try {
    const validList = Array.isArray(savedVideos) ? savedVideos : [];
    await axios.patch(`${DB_URL}/users/${userId}.json`, { savedVideos: validList, lastActive: Date.now() }, { timeout: 5000 });
    return validList;
  } catch (e) {
    console.warn(`[Firebase DB] Error saving videos for ${userId}:`, e.message);
    return [];
  }
}

/**
 * Update Ad Pack Progress & Add Bonus Time
 */
async function updateAdPackProgress(userId, packId, increment = 1, targetCount = 5, rewardSeconds = 300) {
  try {
    const uData = await getUserData(userId);
    const progress = uData?.adPacksProgress || {};
    let currentCount = (progress[packId] || 0) + increment;
    let watchTime = uData?.watchTimeSeconds !== undefined ? uData.watchTimeSeconds : 300;
    let claimed = false;

    if (currentCount >= targetCount) {
      currentCount = 0; // Reset after claiming reward
      watchTime += rewardSeconds;
      claimed = true;
    }

    progress[packId] = currentCount;

    await axios.patch(`${DB_URL}/users/${userId}.json`, {
      adPacksProgress: progress,
      watchTimeSeconds: watchTime,
      lastActive: Date.now()
    }, { timeout: 5000 });

    return {
      progress: currentCount,
      target: targetCount,
      watchTimeSeconds: watchTime,
      claimed
    };
  } catch (e) {
    console.warn(`[Firebase DB] Error updating ad pack for ${userId}:`, e.message);
    return null;
  }
}

/**
 * Check if a user is blocked
 */
async function isUserBlocked(userId) {
  try {
    const res = await axios.get(`${DB_URL}/users/${userId}/isBlocked.json`, { timeout: 5000 });
    return Boolean(res.data);
  } catch (e) {
    return false;
  }
}

/**
 * Helper to generate Firebase-safe key from URL
 */
function getVideoKey(url) {
  return Buffer.from(url).toString('base64').replace(/[/+=]/g, '_');
}

/**
 * Check if a video was already posted to the channel
 */
async function isVideoAlreadyPosted(url) {
  try {
    const key = getVideoKey(url);
    const res = await axios.get(`${DB_URL}/posted_videos/${key}.json`, { timeout: 5000 });
    return Boolean(res.data);
  } catch (e) {
    return false;
  }
}

/**
 * Mark a video as posted in Firebase (records timestamp & channel)
 */
async function markVideoPosted(video, channelId = '') {
  try {
    const key = getVideoKey(video.url);
    await axios.put(`${DB_URL}/posted_videos/${key}.json`, {
      title: video.title || '',
      url: video.url,
      channel: channelId || '',
      postedAt: Date.now()
    }, { timeout: 5000 });
    return true;
  } catch (e) {
    console.warn('[Firebase DB] Could not mark video as posted:', e.message);
    return false;
  }
}

// ==============================================================
// IN-MEMORY USER CACHE (Saves over 90% Firebase bandwidth)
// ==============================================================
let cachedUsers = null;
let lastUsersFetch = 0;
const USERS_CACHE_TTL = 45 * 1000; // 45 seconds

async function getAllUsers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedUsers && (now - lastUsersFetch < USERS_CACHE_TTL)) {
    return cachedUsers;
  }

  try {
    const res = await axios.get(`${DB_URL}/users.json`, { timeout: 8000 });
    const data = res.data || {};
    cachedUsers = data;
    lastUsersFetch = now;
    return cachedUsers;
  } catch (err) {
    console.warn('[Firebase DB] Could not fetch all users:', err.message);
    return cachedUsers || {};
  }
}

/**
 * Mark a user as botBlocked (user blocked or deleted the bot on Telegram)
 */
async function markUserBotBlocked(userId, isBlocked = true) {
  if (!userId) return;
  const uid = String(userId);
  const now = Date.now();
  try {
    await axios.patch(`${DB_URL}/users/${uid}.json`, {
      botBlocked: Boolean(isBlocked),
      blockedAt: isBlocked ? now : null
    }, { timeout: 5000 });

    if (cachedUsers && cachedUsers[uid]) {
      cachedUsers[uid].botBlocked = Boolean(isBlocked);
      cachedUsers[uid].blockedAt = isBlocked ? now : null;
    }
    return true;
  } catch (err) {
    console.warn(`[Firebase DB] Error marking botBlocked for ${uid}:`, err.message);
    return false;
  }
}

module.exports = {
  firebaseConfig,
  DB_URL,
  getBotSettings,
  updateBotSettings,
  saveOrUpdateUser,
  isUserBlocked,
  getUserData,
  updateUserWatchTime,
  updateUserSavedVideos,
  updateAdPackProgress,
  isVideoAlreadyPosted,
  markVideoPosted,
  getAllUsers,
  markUserBotBlocked,
  processReferral
};


