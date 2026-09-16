const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// Load keywords and content templates
const keywordsData = require('./keywords.json');
const contentData = require('./content.json');

/**
 * Download image as buffer and convert to JPEG using Sharp
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
      const jpegBuffer = await sharp(res.data)
        .jpeg({ quality: 92 })
        .toBuffer();
      return jpegBuffer;
    }
  } catch (err) {
    console.warn(`[PDF Engine] Thumbnail image download failed: ${err.message}`);
  }
  return null;
}

/**
 * Generate a dense, fully packed 5-page White SEO Romance Novel & Streaming PDF
 * 
 * @param {Object} options
 * @param {string} options.title - Dynamic Video Title
 * @param {string} options.thumbnail - Image URL
 * @param {string} options.primaryChannelUrl - Active Telegram channel link
 * @param {string} options.backupChannelUrl - Backup Telegram channel link
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

  // Safe file name based on dynamic title
  const safeName = title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 60);
  const pdfFileName = `${safeName}.pdf`;
  const pdfFilePath = path.join(outputDir, pdfFileName);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 35,
        autoFirstPage: false, // Explicit page control prevents accidental page breaks
        info: {
          Title: title,
          Author: `@${primaryHandle}`,
          Subject: `${title} - Full Video Stream & Story Edition`,
          Keywords: `${title}, watch online, download, telegram link, 1080p, uncut, full video, web series`
        }
      });

      const writeStream = fs.createWriteStream(pdfFilePath);
      doc.pipe(writeStream);

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 35;
      const contentWidth = pageWidth - (margin * 2); // 525.28

      // Download and convert thumbnail buffer to JPEG
      const imgBuffer = await downloadImageBuffer(thumbnail);

      // =========================================================================
      // PAGE 1: Header + Player + 2 CTA Buttons + Specs + Story Overview
      // =========================================================================
      doc.addPage({ size: 'A4', margin: 35 });

      // 1. Top Badge
      const badgeY = margin;
      const badgeH = 22;
      doc.roundedRect(margin, badgeY, contentWidth, badgeH, 4)
         .fillColor('#ffe4e6')
         .fill();

      doc.font('Helvetica-Bold')
         .fontSize(9.5)
         .fillColor('#e11d48')
         .text('OFFICIAL VERIFIED TELEGRAM STREAM & DOWNLOAD LINK • 1080P ULTRA HD', margin, badgeY + 6, {
           width: contentWidth,
           align: 'center'
         });

      // 2. Main Title Heading
      const titleY = badgeY + badgeH + 8;
      doc.font('Helvetica-Bold')
         .fontSize(15)
         .fillColor('#0f172a')
         .text(title, margin, titleY, { width: contentWidth, align: 'center' });

      // 3. Fake Video Player Graphic
      const playerY = doc.y + 8;
      const playerWidth = contentWidth;
      const playerHeight = Math.round(playerWidth * 0.44); // ~231pt
      const playerX = margin;

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

      // Semi-transparent dark vignette over thumbnail
      doc.save();
      doc.rect(playerX, playerY, playerWidth, playerHeight)
         .fillColor('#000000', 0.28)
         .fill();
      doc.restore();

      // Glowing Red Play Button in Center
      const centerX = playerX + (playerWidth / 2);
      const centerY = playerY + (playerHeight / 2) - 6;
      const playRadius = 26;

      doc.save();
      doc.circle(centerX, centerY, playRadius + 4)
         .fillColor('#000000', 0.35)
         .fill();
      doc.restore();

      doc.circle(centerX, centerY, playRadius)
         .fillColor('#e11d48')
         .fill();

      // Sharp White Vector Play Triangle
      doc.polygon(
        [centerX - 7, centerY - 11],
        [centerX - 7, centerY + 11],
        [centerX + 12, centerY]
      ).fillColor('#ffffff').fill();

      // Simulated Player Bottom Control Bar
      const barHeight = 22;
      const barY = playerY + playerHeight - barHeight;

      doc.save();
      doc.rect(playerX, barY, playerWidth, barHeight)
         .fillColor('#050508', 0.90)
         .fill();
      doc.restore();

      // Red Video Progress Buffer Line
      doc.rect(playerX, barY, playerWidth * 0.42, 2.5)
         .fillColor('#e11d48')
         .fill();
      doc.rect(playerX + (playerWidth * 0.42), barY, playerWidth * 0.58, 2.5)
         .fillColor('#334155')
         .fill();

      // Mini vector play triangle in control bar
      doc.polygon(
        [playerX + 12, barY + 7],
        [playerX + 12, barY + 15],
        [playerX + 18, barY + 11]
      ).fillColor('#e11d48').fill();

      doc.font('Helvetica-Bold')
         .fontSize(8.5)
         .fillColor('#f1f5f9')
         .text('00:00 / Full HD 1080p (Ultra Quality)', playerX + 24, barY + 6.5);

      doc.font('Helvetica-Bold')
         .fontSize(8.5)
         .fillColor('#e11d48')
         .text('[CLICK TO PLAY]', playerX + playerWidth - 100, barY + 6.5);

      // Embedded Hyperlink over the ENTIRE Video Player box!
      doc.link(playerX, playerY, playerWidth, playerHeight, primaryChannelUrl);

      // 4. Primary CTA Button
      const btnY = playerY + playerHeight + 8;
      const btnHeight = 32;
      doc.roundedRect(playerX, btnY, playerWidth, btnHeight, 5)
         .fillColor('#e11d48')
         .fill();

      doc.font('Helvetica-Bold')
         .fontSize(11.5)
         .fillColor('#ffffff')
         .text(`WATCH FULL VIDEO ON TELEGRAM (@${primaryHandle.toUpperCase()})`, playerX, btnY + 10, {
           width: playerWidth,
           align: 'center'
         });

      doc.link(playerX, btnY, playerWidth, btnHeight, primaryChannelUrl);

      // 5. Secondary Backup Channel Button
      const secBtnY = btnY + btnHeight + 6;
      const secBtnHeight = 25;
      doc.roundedRect(playerX, secBtnY, playerWidth, secBtnHeight, 5)
         .fillColor('#0f172a')
         .fill();

      doc.font('Helvetica-Bold')
         .fontSize(9.5)
         .fillColor('#94a3b8')
         .text(`JOIN OFFICIAL BACKUP CHANNEL (@${backupHandle.toUpperCase()})`, playerX, secBtnY + 8, {
           width: playerWidth,
           align: 'center'
         });

      doc.link(playerX, secBtnY, playerWidth, secBtnHeight, backupChannelUrl);

      // 6. Technical Specifications Card
      const specsBoxY = secBtnY + secBtnHeight + 8;
      const specsBoxHeight = 46;
      doc.roundedRect(margin, specsBoxY, contentWidth, specsBoxHeight, 4)
         .fillColor('#f8fafc')
         .fill();
      doc.roundedRect(margin, specsBoxY, contentWidth, specsBoxHeight, 4)
         .lineWidth(0.8)
         .strokeColor('#e2e8f0')
         .stroke();

      doc.font('Helvetica-Bold')
         .fontSize(8.5)
         .fillColor('#e11d48')
         .text('VERIFIED STREAMING TECHNICAL METADATA:', margin + 12, specsBoxY + 7);

      const col1X = margin + 12;
      const col2X = margin + (contentWidth / 2);

      doc.font('Helvetica')
         .fontSize(8.5)
         .fillColor('#334155')
         .text('• Resolution: 1080p Full HD (1920x1080)', col1X, specsBoxY + 20)
         .text('• Video Codec: H.264 / AVC 60fps Master', col1X, specsBoxY + 31)
         .text('• Audio: AAC 320kbps High Fidelity', col2X, specsBoxY + 20)
         .text('• Cloud Mirror: Official Telegram CDN', col2X, specsBoxY + 31);

      // 7. Page 1 Story Overview (Measured precisely so it NEVER overflows!)
      const storyHeadingY = specsBoxY + specsBoxHeight + 8;
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor('#0f172a')
         .text('Cinematic Story Overview & Verified Access:', margin, storyHeadingY);

      const p1Text = contentData.page1_synopsis[0].replace(/{title}/g, title);
      const p2Text = contentData.page1_synopsis[1].replace(/{title}/g, title);

      doc.font('Helvetica')
         .fontSize(9.8)
         .fillColor('#334155')
         .lineGap(3)
         .text(p1Text, margin, storyHeadingY + 16, { width: contentWidth, align: 'justify' });

      doc.moveDown(0.3);
      doc.font('Helvetica')
         .fontSize(9.8)
         .fillColor('#334155')
         .lineGap(3)
         .text(p2Text, { width: contentWidth, align: 'justify' });

      // =========================================================================
      // PAGES 2 to N: Novel Chapters + Real Internet Queries + Top/Bottom Banners
      // =========================================================================
      const liveQueries = keywordsData.live_internet_queries || [];
      const intentSuffixes = keywordsData.dynamic_intent_suffixes || [];

      for (let p = 2; p <= pages; p++) {
        doc.addPage({ size: 'A4', margin: 35 });

        // 1. Sticky Clickable Top Banner
        const topBannerH = 26;
        doc.roundedRect(margin, margin, contentWidth, topBannerH, 4)
           .fillColor('#e11d48')
           .fill();

        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('#ffffff')
           .text(`CLICK HERE TO STREAM "${title.substring(0, 36)}..." ON TELEGRAM (@${primaryHandle.toUpperCase()})`, margin, margin + 8, {
             width: contentWidth,
             align: 'center'
           });

        doc.link(margin, margin, contentWidth, topBannerH, primaryChannelUrl);

        // 2. Chapter Heading
        const chapterIdx = (p - 2) % contentData.story_chapters.length;
        const chapter = contentData.story_chapters[chapterIdx];
        const chapHeadingY = margin + topBannerH + 12;

        doc.font('Helvetica-Bold')
           .fontSize(13.5)
           .fillColor('#0f172a')
           .text(chapter.title, margin, chapHeadingY);

        // 3. Dense Novel Story Paragraphs (in clear, readable 10pt font)
        let curStoryY = chapHeadingY + 20;
        // Take 3 long, dense paragraphs
        const parasToRender = chapter.paragraphs.slice(0, 3);
        parasToRender.forEach(para => {
          const formattedPara = para.replace(/{title}/g, title);
          doc.font('Helvetica')
             .fontSize(10)
             .fillColor('#334155')
             .lineGap(3)
             .text(formattedPara, margin, curStoryY, { width: contentWidth, align: 'justify' });
          curStoryY = doc.y + 7;
        });

        // 4. Middle Informative Feature Box
        const infoBoxY = curStoryY + 2;
        const infoBoxH = 58;

        doc.roundedRect(margin, infoBoxY, contentWidth, infoBoxH, 4)
           .fillColor('#f8fafc')
           .fill();
        doc.roundedRect(margin, infoBoxY, contentWidth, infoBoxH, 4)
           .lineWidth(0.8)
           .strokeColor('#e2e8f0')
           .stroke();

        if (p === 2) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('Official Streaming Guide:', margin + 10, infoBoxY + 8);
          doc.font('Helvetica').fontSize(8.5).fillColor('#475569').lineGap(2).text(
            '1. Click on any red WATCH FULL VIDEO button to open our verified channel (@' + primaryHandle.toUpperCase() + ').\n2. Tap Join Channel and stream in 1080p Full HD without popups or surveys.',
            margin + 10, infoBoxY + 22, { width: contentWidth - 20 }
          );
        } else if (p === 3) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('Why Join Our Telegram Media Network:', margin + 10, infoBoxY + 8);
          doc.font('Helvetica').fontSize(8.5).fillColor('#475569').lineGap(2).text(
            '• 100% Free high-speed direct downloads hosted on global Telegram cloud CDN.\n• Daily drops of trending viral MMS, uncut adult web series, and exclusive daily leaks.',
            margin + 10, infoBoxY + 22, { width: contentWidth - 20 }
          );
        } else if (p === 4) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('Frequently Asked Questions (FAQ):', margin + 10, infoBoxY + 8);
          doc.font('Helvetica').fontSize(8.5).fillColor('#475569').lineGap(2).text(
            'Q: Is the video free to stream?  A: Yes, all videos in our channel are 100% free.\nQ: Which resolutions are provided?  A: 1080p Ultra HD, 720p HD, and mobile MP4.',
            margin + 10, infoBoxY + 22, { width: contentWidth - 20 }
          );
        } else {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('Collector Archive & Mirror Notice:', margin + 10, infoBoxY + 8);
          doc.font('Helvetica').fontSize(8.5).fillColor('#475569').lineGap(2).text(
            'All releases stored in our Telegram cloud server are permanently archived with multi-region redundancy. Fresh mirror links are posted to both @' + primaryHandle.toUpperCase() + ' and @' + backupHandle.toUpperCase() + '.',
            margin + 10, infoBoxY + 22, { width: contentWidth - 20 }
          );
        }

        // 5. Popular Search Queries Block (Readable 9pt font, 2 columns)
        const kwSectionY = infoBoxY + infoBoxH + 10;
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('#0f172a')
           .text('Popular Trending Searches & Related Streaming Queries:', margin, kwSectionY);

        const queryStart = ((p - 2) * 8) % Math.max(1, liveQueries.length - 8);
        const pageLiveQueries = liveQueries.slice(queryStart, queryStart + 8);

        // Add 2 dynamic title combinations
        const titleWordBase = title.split(/\s+/).slice(0, 5).join(' ');
        intentSuffixes.slice((p - 2) * 2, ((p - 2) * 2) + 2).forEach(suffix => {
          pageLiveQueries.push(`${titleWordBase} ${suffix}`);
        });

        const halfWidth = (contentWidth / 2) - 8;
        const col1Left = margin;
        const col2Left = margin + halfWidth + 16;
        const kwListY = kwSectionY + 16;

        const leftList = pageLiveQueries.slice(0, Math.ceil(pageLiveQueries.length / 2));
        const rightList = pageLiveQueries.slice(Math.ceil(pageLiveQueries.length / 2));

        doc.font('Helvetica')
           .fontSize(8.8)
           .fillColor('#475569')
           .lineGap(2.5);

        let leftY = kwListY;
        leftList.forEach(kw => {
          doc.text(`• ${kw}`, col1Left, leftY, { width: halfWidth });
          leftY = doc.y;
        });

        let rightY = kwListY;
        rightList.forEach(kw => {
          doc.text(`• ${kw}`, col2Left, rightY, { width: halfWidth });
          rightY = doc.y;
        });

        // 6. Sticky Clickable Bottom Banner (Anchored cleanly at the bottom)
        const btmBannerH = 26;
        const btmBannerY = pageHeight - margin - btmBannerH;

        doc.roundedRect(margin, btmBannerY, contentWidth, btmBannerH, 4)
           .fillColor('#0f172a')
           .fill();

        doc.font('Helvetica-Bold')
           .fontSize(9.5)
           .fillColor('#e11d48')
           .text(`👉 CLICK HERE TO JOIN @${primaryHandle.toUpperCase()} FOR INSTANT 1080P DOWNLOAD`, margin, btmBannerY + 8.5, {
             width: contentWidth,
             align: 'center'
           });

        doc.link(margin, btmBannerY, contentWidth, btmBannerH, primaryChannelUrl);
      }

      // Finalize and close PDF stream
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
