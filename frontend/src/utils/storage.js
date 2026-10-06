// Storage helper for Saved Bookmarks and Watch History with Firebase sync

const SAVED_KEY = 'landy_saved_videos';
const HISTORY_KEY = 'landy_watch_history';

function getUserId() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'guest_user';
}

export function getSavedVideos() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function isVideoSaved(videoUrl) {
  const list = getSavedVideos();
  return list.some(v => v.url === videoUrl);
}

export function setSavedVideosLocal(list) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

export function toggleSaveVideo(video) {
  let list = getSavedVideos();
  const exists = list.some(v => v.url === video.url);
  if (exists) {
    list = list.filter(v => v.url !== video.url);
  } else {
    list.unshift(video);
  }
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));

  // Sync to Firebase in background so bookmarks never get lost
  const userId = getUserId();
  if (userId && userId !== 'guest_user') {
    fetch('/api/user/saved-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, savedVideos: list })
    }).catch(err => console.warn('Firebase saved videos sync error:', err));
  }

  return !exists;
}

export async function syncSavedVideosFromFirebase(userId) {
  if (!userId || userId === 'guest_user') return getSavedVideos();
  try {
    const res = await fetch(`/api/user/data?userId=${userId}`);
    const json = await res.json();
    if (json.success && json.data && Array.isArray(json.data.savedVideos)) {
      const fbList = json.data.savedVideos;
      const localList = getSavedVideos();
      
      // Merge unique
      const map = new Map();
      fbList.forEach(v => map.set(v.url, v));
      localList.forEach(v => map.set(v.url, v));
      const merged = Array.from(map.values());
      
      setSavedVideosLocal(merged);
      return merged;
    }
  } catch (e) {
    console.warn('Could not sync saved videos from Firebase:', e);
  }
  return getSavedVideos();
}

export function getWatchHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function addToWatchHistory(video) {
  if (!video || !video.url) return;
  let list = getWatchHistory();
  list = list.filter(v => v.url !== video.url);
  list.unshift({
    ...video,
    watchedAt: Date.now()
  });
  if (list.length > 100) list = list.slice(0, 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

export function clearWatchHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
