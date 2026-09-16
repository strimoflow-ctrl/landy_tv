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

// Bot instance without polling (Poster bot only sends out messages)
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
 * Scrape a specific page of videos from source
 */
async function fetchVideosPage(page = 1) {
  try {
    const targetUrl = page === 1 ? `${BASE_SOURCE_URL}/` : `${BASE_SOURCE_URL}/page/${page}/`;
    const res = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(res.data);
    const videos = [];
    const seen = new Set();

    $('article.vcard, .item, .video-block, .vt-card').each((_, el) => {
      const title = $(el).find('.entry-title a, h2 a, h3 a, a.vt-thumb, a').first().text().trim() || $(el).find('img').attr('alt');
      let url = $(el).find('.entry-title a, h2 a, h3 a, a.vt-thumb, a').first().attr('href') || '';
      let thumbnail = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      const duration = $(el).find('.duration, .vt-duration').text().trim() || '';
      const views = $(el).find('.views, .vt-card-views').text().trim() || '15K views';

      if (url && !url.startsWith('http')) {
        url = BASE_SOURCE_URL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
      }

      if (title && url && !seen.has(url)) {
        seen.add(url);
        videos.push({ title, url, thumbnail, duration, views });
      }
    });

    return videos;
  } catch (err) {
    console.error(`[Poster Fetch Error] Page ${page} failed:`, err.message);
    return [];
  }
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
  // 1. Environment variable POST_CHANNELS (e.g. "@channel1, @channel2, @channel3")
  if (process.env.POST_CHANNELS) {
    return process.env.POST_CHANNELS.split(',')
      .map(ch => ch.trim())
      .filter(Boolean);
  }

  // 2. Single POST_CHANNEL_ID env
  if (process.env.POST_CHANNEL_ID) {
    return [process.env.POST_CHANNEL_ID.trim()];
  }

  // 3. Dynamic Firebase Settings
  try {
    const settings = await getBotSettings();

    // Dedicated postChannels array in settings
    if (settings.postChannels && Array.isArray(settings.postChannels) && settings.postChannels.length > 0) {
      return settings.postChannels.map(ch => ch.trim()).filter(Boolean);
    }

    // Fallback: Use channels list from bot settings
    if (settings.channels && settings.channels.length > 0) {
      return settings.channels
        .map(ch => ch.chatId || ch.username || (ch.url ? ch.url.split('/').pop() : null))
        .filter(Boolean);
    }
  } catch (e) {}

  // Default fallback
  return ['@landy_tv'];
}

/**
 * Format and send a single video post to a specific channel
 */
async function postVideoToChannel(channelId, video) {
  // Generate safe Base64 start parameter
  const b64Url = Buffer.from(video.url).toString('base64').replace(/=/g, '');
  const watchDeepLink = `https://t.me/${BOT_USERNAME}?start=v_${b64Url}`;

  // Premium eye-catching caption
  const caption = [
    `🔥 <b>NEW TRENDING VIDEO RELEASED!</b> 🔥\n`,
    `🎬 <b>Title:</b> ${escapeHtml(video.title)}`,
    video.duration ? `⏱ <b>Duration:</b> ${escapeHtml(video.duration)}` : '',
    `👁 <b>Views:</b> ${escapeHtml(video.views || '18K views')}`,
    `🍿 <b>Quality:</b> Ultra HD 1080p\n`,
    `👇 <i>Click the button below to watch full video on Telegram:</i>`
  ].filter(Boolean).join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🎬 Watch Now (Ultra HD)', url: watchDeepLink }
      ]
    ]
  };

  let sent = false;

  // 1. Try sending with photo thumbnail
  if (video.thumbnail && video.thumbnail.startsWith('http')) {
    try {
      await bot.sendPhoto(channelId, video.thumbnail, {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
      sent = true;
    } catch (photoErr) {
      console.warn(`[Poster Warning] Photo send failed for ${channelId} (${photoErr.message}). Trying text fallback...`);
    }
  }

  // 2. Fallback: Send message if photo failed
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
      }

      // 5-second pause between channels to stay well within Telegram flood limits
      if (i < channels.length - 1) {
        await new Promise(r => setTimeout(r, 5000));
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
