const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// Load keywords and content templates
const keywordsData = require('./keywords.json');
const contentData = require('./content.json');

/**
 * Download image as buffer and convert to JPEG using Sharp (handles WebP from CDNs)
 */
async function downloadImageBuffer(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('http')) return null;
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://lalamasa.mobi/'
      }
    });

    if (res.status === 200 && res.data && res.data.length > 200) {
      // Always convert to high-quality JPEG buffer for PDFKit compatibility
      const jpegBuffer = await sharp(res.data)
        .jpeg({ quality: 92 })
        .toBuffer();
      return jpegBuffer;
    }
  } catch (err) {
    console.warn(`[PDF Engine] Thumbnail image download/convert failed for ${imageUrl}: ${err.message}`);
  }
  return null;
}

/**
 * Generate a clean, multi-page white SEO PDF with fake player and Telegram channel links
 * 
 * @param {Object} options
 * @param {string} options.title - Video/Movie Title
 * @param {string} options.thumbnail - Image URL
 * @param {string} options.primaryChannelUrl - Active Telegram channel link (e.g. https://t.me/viral_instahub)
 * @param {string} options.backupChannelUrl - Backup Telegram channel link (e.g. https://t.me/uff_riya)
 * @param {number} [options.pages=5] - Number of pages (default: 5)
 * @param {string} [options.outputDir] - Target output directory
 * @returns {Promise<string>} - Absolute path to generated PDF
 */
async function generateSeoPdf(options) {
  const {
    title = 'Trending Viral Video',
    thumbnail = '',
    primaryChannelUrl = 'https://t.me/viral_instahub',
    backupChannelUrl = 'https://t.me/uff_riya',
    pages = 5,
    outputDir = path.join(__dirname, 'output')
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Extract handle name from URLs for display
  const primaryHandle = primaryChannelUrl.split('/').pop().replace('@', '');
  const backupHandle = backupChannelUrl.split('/').pop().replace('@', '');

  // Safe file name based on title
  const safeName = title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 60);
  const pdfFileName = `${safeName}.pdf`;
  const pdfFilePath = path.join(outputDir, pdfFileName);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: title,
          Author: `@${primaryHandle}`,
          Subject: `${title} Watch Online and Download Guide`,
          Keywords: `${title}, watch online, download, telegram link, 1080p, 720p`
        }
      });

      const writeStream = fs.createWriteStream(pdfFilePath);
      doc.pipe(writeStream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      // Download and convert thumbnail buffer to JPEG
      const imgBuffer = await downloadImageBuffer(thumbnail);

      // =========================================================================
      // PAGE 1: White Clean Canvas + Hero SEO Title + Fake Video Player + Buttons
      // =========================================================================

      // Top Tagline
      doc.font('Helvetica-Bold')
         .fontSize(9.5)
         .fillColor('#e11d48')
         .text('OFFICIAL VERIFIED TELEGRAM STREAM & DOWNLOAD LINK', margin, margin, { align: 'center' });

      doc.moveDown(0.5);

      // Main SEO Title Heading
      doc.font('Helvetica-Bold')
         .fontSize(19)
         .fillColor('#0f172a')
         .text(title, { align: 'center' });

      doc.moveDown(0.7);

      // -----------------------------------------------------------
      // REALISTIC FAKE VIDEO PLAYER GRAPHIC
      // -----------------------------------------------------------
      const playerWidth = contentWidth;
      const playerHeight = Math.round(playerWidth * (9 / 16));
      const playerX = margin;
      const playerY = doc.y;

      // Dark background for player
      doc.rect(playerX, playerY, playerWidth, playerHeight)
         .fill('#0a0a0c');

      // Draw real thumbnail image (sharp JPEG)
      if (imgBuffer) {
        try {
          doc.image(imgBuffer, playerX, playerY, {
            width: playerWidth,
            height: playerHeight,
            fit: [playerWidth, playerHeight],
            align: 'center',
            valign: 'center'
          });
        } catch (imgErr) {
          console.warn('[PDF Engine] doc.image error:', imgErr.message);
        }
      }

      // Semi-transparent dark vignette over thumbnail for contrast
      doc.save();
      doc.rect(playerX, playerY, playerWidth, playerHeight)
         .fillColor('#000000', 0.28)
         .fill();
      doc.restore();

      // Sleek Glowing Red Play Button in Center
      const centerX = playerX + (playerWidth / 2);
      const centerY = playerY + (playerHeight / 2) - 8;
      const playRadius = 28;

      // Outer glow circle
      doc.save();
      doc.circle(centerX, centerY, playRadius + 5)
         .fillColor('#000000', 0.35)
         .fill();
      doc.restore();

      // Red Main Circle
      doc.circle(centerX, centerY, playRadius)
         .fillColor('#e11d48')
         .fill();

      // Sharp White Vector Play Triangle (No Unicode glyph corruption!)
      doc.polygon(
        [centerX - 8, centerY - 12],
        [centerX - 8, centerY + 12],
        [centerX + 13, centerY]
      ).fillColor('#ffffff').fill();

      // Simulated Player Bottom Control Bar
      const barHeight = 26;
      const barY = playerY + playerHeight - barHeight;

      doc.save();
      doc.rect(playerX, barY, playerWidth, barHeight)
         .fillColor('#050508', 0.88)
         .fill();
      doc.restore();

      // Red Video Progress Buffer Line
      doc.rect(playerX, barY, playerWidth * 0.42, 3)
         .fillColor('#e11d48')
         .fill();
      doc.rect(playerX + (playerWidth * 0.42), barY, playerWidth * 0.58, 3)
         .fillColor('#334155')
         .fill();

      // Mini vector play triangle in control bar
      doc.polygon(
        [playerX + 14, barY + 9],
        [playerX + 14, barY + 17],
        [playerX + 21, barY + 13]
      ).fillColor('#e11d48').fill();

      // Control Bar Timers and Quality
      doc.font('Helvetica-Bold')
         .fontSize(8.5)
         .fillColor('#f1f5f9')
         .text('00:00 / Full HD 1080p (Ultra Quality)', playerX + 28, barY + 8);

      doc.font('Helvetica-Bold')
         .fontSize(8.5)
         .fillColor('#e11d48')
         .text('[CLICK TO PLAY]', playerX + playerWidth - 110, barY + 8);

      // Embedded Hyperlink over the ENTIRE Video Player box!
      doc.link(playerX, playerY, playerWidth, playerHeight, primaryChannelUrl);

      doc.y = playerY + playerHeight + 14;

      // -----------------------------------------------------------
      // HIGH CONVERTING PRIMARY CTA BUTTON (Direct Channel Link)
      // -----------------------------------------------------------
      const btnHeight = 36;
      const btnY = doc.y;

      doc.roundedRect(playerX, btnY, playerWidth, btnHeight, 6)
         .fillColor('#e11d48')
         .fill();

      doc.font('Helvetica-Bold')
         .fontSize(11.5)
         .fillColor('#ffffff')
         .text(`WATCH FULL VIDEO ON TELEGRAM (@${primaryHandle.toUpperCase()})`, playerX, btnY + 11, {
           width: playerWidth,
           align: 'center'
         });

      doc.link(playerX, btnY, playerWidth, btnHeight, primaryChannelUrl);

      doc.y = btnY + btnHeight + 8;

      // -----------------------------------------------------------
      // SECONDARY BACKUP CHANNEL BUTTON
      // -----------------------------------------------------------
      const secBtnHeight = 28;
      const secBtnY = doc.y;

      doc.roundedRect(playerX, secBtnY, playerWidth, secBtnHeight, 6)
         .fillColor('#0f172a')
         .fill();

      doc.font('Helvetica-Bold')
         .fontSize(9.5)
         .fillColor('#94a3b8')
         .text(`JOIN OFFICIAL BACKUP CHANNEL (@${backupHandle.toUpperCase()})`, playerX, secBtnY + 9, {
           width: playerWidth,
           align: 'center'
         });

      doc.link(playerX, secBtnY, playerWidth, secBtnHeight, backupChannelUrl);

      doc.y = secBtnY + secBtnHeight + 14;

      // Clean Page 1 SEO Story Introduction
      const introText = contentData.introductions[0].replace(/{title}/g, title);
      doc.font('Helvetica')
         .fontSize(9.5)
         .fillColor('#334155')
         .lineGap(3)
         .text(introText, { align: 'justify' });

      // =========================================================================
      // PAGES 2 to N: White Paper Structured SEO Story, Clusters, & Repeat CTAs
      // =========================================================================
      const cleanTitleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 4).join(' ');

      for (let p = 2; p <= pages; p++) {
        doc.addPage();

        // 1. Sticky Clickable Top Banner on EVERY Page
        const bannerHeight = 28;
        doc.roundedRect(margin, margin, contentWidth, bannerHeight, 4)
           .fillColor('#e11d48')
           .fill();

        doc.font('Helvetica-Bold')
           .fontSize(9.5)
           .fillColor('#ffffff')
           .text(`CLICK HERE TO STREAM "${title.substring(0, 36)}..." ON TELEGRAM`, margin, margin + 9, {
             width: contentWidth,
             align: 'center'
           });

        doc.link(margin, margin, contentWidth, bannerHeight, primaryChannelUrl);

        doc.y = margin + bannerHeight + 18;

        // Chapter Heading
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#0f172a')
           .text(`Chapter ${p}: Plot Synopsis, Search Trends & Streaming Guide`, { align: 'left' });

        doc.moveDown(0.5);

        // Story Synopsis Snippet
        const synIndex = (p - 2) % contentData.synopsis_templates.length;
        const synParagraph = contentData.synopsis_templates[synIndex].replace(/{title}/g, title);

        doc.font('Helvetica')
           .fontSize(9.5)
           .fillColor('#334155')
           .lineGap(3)
           .text(synParagraph, { align: 'justify' });

        doc.moveDown(0.7);

        // Streaming Guide Section
        if (p === 2) {
          const guide = contentData.streaming_guides[0];
          doc.font('Helvetica-Bold')
             .fontSize(11)
             .fillColor('#0f172a')
             .text('Verified Streaming Instructions:');

          doc.moveDown(0.3);
          doc.font('Helvetica')
             .fontSize(9)
             .fillColor('#475569')
             .lineGap(2)
             .text(guide);

          doc.moveDown(0.7);
        } else if (p === 3) {
          const benefits = contentData.streaming_guides[1];
          doc.font('Helvetica-Bold')
             .fontSize(11)
             .fillColor('#0f172a')
             .text('Key Features of High-Speed Telegram Stream:');

          doc.moveDown(0.3);
          doc.font('Helvetica')
             .fontSize(9)
             .fillColor('#475569')
             .lineGap(2)
             .text(benefits);

          doc.moveDown(0.7);
        }

        // Targeted SEO Keyword Cluster Block
        doc.font('Helvetica-Bold')
           .fontSize(10.5)
           .fillColor('#0f172a')
           .text(`Targeted Search Queries & Alternative Keywords:`);

        doc.moveDown(0.3);

        doc.font('Helvetica')
           .fontSize(8.5)
           .fillColor('#64748b')
           .lineGap(2);

        // Build 8-12 unique keyword queries per page
        const modifiers = keywordsData.search_intent_modifiers;
        const startIdx = ((p - 2) * 6) % modifiers.length;
        const pageKeywords = modifiers.slice(startIdx, startIdx + 8).map(m => `${cleanTitleWords} ${m}`);

        pageKeywords.forEach(kw => {
          doc.text(`- ${kw}`);
        });

        // Sticky Clickable Bottom Banner on EVERY Page
        const btmBannerHeight = 26;
        const btmBannerY = pageHeight - margin - btmBannerHeight;

        doc.roundedRect(margin, btmBannerY, contentWidth, btmBannerHeight, 4)
           .fillColor('#0f172a')
           .fill();

        doc.font('Helvetica-Bold')
           .fontSize(9)
           .fillColor('#e11d48')
           .text(`JOIN @${primaryHandle.toUpperCase()} FOR INSTANT 1080P DOWNLOAD`, margin, btmBannerY + 8, {
             width: contentWidth,
             align: 'center'
           });

        doc.link(margin, btmBannerY, contentWidth, btmBannerHeight, primaryChannelUrl);
      }

      // End and finalize PDF
      doc.end();

      writeStream.on('finish', () => {
        resolve(pdfFilePath);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateSeoPdf,
  downloadImageBuffer
};
