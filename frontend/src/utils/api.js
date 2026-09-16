// API Client for Landy TV
const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

const API_KEY = 'landyxcryvexsidhu5911';

const defaultHeaders = {
  'Accept': 'application/json',
  'x-api-key': API_KEY
};

/**
 * Fetch realtime endless videos for infinite scroll
 */
export async function fetchVideos(page = 1) {
  try {
    const res = await fetch(`${API_BASE}/videos?page=${page}`, { headers: defaultHeaders });
    const json = await res.json();
    return json.success ? (json.data || []) : [];
  } catch (err) {
    console.error(`Failed to fetch realtime videos for page ${page}:`, err);
    return [];
  }
}

// Backward compatibility alias
export async function fetchAllVideos(page = 1) {
  return fetchVideos(page);
}

export async function fetchTrending(page = 1) {
  return fetchVideos(page);
}

/**
 * Search videos in real-time
 */
export async function searchVideos(query, page = 1) {
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&page=${page}`, { headers: defaultHeaders });
    const json = await res.json();
    return json.success ? (json.data || []) : [];
  } catch (err) {
    console.error('Failed to search videos:', err);
    return [];
  }
}

/**
 * Extract live direct MP4 source
 */
export async function fetchVideoSource(url) {
  try {
    const res = await fetch(`${API_BASE}/video-source?url=${encodeURIComponent(url)}`, { headers: defaultHeaders });
    const json = await res.json();
    if (json.success && json.source) {
      return json.source;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch video source:', err);
    return null;
  }
}

/**
 * Fetch related videos from video details page (supports endless pages)
 */
export async function fetchRelatedVideos(url, page = 1) {
  try {
    const res = await fetch(`${API_BASE}/related?url=${encodeURIComponent(url)}&page=${page}`, { headers: defaultHeaders });
    const json = await res.json();
    return json.success ? (json.data || []) : [];
  } catch (err) {
    console.error('Failed to fetch related videos:', err);
    return [];
  }
}
