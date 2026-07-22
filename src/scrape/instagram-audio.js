// Instagram Reels Audio/MP3 Downloader
import axios from 'axios';
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

function generateTS() {
  return Math.floor(Date.now() / 1000);
}

function generateTT(ts) {
  return CryptoJS.MD5(ts + 'X-Fc-Pp-Ty-eZ').toString();
}

/**
 * Download Instagram Reels Audio as MP3
 * @param {string} url - Instagram Reel URL
 * @returns {Promise<{status: boolean, url?: string, error?: string}>}
 */
export async function instagramAudio(url) {
  try {
    const ts = generateTS();
    const tt = generateTT(ts);

    const { data } = await axios.post(
      'https://reelsvideo.io/reel/',
      new URLSearchParams({
        id: url,
        locale: 'id',
        'cf-turnstile-response': '',
        tt: tt,
        ts: ts
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'HX-Request': 'true',
          'HX-Trigger': 'main-form',
          'HX-Target': 'target',
          'HX-Current-URL': 'https://reelsvideo.io/id',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
          'Referer': 'https://reelsvideo.io/id'
        },
        timeout: 30000
      }
    );

    const $ = cheerio.load(data);
    const mp3Link = $('a.type_audio').attr('href');

    if (!mp3Link) {
      return { status: false, error: 'Audio tidak tersedia di reel ini.' };
    }

    return {
      status: true,
      url: mp3Link,
      title: 'Instagram Reels Audio'
    };
  } catch (e) {
    console.error('[IG Audio]', e.message);
    return { status: false, error: e.message || 'Gagal mengambil audio.' };
  }
}

export default instagramAudio;
