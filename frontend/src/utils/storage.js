// Storage helper for Saved Bookmarks and Watch History

const SAVED_KEY = 'landy_saved_videos';
const HISTORY_KEY = 'landy_watch_history';

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

export function toggleSaveVideo(video) {
  let list = getSavedVideos();
  const exists = list.some(v => v.url === video.url);
  if (exists) {
    list = list.filter(v => v.url !== video.url);
  } else {
    list.unshift(video);
  }
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  return !exists;
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
