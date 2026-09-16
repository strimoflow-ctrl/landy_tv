const axios = require('axios');

const firebaseConfig = {
  apiKey: "AIzaSyDRWDNd9ybc6RVg0fMGrplt7xZA_HEmrB8",
  authDomain: "anime-net-a89c9.firebaseapp.com",
  databaseURL: "https://anime-net-a89c9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anime-net-a89c9",
  storageBucket: "anime-net-a89c9.firebasestorage.app",
  messagingSenderId: "124019902909",
  appId: "1:124019902909:web:0268a3be96e40c8dcb2ad4"
};

const DB_URL = firebaseConfig.databaseURL.replace(/\/$/, '');

// Default fallback settings if none in DB
const DEFAULT_BOT_SETTINGS = {
  welcomeText: "👋 Hello, **{name}**!\n\nWelcome to **Landy TV** 🍿\n\nStream high quality trending videos and exclusive content directly inside Telegram!",
  lockMessage: "🔒 **Channel Join Required!**\n\nTo access Landy TV, please join our official Telegram channel.\n\nAfter joining, click the **Verify Membership** button below:",
  channels: [
    {
      name: "📢 Join Official Channel",
      url: "https://t.me/landy_tv",
      chatId: "@landy_tv"
    }
  ],
  supportUrl: "https://t.me/fufa_jiii",
  channelLockEnabled: true
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
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      photo_url: user.photo_url || existing?.photo_url || '',
      isBlocked: existing?.isBlocked || false,
      joinedAt: existing?.joinedAt || now,
      lastActive: now
    };

    await axios.put(`${DB_URL}/users/${userId}.json`, payload, { timeout: 5000 });
    return payload;
  } catch (err) {
    console.warn(`[Firebase DB] Error saving user ${userId}:`, err.message);
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

module.exports = {
  firebaseConfig,
  DB_URL,
  getBotSettings,
  updateBotSettings,
  saveOrUpdateUser,
  isUserBlocked
};
