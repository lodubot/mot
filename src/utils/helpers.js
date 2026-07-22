// Utility Helpers
import axios from 'axios';

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Extract URL from text
 */
export function extractUrl(text) {
  if (!text) return null;
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url) {
  if (!url) return null;

  if (/(youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/(facebook|fb\.watch|fb\.me)/i.test(url)) return 'facebook';

  return null;
}

/**
 * Download file buffer with progress
 */
export async function downloadBuffer(url, timeout = 60000) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  return Buffer.from(response.data);
}

/**
 * Sleep function
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape markdown for Telegram
 */
export function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/_/g, '\_')
    .replace(/\*/g, '\*')
    .replace(/\[/g, '\[')
    .replace(/\]/g, '\]')
    .replace(/\(/g, '\(')
    .replace(/\)/g, '\)')
    .replace(/~/g, '\~')
    .replace(/`/g, '\`')
    .replace(/>/g, '\>')
    .replace(/#/g, '\#')
    .replace(/\+/g, '\+')
    .replace(/=/g, '\=')
    .replace(/\|/g, '\|')
    .replace(/\{/g, '\{')
    .replace(/\}/g, '\}')
    .replace(/\./g, '\.');
}

/**
 * Truncate text
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
