const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ARCHIVE_ACCESS_KEY = process.env.ARCHIVE_ACCESS_KEY || '';
const ARCHIVE_SECRET_KEY = process.env.ARCHIVE_SECRET_KEY || '';

/**
 * Generate a unique, safe Archive.org item identifier (slug)
 */
function createArchiveIdentifier(title) {
  const safeSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
    .replace(/^-|-$/g, '');

  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${safeSlug}-${randomSuffix}`;
}

/**
 * Upload a generated PDF to Internet Archive (Archive.org) via official S3 API
 * 
 * @param {string} pdfFilePath - Local absolute path to the PDF file
 * @param {Object} metadata - PDF metadata for Archive.org indexing
 * @param {string} metadata.title - Title of the video / PDF
 * @param {string} metadata.description - SEO Story & Streaming overview
 * @param {string} metadata.keywords - Semicolon-separated tags/keywords
 * @returns {Promise<{success: boolean, identifier?: string, detailsUrl?: string, downloadUrl?: string, error?: string}>}
 */
async function uploadPdfToArchive(pdfFilePath, metadata = {}) {
  if (!fs.existsSync(pdfFilePath)) {
    return { success: false, error: `File not found: ${pdfFilePath}` };
  }

  // Check if credentials exist
  if (!ARCHIVE_ACCESS_KEY || !ARCHIVE_SECRET_KEY) {
    console.warn('\n⚠️  [Archive.org Notice] S3 API Keys not found in .env.');
    console.warn('👉 To enable automatic upload to Archive.org, get your S3 keys from:');
    console.warn('   https://archive.org/account/s3.php');
    console.warn('   And add to backend/.env:');
    console.warn('   ARCHIVE_ACCESS_KEY=your_key');
    console.warn('   ARCHIVE_SECRET_KEY=your_secret\n');
    return {
      success: false,
      error: 'ARCHIVE_ACCESS_KEY or ARCHIVE_SECRET_KEY missing in .env'
    };
  }

  const fileName = path.basename(pdfFilePath);
  const title = metadata.title || fileName.replace(/\.pdf$/i, '');
  const identifier = createArchiveIdentifier(title);

  // S3 Target URL on Archive.org
  const targetUrl = `https://s3.us.archive.org/${identifier}/${encodeURIComponent(fileName)}`;

  console.log(`\n☁️  Uploading PDF to Archive.org S3...`);
  console.log(`📦 Item Identifier: ${identifier}`);
  console.log(`📄 File: ${fileName}`);

  try {
    const fileStream = fs.createReadStream(pdfFilePath);
    const stats = fs.statSync(pdfFilePath);

    const headers = {
      'Authorization': `LOW ${ARCHIVE_ACCESS_KEY}:${ARCHIVE_SECRET_KEY}`,
      'x-archive-auto-make-bucket': '1',
      'x-archive-meta-mediatype': 'texts',
      'x-archive-meta-title': title,
      'x-archive-meta-description': metadata.description || `${title} - Full HD Online Streaming and Download Guide on Telegram.`,
      'x-archive-meta-subject': metadata.keywords || 'watch online; telegram link; full video; 1080p; download; adult series',
      'x-archive-meta-creator': 'Landy TV Media Network',
      'x-archive-meta-collection': 'opensource',
      'Content-Type': 'application/pdf',
      'Content-Length': stats.size
    };

    const response = await axios.put(targetUrl, fileStream, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000 // 60s timeout
    });

    if (response.status === 200 || response.status === 201) {
      const detailsUrl = `https://archive.org/details/${identifier}`;
      const downloadUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(fileName)}`;

      console.log(`🎉 [Archive.org Success] Uploaded successfully!`);
      console.log(`🔗 Details Page: ${detailsUrl}`);
      console.log(`📥 Direct PDF: ${downloadUrl}\n`);

      return {
        success: true,
        identifier,
        detailsUrl,
        downloadUrl
      };
    } else {
      throw new Error(`Unexpected HTTP status: ${response.status}`);
    }
  } catch (err) {
    const errMsg = err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message;
    console.error(`❌ [Archive.org Error] Upload failed: ${errMsg}`);
    return {
      success: false,
      error: errMsg
    };
  }
}

module.exports = {
  uploadPdfToArchive,
  createArchiveIdentifier,
  hasArchiveCredentials: () => Boolean(ARCHIVE_ACCESS_KEY && ARCHIVE_SECRET_KEY)
};
