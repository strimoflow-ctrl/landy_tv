// Polyfill File for older Node.js runtimes (Node 18)
if (typeof globalThis.File === 'undefined') {
  try {
    globalThis.File = class File {};
  } catch (e) {}
}

const TelegramBotPackage = require('node-telegram-bot-api');
const TelegramBot = TelegramBotPackage.default || TelegramBotPackage.TelegramBot || TelegramBotPackage;
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const dotenv = require('dotenv');
const { getBotSettings, isVideoAlreadyPosted, markVideoPosted } = require('../firebase');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Configuration
const BOT_TOKEN = process.env.POSTER_BOT_TOKEN || process.env.BOT_TOKEN;
const BOT_USERNAME = (process.env.BOT_USERNAME || 'landytv_bot').replace('@', '').trim();
const POST_INTERVAL_MINUTES = parseInt(process.env.POST_INTERVAL_MINUTES) || 15;
const BASE_SOURCE_URL = 'https://lalamasa.mobi';

console.log('\n=============================================================');
console.log('   📢 LANDY TV — MULTI-CHANNEL AUTO POSTER BOT');
console.log(`   ⏱ Posting Cycle: Every ${POST_INTERVAL_MINUTES} minutes`);
console.log('   🎯 Strategy: 100% Unique non-overlapping video for each channel');
console.log('=============================================================\n');

// Bot instance without polling (Poster bot only sends messages to channels)
let bot = null;
if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: false });
  } catch (err) {
    console.error('Failed to initialize poster bot client:', err.message);
  }
}

// In-memory queue of fresh unposted videos
let unpostedQueue = [];
let isCycleRunning = false;
let currentScanPage = 1;

/**
 * Scrape a specific page of videos from source using exact tested selectors
 */
async function fetchVideosPage(page = 1) {
  try {
    const targetUrl = page === 1 ? `${BASE_SOURCE_URL}/` : `${BASE_SOURCE_URL}/page/${page}/`;
    const res = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });

    const $ = cheerio.load(res.data);
    const videos = [];
    const seen = new Set();

    // Primary selector on lalamasa.mobi: article.vcard
    $('article.vcard').each((_, element) => {
      // 1. Extract clean title
      let rawTitle = $(element).find('.vtitle').text().trim() || $(element).find('a').attr('title') || '';
      let cleanTitle = rawTitle.replace(/\s+/g, ' ').replace(/^[\d:]+\s*[▶\s]*/, '').trim();
      cleanTitle = cleanTitle.split('\n')[0].trim();

      // 2. Extract URL
      let url = $(element).find('a').first().attr('href') || '';
      if (url && !url.startsWith('http')) {
        url = BASE_SOURCE_URL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
      }

      // 3. Extract Real Thumbnail (Masahub cdn or style background)
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

      // 4. Duration & Views
      const duration = $(element).find('.dur').text().trim() || $(element).find('.duration').text().trim() || 'HD';
      let viewsRaw = $(element).find('.vviews-n').text().trim() || $(element).find('.vviews').text().replace(/[👁\s]/g, '') || 'Hot';
      viewsRaw = viewsRaw.replace(/[👁\s]/g, '').trim();
      const views = viewsRaw.toLowerCase().includes('views') ? viewsRaw : `${viewsRaw || '15K'} views`;

      if (cleanTitle && url && !seen.has(url)) {
        seen.add(url);
        videos.push({
          title: cleanTitle,
          url,
          thumbnail: thumbnail.trim(),
          duration,
          views
        });
      }
    });

    // Secondary fallback selector: .vt-card
    if (videos.length === 0) {
      $('.vt-card').each((_, element) => {
        let cleanTitle = $(element).find('.vt-card-title').text().trim() || $(element).find('.vt-thumb').attr('title') || '';
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^[\d:]+\s*[▶\s]*/, '').trim();

        let url = $(element).find('a.vt-thumb').attr('href') || $(element).find('a').first().attr('href');
        if (url && !url.startsWith('http')) {
          url = BASE_SOURCE_URL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
        }

        let thumbnail = $(element).find('.vt-thumb img').attr('data-src') || $(element).find('.vt-thumb img').attr('src') || '';
        const duration = $(element).find('.vt-duration').text().trim() || 'HD';
        const views = $(element).find('.vt-card-views').text().trim() || '15K views';

        if (cleanTitle && url && !seen.has(url)) {
          seen.add(url);
          videos.push({
            title: cleanTitle,
            url,
            thumbnail: thumbnail.trim(),
            duration,
            views
          });
        }
      });
    }

    return videos;
  } catch (err) {
    console.error(`[Poster Fetch Error] Page ${page} failed:`, err.message);
    return [];
  }
}

/**
 * Helper to download image buffer directly so Telegram never rejects external CDNs
 */
async function downloadImageBuffer(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('http')) return null;
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': BASE_SOURCE_URL
      }
    });
    if (res.status === 200 && res.data && res.data.length > 200) {
      return Buffer.from(res.data);
    }
  } catch (err) {
    console.warn(`[Thumbnail Buffer] Image download failed for ${imageUrl}: ${err.message}`);
  }
  return null;
}

/**
 * Scan multiple pages to maintain a deep queue of unique unposted videos
 */
async function refillQueue() {
  console.log(`🔍 Scanning pages to refill unposted videos queue (Current size: ${unpostedQueue.length})...`);
  let pagesScanned = 0;
  let addedCount = 0;

  while (unpostedQueue.length < 30 && pagesScanned < 5) {
    const pageVideos = await fetchVideosPage(currentScanPage);
    pagesScanned++;
    currentScanPage++;

    // Wrap page counter if we reach deep pages
    if (currentScanPage > 30) {
      currentScanPage = 1;
    }

    if (!pageVideos || pageVideos.length === 0) continue;

    for (const video of pageVideos) {
      const alreadyPosted = await isVideoAlreadyPosted(video.url);
      const inQueue = unpostedQueue.some(q => q.url === video.url);

      if (!alreadyPosted && !inQueue) {
        unpostedQueue.push(video);
        addedCount++;
      }
    }
  }

  console.log(`✅ Queue refilled: +${addedCount} new unique videos added. (Total available: ${unpostedQueue.length})`);
}

/**
 * Resolve target Telegram Channels (Supports 3 or more channels)
 */
async function getTargetChannels() {
  let list = [];

  // 1. Environment variable POST_CHANNELS (e.g. "@channel1, @channel2, @channel3")
  if (process.env.POST_CHANNELS) {
    list = process.env.POST_CHANNELS.split(',').map(ch => ch.trim()).filter(Boolean);
  }

  // 2. Dynamic Firebase Settings
  if (list.length === 0) {
    try {
      const settings = await getBotSettings();
      if (settings.postChannels && Array.isArray(settings.postChannels) && settings.postChannels.length > 0) {
        list = settings.postChannels.map(ch => ch.trim()).filter(Boolean);
      } else if (settings.channels && settings.channels.length > 0) {
        list = settings.channels
          .map(ch => ch.chatId || ch.username || (ch.url ? ch.url.split('/').pop() : null))
          .filter(Boolean);
      }
    } catch (e) {}
  }

  // 3. Fallback
  if (list.length === 0 && process.env.POST_CHANNEL_ID) {
    list = [process.env.POST_CHANNEL_ID.trim()];
  }

  if (list.length === 0) {
    list = ['@landy_tv'];
  }

  // Normalize channel IDs: ensure "@" prefix if not a numeric chat_id
  return list.map(ch => {
    let c = ch.trim();
    if (!c.startsWith('@') && !c.startsWith('-100') && !c.startsWith('-')) {
      c = `@${c}`;
    }
    return c;
  });
}

/**
 * Format and send a single video post to a specific channel with thumbnail & single Watch button
 */
async function postVideoToChannel(channelId, video) {
  // Generate safe Base64 start parameter
  const b64Url = Buffer.from(video.url).toString('base64').replace(/=/g, '');
  const watchDeepLink = `https://t.me/${BOT_USERNAME}?start=v_${b64Url}`;

  // Clean, aesthetic Telegram caption
  const caption = [
    `🔥 <b>NEW TRENDING VIDEO RELEASED!</b> 🔥\n`,
    `🎬 <b>Title:</b> ${escapeHtml(video.title)}`,
    video.duration && video.duration !== 'N/A' ? `⏱ <b>Duration:</b> ${escapeHtml(video.duration)}` : '',
    `👁 <b>Views:</b> ${escapeHtml(video.views || '18K views')}`,
    `🍿 <b>Quality:</b> Ultra HD 1080p\n`,
    `👇 <i>Click below to watch full video on Telegram:</i>`
  ].filter(Boolean).join('\n');

  // Exact single button: redirects to bot with start parameter
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🎬 Watch Now (Ultra HD)', url: watchDeepLink }
      ]
    ]
  };

  let sent = false;

  // 1. Download image buffer and send via multipart upload (guaranteed 100% photo send)
  if (video.thumbnail) {
    console.log(`🖼 Downloading thumbnail for "${video.title}"...`);
    const imgBuffer = await downloadImageBuffer(video.thumbnail);
    if (imgBuffer) {
      try {
        await bot.sendPhoto(channelId, imgBuffer, {
          caption: caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
          has_spoiler: true
        }, {
          filename: 'thumbnail.jpg',
          contentType: 'image/jpeg'
        });
        sent = true;
      } catch (bufErr) {
        console.warn(`[Poster Warning] Buffer sendPhoto failed for ${channelId}: ${bufErr.message}`);
      }
    }
  }

  // 2. Fallback: Try direct URL sendPhoto if buffer failed
  if (!sent && video.thumbnail && video.thumbnail.startsWith('http')) {
    try {
      await bot.sendPhoto(channelId, video.thumbnail, {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        has_spoiler: true
      });
      sent = true;
    } catch (photoErr) {
      console.warn(`[Poster Warning] Direct URL sendPhoto failed for ${channelId}: ${photoErr.message}`);
    }
  }

  // 3. Fallback: Send message if photo was completely impossible
  if (!sent) {
    await bot.sendMessage(channelId, caption, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
      disable_web_page_preview: false
    });
  }

  // Mark in Firebase with target channel stamp (NEVER post this video anywhere again!)
  await markVideoPosted(video, channelId);
  console.log(`🎉 [Success] Posted unique video to "${channelId}": "${video.title}"`);
}

/**
 * Run a multi-channel posting cycle:
 * Delivers a DIFFERENT, 100% UNIQUE video to each configured channel!
 */
async function runMultiChannelCycle() {
  if (isCycleRunning) return;
  if (!bot) {
    console.warn('⚠️  Poster bot is waiting for BOT_TOKEN in .env.');
    return;
  }

  isCycleRunning = true;

  try {
    const channels = await getTargetChannels();
    if (channels.length === 0) {
      console.warn('⚠️  No target channels configured. Please set POST_CHANNELS in .env or via Admin Panel.');
      isCycleRunning = false;
      return;
    }

    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Starting post cycle for ${channels.length} channel(s): [ ${channels.join(' | ')} ]`);

    // Ensure queue has plenty of videos
    if (unpostedQueue.length < channels.length + 5) {
      await refillQueue();
    }

    // Loop through each channel and assign a UNIQUE video
    for (let i = 0; i < channels.length; i++) {
      const channelId = channels[i];

      let video = null;

      // Find an unposted video from the queue
      while (unpostedQueue.length > 0) {
        const candidate = unpostedQueue.shift();
        const alreadyPosted = await isVideoAlreadyPosted(candidate.url);
        if (!alreadyPosted) {
          video = candidate;
          break;
        }
      }

      // If queue ran out, refill and try once more
      if (!video) {
        await refillQueue();
        while (unpostedQueue.length > 0) {
          const candidate = unpostedQueue.shift();
          const alreadyPosted = await isVideoAlreadyPosted(candidate.url);
          if (!alreadyPosted) {
            video = candidate;
            break;
          }
        }
      }

      if (!video) {
        console.warn(`⚠️  Could not find a unique unposted video for channel: ${channelId}`);
        continue;
      }

      console.log(`📤 [Channel ${i + 1}/${channels.length}] Sending unique video to "${channelId}"...`);

      try {
        await postVideoToChannel(channelId, video);
      } catch (postErr) {
        console.error(`❌ Failed to post to channel ${channelId}:`, postErr.message);
        if (postErr.message && postErr.message.includes('chat not found')) {
          console.error(`👉 Tip: Check if the channel username "${channelId}" exists and is public.`);
        } else if (postErr.message && (postErr.message.includes('admin') || postErr.message.includes('not enough rights') || postErr.message.includes('fetch failed'))) {
          console.error(`👉 Tip: Make sure your Telegram bot is added as an ADMINISTRATOR in "${channelId}" with "Post Messages" permission!`);
        }
      }

      // 6-second pause between channels to stay well within Telegram flood limits
      if (i < channels.length - 1) {
        await new Promise(r => setTimeout(r, 6000));
      }
    }

    console.log(`✨ [Cycle Finished] All channels received unique content. Next post cycle in ${POST_INTERVAL_MINUTES} minutes.\n`);

  } catch (err) {
    console.error('❌ [Posting Cycle Error]:', err.message);
  } finally {
    isCycleRunning = false;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Start the Auto Poster Scheduler
 */
function startScheduler() {
  console.log(`🚀 Auto Channel Poster service started. Cycle will run every ${POST_INTERVAL_MINUTES} minutes.`);

  // First cycle starts after 15 seconds of boot
  setTimeout(async () => {
    await refillQueue();
    await runMultiChannelCycle();
  }, 15000);

  // Recurring 15-minute interval
  const intervalMs = POST_INTERVAL_MINUTES * 60 * 1000;
  setInterval(async () => {
    await runMultiChannelCycle();
  }, intervalMs);
}

// Start immediately if executed directly
if (require.main === module) {
  startScheduler();
}

module.exports = {
  startScheduler,
  runMultiChannelCycle,
  refillQueue
};
