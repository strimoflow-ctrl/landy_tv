// Polyfill File for older Node.js runtimes (Node 18)
if (typeof globalThis.File === 'undefined') {
    try {
        globalThis.File = class File {};
    } catch (e) { }
}

const dns = require('dns');
// Set fast reliable DNS servers
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) { }

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from process, backend/.env or root .env
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());

// Serve frontend static files (production React build in dist)
const distPath = path.join(__dirname, '../frontend/dist');
const legacyFrontendPath = path.join(__dirname, '../frontend');

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
} else {
    app.use(express.static(legacyFrontendPath));
}

// Scraper request configuration
const SCRAPER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache'
};

const REQUEST_TIMEOUT = 10000; // 10 seconds for stable scraping
const BASE_SOURCE_URL = 'https://lalamasa.mobi';

// In-memory cache to ensure blazing fast response
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCached(key, data) {
    if (cache.size > 300) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
    cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

// Helper: Extract video cards from Cheerio parsed DOM
function extractVideos($, baseUrl = BASE_SOURCE_URL) {
    const videos = [];
    const seenUrls = new Set();

    // 1. Primary selector on lalamasa.mobi: article.vcard
    $('article.vcard').each((_, element) => {
        const title = $(element).find('.vtitle').text().trim() || $(element).find('a').attr('title');
        let url = $(element).find('a').first().attr('href') || '';
        if (url && !url.startsWith('http')) {
            url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
        }

        let thumbnail = '';
        const thumbDiv = $(element).find('.thumb');
        const style = thumbDiv.attr('style') || '';
        const bgMatch = style.match(/url\(['"]?(.*?)['"]?\)/i);
        if (bgMatch && bgMatch[1]) {
            thumbnail = bgMatch[1].replace(/&amp;/g, '&');
        } else {
            const mseen = $(element).attr('data-mseen') || $(element).attr('data-vid');
            if (mseen) {
                thumbnail = `https://cdn.masahub.cc/pictures/${mseen}.jpg?class=mthum`;
            }
        }

        const duration = $(element).find('.dur').text().trim() || 'N/A';
        let viewsRaw = $(element).find('.vviews-n').text().trim() || $(element).find('.vviews').text().replace(/[👁\s]/g, '') || 'Hot';
        viewsRaw = viewsRaw.replace(/[👁\s]/g, '').trim();
        if (!viewsRaw) viewsRaw = 'Hot';
        const views = viewsRaw.toLowerCase().includes('views') ? viewsRaw : `${viewsRaw} views`;

        if (title && url && !seenUrls.has(url)) {
            seenUrls.add(url);
            videos.push({
                title: title.trim(),
                url: url.trim(),
                thumbnail: thumbnail ? thumbnail.trim() : '',
                duration,
                views
            });
        }
    });

    // 2. Secondary selector fallback: .vt-card
    if (videos.length === 0) {
        $('.vt-card').each((_, element) => {
            const title = $(element).find('.vt-card-title').text().trim() || $(element).find('.vt-thumb').attr('title');
            let url = $(element).find('a.vt-thumb').attr('href') || $(element).find('a').first().attr('href');
            if (url && !url.startsWith('http')) {
                url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
            }

            let thumbnail = $(element).find('.vt-thumb img').attr('data-src') || $(element).find('.vt-thumb img').attr('src') || '';
            const duration = $(element).find('.vt-duration').text().trim() || 'N/A';
            const views = $(element).find('.vt-card-views').text().trim() || '10K views';

            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                videos.push({
                    title: title.trim(),
                    url: url.trim(),
                    thumbnail: thumbnail ? thumbnail.trim() : '',
                    duration,
                    views
                });
            }
        });
    }

    return videos;
}

// Fetch helper with timeout
async function fetchPage(targetUrl) {
    return await axios.get(targetUrl, {
        headers: SCRAPER_HEADERS,
        timeout: REQUEST_TIMEOUT,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });
}

// ============================================================
// REALTIME API ROUTES
// ============================================================

// 1. Unified Realtime Endless Video Feed (Paginated)
async function handleVideosFeed(req, res) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const cacheKey = `realtime_feed_page_${page}`;
    const cached = getCached(cacheKey);

    if (cached) {
        return res.json({ success: true, source: 'cache', page, count: cached.length, data: cached });
    }

    const targetUrl = page === 1 ? `${BASE_SOURCE_URL}/` : `${BASE_SOURCE_URL}/page/${page}/`;

    try {
        const response = await fetchPage(targetUrl);
        const $ = cheerio.load(response.data);
        const videos = extractVideos($, BASE_SOURCE_URL);

        if (videos.length > 0) {
            setCached(cacheKey, videos);
            return res.json({ success: true, source: 'realtime', page, count: videos.length, data: videos });
        }

        return res.json({ success: true, source: 'realtime', page, count: 0, data: [] });
    } catch (err) {
        console.error(`[Realtime Feed Error] ${targetUrl} failed:`, err.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch realtime videos', message: err.message, data: [] });
    }
}

// Primary endless video stream routes
app.get('/api/videos', handleVideosFeed);
app.get('/api/all', handleVideosFeed);
app.get('/api/trending', handleVideosFeed);

// Search Route (Live scraping search results)
app.get('/api/search', async (req, res) => {
    const query = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);

    if (!query) {
        return res.json({ success: true, data: [] });
    }

    const cacheKey = `search_${encodeURIComponent(query)}_p_${page}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ success: true, source: 'cache', count: cached.length, data: cached });
    }

    const targetUrl = page === 1 
        ? `${BASE_SOURCE_URL}/?s=${encodeURIComponent(query)}` 
        : `${BASE_SOURCE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;

    try {
        const response = await fetchPage(targetUrl);
        const $ = cheerio.load(response.data);
        const videos = extractVideos($, BASE_SOURCE_URL);

        setCached(cacheKey, videos);
        return res.json({ success: true, source: 'realtime', count: videos.length, data: videos });
    } catch (err) {
        console.error(`[Search Error] ${targetUrl} failed:`, err.message);
        return res.json({ success: true, data: [] });
    }
});

// 2. Extract Direct MP4 Source in Real Time
app.get('/api/video-source', async (req, res) => {
    let videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'Missing video url parameter' });
    }

    // Convert relative or legacy URLs to lalamasa.mobi
    if (videoUrl.includes('lalamasa.com')) {
        videoUrl = videoUrl.replace('lalamasa.com', 'lalamasa.mobi');
    }
    if (!videoUrl.startsWith('http')) {
        videoUrl = BASE_SOURCE_URL.replace(/\/$/, '') + '/' + videoUrl.replace(/^\//, '');
    }

    const cacheKey = `source_${videoUrl}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ success: true, source: cached });
    }

    try {
        const response = await fetchPage(videoUrl);
        const $ = cheerio.load(response.data);
        let videoSource = '';

        // 1. Direct HTML5 video source tag
        const sourceEl = $('video source, #player source, source');
        sourceEl.each((_, el) => {
            const s = $(el).attr('src');
            if (s && s.includes('.mp4')) {
                videoSource = s;
                return false;
            }
        });

        // 2. Direct video tag src attribute
        if (!videoSource) {
            const videoTag = $('video');
            if (videoTag.length > 0 && videoTag.attr('src')) {
                videoSource = videoTag.attr('src');
            }
        }

        // 3. Schema JSON-LD VideoObject
        if (!videoSource) {
            $('script[type="application/ld+json"]').each((_, el) => {
                try {
                    const json = JSON.parse($(el).html());
                    if (json['@type'] === 'VideoObject' && json.contentUrl) {
                        videoSource = json.contentUrl;
                    }
                } catch (e) { }
            });
        }

        // 4. Embedded regex pattern in page scripts/html
        if (!videoSource) {
            const html = response.data;
            const mp4Match = html.match(/https?:\/\/[^"'\s<>]+\.mp4[^\s"']*/i);
            if (mp4Match) {
                videoSource = mp4Match[0];
            }
        }

        if (videoSource) {
            setCached(cacheKey, videoSource);
            return res.json({ success: true, source: videoSource });
        }
    } catch (err) {
        console.error(`[Video Source Error] ${videoUrl} fetch error:`, err.message);
    }

    return res.status(404).json({ success: false, error: 'Video source not found or unavailable' });
});

// 3. Related Videos (Real-time from video page + endless paginated stream)
app.get('/api/related', async (req, res) => {
    let videoUrl = req.query.url;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'Missing video url parameter' });
    }

    if (videoUrl.includes('lalamasa.com')) {
        videoUrl = videoUrl.replace('lalamasa.com', 'lalamasa.mobi');
    }
    if (!videoUrl.startsWith('http')) {
        videoUrl = BASE_SOURCE_URL.replace(/\/$/, '') + '/' + videoUrl.replace(/^\//, '');
    }

    const cacheKey = `related_${videoUrl}_p_${page}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ success: true, source: 'cache', page, count: cached.length, data: cached });
    }

    try {
        let related = [];
        if (page === 1) {
            // First page: Extract related directly from video page
            const response = await fetchPage(videoUrl);
            const $ = cheerio.load(response.data);
            related = extractVideos($, BASE_SOURCE_URL).filter(v => v.url !== videoUrl);

            // Blend with feed page 1 to ensure at least 25-30 recommendations
            if (related.length < 25) {
                let feedRes = await fetchPage(`${BASE_SOURCE_URL}/`);
                let feedVideos = extractVideos(cheerio.load(feedRes.data), BASE_SOURCE_URL);
                const seen = new Set(related.map(r => r.url));
                seen.add(videoUrl);

                for (const v of feedVideos) {
                    if (!seen.has(v.url)) {
                        seen.add(v.url);
                        related.push(v);
                    }
                    if (related.length >= 30) break;
                }
            }
        } else {
            // Page 2, 3, 4, ...: Realtime endless recommendations from feed pages
            const targetUrl = `${BASE_SOURCE_URL}/page/${page}/`;
            const feedRes = await fetchPage(targetUrl);
            const feedVideos = extractVideos(cheerio.load(feedRes.data), BASE_SOURCE_URL);
            related = feedVideos.filter(v => v.url !== videoUrl);
        }

        setCached(cacheKey, related);
        return res.json({ success: true, page, count: related.length, data: related });
    } catch (err) {
        console.error(`[Related Videos Error] ${err.message}`);
        try {
            const fallbackUrl = page === 1 ? `${BASE_SOURCE_URL}/` : `${BASE_SOURCE_URL}/page/${page}/`;
            const feedRes = await fetchPage(fallbackUrl);
            const feedVideos = extractVideos(cheerio.load(feedRes.data), BASE_SOURCE_URL);
            const fallbackRelated = feedVideos.filter(v => v.url !== videoUrl);
            return res.json({ success: true, page, count: fallbackRelated.length, data: fallbackRelated });
        } catch (e) {
            return res.json({ success: true, page, count: 0, data: [] });
        }
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', realtime: true, time: new Date().toISOString() });
});

// Force-Sub Verification Client
const { verifyAllChannels, getActiveChannels } = require('./bot/verify');
const { 
    getBotSettings, 
    updateBotSettings, 
    saveOrUpdateUser, 
    isUserBlocked,
    getUserData,
    updateUserWatchTime,
    updateUserSavedVideos,
    updateAdPackProgress
} = require('./firebase');
const TelegramBotPackage = require('node-telegram-bot-api');
const TelegramBot = TelegramBotPackage.default || TelegramBotPackage.TelegramBot || TelegramBotPackage;
const verifierToken = process.env.BOT_TOKEN;
let verifierBot = null;
if (verifierToken && verifierToken !== 'YOUR_BOT_TOKEN_HERE') {
    try {
        verifierBot = new TelegramBot(verifierToken, { polling: false });
    } catch (e) {
        console.warn('Verifier bot init error:', e.message);
    }
}

// 1. Get Live Channels & Force-Sub Lock Status from Firebase
app.get('/api/admin/channels', async (req, res) => {
    try {
        const settings = await getBotSettings();
        res.json({
            success: true,
            channels: settings.channels || [],
            channelLockEnabled: settings.channelLockEnabled !== false,
            welcomeText: settings.welcomeText || '',
            lockMessage: settings.lockMessage || ''
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Update Channels in Firebase from Admin Panel
app.post('/api/admin/channels', async (req, res) => {
    const { channels } = req.body;
    if (!Array.isArray(channels)) {
        return res.status(400).json({ success: false, error: 'Channels must be an array' });
    }
    try {
        await updateBotSettings({ channels });
        res.json({ success: true, message: 'Channels updated successfully in Firebase', channels });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Toggle Force-Sub Lock ON/OFF in Firebase
app.post('/api/admin/toggle-lock', async (req, res) => {
    const { enabled } = req.body;
    try {
        await updateBotSettings({ channelLockEnabled: Boolean(enabled) });
        res.json({ success: true, channelLockEnabled: Boolean(enabled) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.1 Get All Users from Firebase for Admin Dashboard with 24h/1h/Blocked stats
app.get('/api/admin/users', async (req, res) => {
    try {
        const DB_URL = "https://anime-net-a89c9-default-rtdb.asia-southeast1.firebasedatabase.app";
        const fbRes = await axios.get(`${DB_URL}/users.json`, { timeout: 8000 });
        const data = fbRes.data || {};
        const users = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        
        // Sort by last active descending (most active first)
        users.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));

        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * 60 * 60 * 1000;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        const active1h = users.filter(u => u.lastActive && (now - u.lastActive) < oneHour).length;
        const active24h = users.filter(u => u.lastActive && (now - u.lastActive) < oneDay).length;
        const active7d = users.filter(u => u.lastActive && (now - u.lastActive) < sevenDays).length;
        const blockedUsers = users.filter(u => Boolean(u.isBlocked)).length;

        res.json({
            success: true,
            totalUsers: users.length,
            active1h,
            active24h,
            activeToday: active24h,
            active7d,
            blockedUsers,
            users
        });
    } catch (err) {
        console.error('[Admin Users API Error]:', err.message);
        res.status(500).json({ success: false, error: err.message, users: [] });
    }
});

// 3.2 Block / Unblock User from Admin Dashboard
app.post('/api/admin/toggle-block', async (req, res) => {
    const { userId, isBlocked } = req.body;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    try {
        const DB_URL = "https://anime-net-a89c9-default-rtdb.asia-southeast1.firebasedatabase.app";
        await axios.patch(`${DB_URL}/users/${userId}.json`, { isBlocked: Boolean(isBlocked) }, { timeout: 6000 });
        console.log(`[Admin] User ${userId} blocked status set to: ${Boolean(isBlocked)}`);
        res.json({ success: true, userId, isBlocked: Boolean(isBlocked) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.3 Record User Mini App Activity (Last active timestamp & profile)
app.post('/api/user/activity', async (req, res) => {
    const user = req.body;
    if (!user || !user.id) {
        return res.status(400).json({ success: false, error: 'User object with id is required' });
    }
    try {
        const saved = await saveOrUpdateUser(user);
        const blocked = await isUserBlocked(user.id);
        res.json({ success: true, isBlocked: Boolean(blocked), user: saved });
    } catch (err) {
        console.warn(`[User Activity Sync Error] ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.4 Get Full User Data (Watch Time, Saved Videos, Ad Packs Progress)
app.get('/api/user/data', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    try {
        const data = await getUserData(userId);
        res.json({
            success: true,
            data: data || {
                watchTimeSeconds: 180,
                savedVideos: [],
                adPacksProgress: {}
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.5 Update Watch Time Balance (Deduct when watching or Add on ad reward)
app.post('/api/user/watch-time', async (req, res) => {
    const { userId, deltaSeconds } = req.body;
    if (!userId || deltaSeconds === undefined) {
        return res.status(400).json({ success: false, error: 'userId and deltaSeconds are required' });
    }
    try {
        const newTime = await updateUserWatchTime(userId, deltaSeconds);
        res.json({ success: true, watchTimeSeconds: newTime });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.6 Save / Update User Bookmarked Videos in Firebase
app.post('/api/user/saved-videos', async (req, res) => {
    const { userId, savedVideos } = req.body;
    if (!userId || !Array.isArray(savedVideos)) {
        return res.status(400).json({ success: false, error: 'userId and savedVideos array are required' });
    }
    try {
        const updated = await updateUserSavedVideos(userId, savedVideos);
        res.json({ success: true, savedVideos: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.7 Claim Ad Pack Progress & Add Bonus Time
app.post('/api/user/claim-ad-reward', async (req, res) => {
    const { userId, packId, increment, targetCount, rewardSeconds } = req.body;
    if (!userId || !packId) {
        return res.status(400).json({ success: false, error: 'userId and packId are required' });
    }
    try {
        const result = await updateAdPackProgress(
            userId, 
            packId, 
            Number(increment) || 1, 
            Number(targetCount) || 5, 
            Number(rewardSeconds) || 300
        );
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Check if user is subscribed to all dynamic channels from Firebase & check block status
app.get('/api/check-subscription', async (req, res) => {
    const userId = req.query.userId || req.headers['x-telegram-user-id'];
    
    // If valid user ID, check if they are blocked by Admin
    if (userId && String(userId) !== '100000001') {
        const blocked = await isUserBlocked(userId);
        if (blocked) {
            return res.json({ 
                success: true, 
                isBlocked: true, 
                isSubscribed: false, 
                unjoined: [], 
                message: 'Your account has been suspended by the administrator.' 
            });
        }
    }

    const { channels, enabled } = await getActiveChannels();
    
    // If force-sub is disabled or user is in browser / dev / mock mode
    if (!enabled || !userId || String(userId) === '100000001') {
        return res.json({ 
            success: true, 
            isBlocked: false,
            isSubscribed: true, 
            unjoined: [], 
            joinedCount: channels.length, 
            totalCount: channels.length,
            channels 
        });
    }

    if (!verifierBot) {
        return res.json({ 
            success: true, 
            isBlocked: false,
            isSubscribed: true, 
            unjoined: [], 
            joinedCount: channels.length, 
            totalCount: channels.length,
            channels 
        });
    }

    try {
        const result = await verifyAllChannels(verifierBot, userId);
        return res.json({
            success: true,
            isBlocked: false,
            isSubscribed: result.isSubscribed,
            unjoined: result.unjoined,
            joinedCount: result.joinedCount,
            totalCount: result.totalCount,
            channels: result.channels || channels
        });
    } catch (err) {
        console.error('[API Check Subscription Error]:', err.message);
        return res.json({ success: true, isBlocked: false, isSubscribed: false, unjoined: channels, channels, error: err.message });
    }
});

// Explicit root handler for instant 200 OK
app.get('/', (req, res) => {
    const indexDist = path.join(distPath, 'index.html');
    if (fs.existsSync(indexDist)) {
        return res.sendFile(indexDist);
    }
    const indexLegacy = path.join(legacyFrontendPath, 'index.html');
    if (fs.existsSync(indexLegacy)) {
        return res.sendFile(indexLegacy);
    }
    return res.send('<h1>🍿 Landy TV Server is LIVE</h1>');
});

// SPA catch-all: any non-API GET route serves the React index.html
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        const indexDist = path.join(distPath, 'index.html');
        if (fs.existsSync(indexDist)) {
            return res.sendFile(indexDist);
        }
        const indexLegacy = path.join(legacyFrontendPath, 'index.html');
        if (fs.existsSync(indexLegacy)) {
            return res.sendFile(indexLegacy);
        }
    }
    next();
});

// Start Server - MUST bind to 0.0.0.0 for Railway/Docker container proxy
const primaryPort = parseInt(process.env.PORT, 10) || 5000;
app.listen(primaryPort, '0.0.0.0', () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Landy TV Realtime Server running on PORT: ${primaryPort} (0.0.0.0)`);
    console.log(`📱 App URL: http://localhost:${primaryPort}`);
    console.log(`📡 Realtime Feed: http://localhost:${primaryPort}/api/videos?page=1`);
    console.log(`=================================================\n`);
});

// Also bind to fallback ports (5000 / 8080) so Railway routing never misses
const fallbackPorts = [5000, 8080].filter(p => p !== primaryPort);
fallbackPorts.forEach(port => {
    try {
        const s = app.listen(port, '0.0.0.0', () => {
            console.log(`📡 Secondary listener active on port: ${port} (0.0.0.0)`);
        });
        s.on('error', () => {});
    } catch (e) {}
});
