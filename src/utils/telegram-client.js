// GramJS MTProto Client - For sending large files up to 2GB
import { TelegramClient } from 'gramjs';
import { StringSession } from 'gramjs/sessions';
import { Api } from 'gramjs/tl';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Store client globally
let client = null;
let isConnected = false;

/**
 * Initialize GramJS client
 * @param {string} apiId - Telegram API ID (from my.telegram.org)
 * @param {string} apiHash - Telegram API Hash
 * @param {string} sessionString - Previous session string (optional)
 */
export async function initGramJS(apiId, apiHash, sessionString = '') {
  if (client && isConnected) return client;

  const session = new StringSession(sessionString);
  client = new TelegramClient(session, parseInt(apiId), apiHash, {
    connectionRetries: 5,
    useWSS: false,
  });

  await client.start({
    botAuthToken: () => Promise.resolve(''), // Will use bot token later
  });

  isConnected = true;
  console.log('✅ GramJS MTProto client connected!');
  console.log('📦 Session string:', session.save());

  return client;
}

/**
 * Send large video/file using GramJS (up to 2GB)
 * @param {string} chatId - Target chat ID
 * @param {string} fileUrl - URL to download file from
 * @param {Object} options - { caption, thumbnail, duration, width, height }
 */
export async function sendLargeFile(chatId, fileUrl, options = {}) {
  if (!client || !isConnected) {
    throw new Error('GramJS client not initialized. Call initGramJS first.');
  }

  const { caption = '', thumbnail = null, duration = 0, width = 0, height = 0 } = options;

  // Create temp file
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempFile = path.join(tempDir, `dl_${Date.now()}.tmp`);

  try {
    // Download file to temp
    console.log(`⬇️ Downloading large file to temp...`);
    const response = await axios.get(fileUrl, {
      responseType: 'stream',
      timeout: 300000, // 5 min
      maxRedirects: 10,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
      }
    });

    const writer = fs.createWriteStream(tempFile);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const fileSize = fs.statSync(tempFile).size;
    console.log(`📦 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Determine file type
    const ext = path.extname(new URL(fileUrl).pathname) || '.mp4';
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext.toLowerCase());
    const isAudio = ['.mp3', '.m4a', '.ogg', '.wav', '.flac'].includes(ext.toLowerCase());

    // Send via GramJS
    let result;
    if (isVideo) {
      result = await client.sendFile(chatId, {
        file: tempFile,
        caption: caption,
        supportsStreaming: true,
        forceDocument: false,
        attributes: [
          new Api.DocumentAttributeVideo({
            duration: duration || 0,
            w: width || 0,
            h: height || 0,
            supportsStreaming: true,
          })
        ],
        thumb: thumbnail,
        workers: 5,
      });
    } else if (isAudio) {
      result = await client.sendFile(chatId, {
        file: tempFile,
        caption: caption,
        forceDocument: false,
        attributes: [
          new Api.DocumentAttributeAudio({
            duration: duration || 0,
            title: caption || 'Audio',
            performer: 'Downloader Bot',
          })
        ],
        workers: 5,
      });
    } else {
      result = await client.sendFile(chatId, {
        file: tempFile,
        caption: caption,
        forceDocument: true,
        workers: 5,
      });
    }

    console.log('✅ Large file sent successfully!');
    return { success: true, messageId: result.id };

  } finally {
    // Cleanup temp file
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch (e) {}
  }
}

/**
 * Send file from buffer using GramJS
 * @param {string} chatId 
 * @param {Buffer} buffer 
 * @param {string} filename 
 * @param {Object} options 
 */
export async function sendLargeBuffer(chatId, buffer, filename, options = {}) {
  if (!client || !isConnected) {
    throw new Error('GramJS client not initialized.');
  }

  const { caption = '' } = options;

  // Save buffer to temp file
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempFile = path.join(tempDir, filename);
  fs.writeFileSync(tempFile, buffer);

  try {
    const ext = path.extname(filename).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
    const isAudio = ['.mp3', '.m4a', '.ogg', '.wav', '.flac'].includes(ext);

    let result;
    if (isVideo) {
      result = await client.sendFile(chatId, {
        file: tempFile,
        caption: caption,
        supportsStreaming: true,
        forceDocument: false,
        workers: 5,
      });
    } else if (isAudio) {
      result = await client.sendFile(chatId, {
        file: tempFile,
        caption: caption,
        forceDocument: false,
        attributes: [
          new Api.DocumentAttributeAudio({
            title: caption || 'Audio',
            performer: 'Downloader Bot',
          })
        ],
        workers: 5,
      });
    } else {
      result = await client.sendFile(chatId, {
        file: tempFile,
        caption: caption,
        forceDocument: true,
        workers: 5,
      });
    }

    return { success: true, messageId: result.id };
  } finally {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
  }
}

/**
 * Check if file is too large for Bot API (50MB)
 * @param {string} url 
 * @returns {Promise<{size: number, isLarge: boolean}>}
 */
export async function checkFileSize(url) {
  try {
    const head = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
    const size = parseInt(head.headers['content-length'] || 0);
    return { size, isLarge: size > 50 * 1024 * 1024 }; // 50MB
  } catch (e) {
    return { size: 0, isLarge: false };
  }
}

export { client };
