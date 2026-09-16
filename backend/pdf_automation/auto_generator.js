const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const { generateSeoPdf } = require('./pdf_engine');
const { uploadPdfToArchive, hasArchiveCredentials } = require('./archive_uploader');
const {
  isPdfAlreadyGenerated,
  markPdfGenerated,
  getPdfChannelIndex,
  setPdfChannelIndex
} = require('../firebase');

const BASE_SOURCE_URL = 'https://lalamasa.mobi';
const OUTPUT_DIR = path.join(__dirname, 'output');

// Configured 2 Rotating Channels ("para-pari" alternating)
const ROTATING_CHANNELS = [
  'https://t.me/viral_instahub',
  'https://t.me/uff_riya'
];

const INTERVAL_HOURS = parseFloat(process.env.PDF_INTERVAL_HOURS) || 3;
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

let currentScanPage = 1;

/**
 * Scrape videos from source page
 */
async function fetchSourceVideos(page = 1) {
  try {
    const targetUrl = page === 1 ? `${BASE_SOURCE_URL}/` : `${BASE_SOURCE_URL}/page/${page}/`;
    const res = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      },
      timeout: 10000
    });

    const $ = cheerio.load(res.data);
    const videos = [];
    const seen = new Set();

    $('article.vcard').each((_, element) => {
      let rawTitle = $(element).find('.vtitle').text().trim() || $(element).find('a').attr('title') || '';
      let cleanTitle = rawTitle.replace(/\s+/g, ' ').replace(/^[\d:]+\s*[▶\s]*/, '').trim();
      cleanTitle = cleanTitle.split('\n')[0].trim();

      let url = $(element).find('a').first().attr('href') || '';
      if (url && !url.startsWith('http')) {
        url = BASE_SOURCE_URL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
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

      if (cleanTitle && url && !seen.has(url)) {
        seen.add(url);
        videos.push({
          title: cleanTitle,
          url,
          thumbnail: thumbnail.trim()
        });
      }
    });

    return videos;
  } catch (err) {
    console.error(`[PDF Generator] Scraper error on page ${page}:`, err.message);
    return [];
  }
}

/**
 * Find the next unique video that hasn't had a PDF generated yet (via Firebase)
 */
async function findNextUnprocessedVideo() {
  let pagesChecked = 0;
  while (pagesChecked < 6) {
    console.log(`🔎 Checking page ${currentScanPage} for new unposted videos...`);
    const pageVideos = await fetchSourceVideos(currentScanPage);
    pagesChecked++;
    currentScanPage++;
    if (currentScanPage > 25) currentScanPage = 1;

    for (const video of pageVideos) {
      const alreadyProcessed = await isPdfAlreadyGenerated(video.url);
      if (!alreadyProcessed) {
        return video;
      }
    }
  }
  return null;
}

/**
 * Execute 1 automated cycle:
 * - Alternates target channel ("para-pari")
 * - Scrapes 1 brand new unposted video
 * - Generates high-converting 5-page SEO PDF with crisp thumbnail & channel links
 * - Records in Firebase so it never duplicates
 */
async function runSingleAutomationCycle() {
  console.log(`\n=============================================================`);
  console.log(`🚀 [${new Date().toLocaleTimeString()}] Starting Automated PDF Generation Cycle`);
  console.log(`=============================================================`);

  // 1. Get alternating channel index ("para-pari") from Firebase
  const currentIndex = await getPdfChannelIndex();
  const primaryChannel = ROTATING_CHANNELS[currentIndex % ROTATING_CHANNELS.length];
  const backupChannel = ROTATING_CHANNELS[(currentIndex + 1) % ROTATING_CHANNELS.length];

  console.log(`🎯 Active Channel Turn: ${primaryChannel}`);
  console.log(`🛡 Backup Channel: ${backupChannel}`);

  // 2. Find fresh video not yet processed
  const video = await findNextUnprocessedVideo();
  if (!video) {
    console.warn('⚠️ No new unposted video found in current pages.');
    return null;
  }

  console.log(`🎬 Target Video: "${video.title}"`);
  console.log(`🖼 Thumbnail: ${video.thumbnail || 'N/A'}`);

  // 3. Generate SEO PDF with exact channel links
  const enhancedTitle = `${video.title} Full Video Download in 720p 1080p HD`;
  const pdfPath = await generateSeoPdf({
    title: enhancedTitle,
    thumbnail: video.thumbnail,
    primaryChannelUrl: primaryChannel,
    backupChannelUrl: backupChannel,
    pages: 5,
    outputDir: OUTPUT_DIR
  });

  const pdfFileName = path.basename(pdfPath);
  console.log(`✅ [Success] Generated PDF: ${pdfPath}`);

  // 4. Archive.org Automatic Cloud Upload (if S3 credentials exist in .env)
  let archiveResult = null;
  if (hasArchiveCredentials()) {
    archiveResult = await uploadPdfToArchive(pdfPath, {
      title: enhancedTitle,
      description: `${video.title} - Full HD 1080p Online Stream & Free Download Guide on Telegram.`,
      keywords: 'watch online; telegram link; full video; 1080p; download; viral mms; web series'
    });
  } else {
    console.log('ℹ️  Archive.org keys not configured in .env yet. (PDF safely preserved in local output folder)');
  }

  // 5. Mark in Firebase to prevent duplicate generation
  const archiveUrl = archiveResult && archiveResult.detailsUrl ? archiveResult.detailsUrl : '';
  await markPdfGenerated(video, primaryChannel, pdfFileName, archiveUrl);
  console.log(`📌 Recorded in Firebase as generated for channel: ${primaryChannel}`);

  // 6. Advance round-robin index in Firebase for the NEXT run
  const nextIndex = (currentIndex + 1) % ROTATING_CHANNELS.length;
  await setPdfChannelIndex(nextIndex);
  console.log(`🔄 Channel rotation updated: Next run will use "${ROTATING_CHANNELS[nextIndex]}"`);

  return {
    video,
    pdfPath,
    primaryChannel,
    backupChannel,
    archiveUrl
  };
}

/**
 * Start recurring 3-Hour Automation Daemon
 */
function startDaemon() {
  console.log('\n=============================================================');
  console.log('   📄 LANDY TV — AUTOMATED SEO PDF ENGINE (3-Hour Daemon)');
  console.log(`   ⏱ Interval: Every ${INTERVAL_HOURS} hours`);
  console.log(`   🔄 Channel Rotation: ${ROTATING_CHANNELS.join('  <-->  ')}`);
  console.log(`   📁 Output Folder: ${OUTPUT_DIR}`);
  console.log('=============================================================\n');

  // Run immediate initial generation
  runSingleAutomationCycle().catch(e => console.error('Initial cycle error:', e.message));

  // Schedule every 3 hours
  setInterval(() => {
    runSingleAutomationCycle().catch(e => console.error('Scheduled cycle error:', e.message));
  }, INTERVAL_MS);
}

// CLI Execution Handlers
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--daemon') || args.includes('-d')) {
    startDaemon();
  } else {
    // Run single cycle for testing / verification
    runSingleAutomationCycle().then(() => {
      console.log('\n🎉 Single test run finished. To run as background daemon every 3 hours, use: node auto_generator.js --daemon\n');
      process.exit(0);
    }).catch(err => {
      console.error('Execution error:', err);
      process.exit(1);
    });
  }
}

module.exports = {
  runSingleAutomationCycle,
  startDaemon,
  ROTATING_CHANNELS
};
