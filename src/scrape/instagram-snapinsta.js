// Instagram Downloader via SnapInsta (NEW - Better quality)
import axios from "axios";
import FormData from "form-data";
import * as cheerio from "cheerio";

/**
 * Download Instagram via SnapInsta (HD quality)
 * @param {string} url - Instagram URL
 * @returns {Promise<{status: number, media: Array<{type: string, url: string}>}>}
 */
export async function instagramSnapInsta(url) {
  try {
    const form = new FormData();
    form.append("url", url);
    form.append("action", "post");

    const res = await axios.post("https://snapinsta.top/action.php", form, {
      headers: {
        ...form.getHeaders(),
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36",
        "accept": "*/*",
        "origin": "https://snapinsta.top",
        "referer": "https://snapinsta.top/"
      },
      timeout: 30000
    });

    const $ = cheerio.load(res.data);
    const downloads = [];

    $(".download-items__btn a").each((_, el) => {
      let path = $(el).attr("href");
      if (!path) return;
      if (!path.startsWith("http")) path = "https://snapinsta.top" + path;
      downloads.push(path);
    });

    // Detect type from URL extension
    const media = downloads.map(url => {
      const isVideo = /\.(mp4|mov|webm)/i.test(url);
      return {
        type: isVideo ? 'video' : 'image',
        url: url
      };
    });

    return {
      status: downloads.length ? 200 : 404,
      username: 'Instagram',
      media: media
    };
  } catch (e) {
    console.error('[SnapInsta]', e.message);
    return { status: 500, media: [] };
  }
}

/**
 * Download Instagram media as buffer (for direct send)
 * @param {string} url - Instagram URL
 * @returns {Promise<Array<{type: string, buffer: Buffer}>>}
 */
export async function instagramSnapInstaBuffer(url) {
  try {
    const result = await instagramSnapInsta(url);
    if (!result.media.length) return [];

    const buffers = [];
    for (const item of result.media) {
      try {
        const { data } = await axios.get(item.url, { 
          responseType: "arraybuffer",
          timeout: 60000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
          }
        });
        const buf = Buffer.from(data);

        // Detect type from buffer magic bytes
        const isVideo = buf.slice(4, 8).toString() === "ftyp" || buf.toString('hex', 0, 4) === '00000018';

        buffers.push({
          type: isVideo ? 'video' : 'image',
          buffer: buf,
          url: item.url
        });
      } catch (e) {
        console.error('[SnapInsta Buffer]', e.message);
      }
    }
    return buffers;
  } catch (e) {
    console.error('[SnapInsta Buffer]', e.message);
    return [];
  }
}

export default instagramSnapInsta;
