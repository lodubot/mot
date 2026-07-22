// Instagram Downloader - Combined fastdl + reelsvideo
import axios from "axios";
import crypto from "crypto";
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

// ====== FastDL Config ======
const CONFIG = {
  secretKeyHex: "34ac9a1aa6aaa7d69a7075611898f16a85d496b1d8f1c7aaa5640a2d93d7af80",
  appVersionTS: "1770240123231",
  userAgent: "Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.109 Mobile Safari/537.36",
};

const CORS_PROXY = "https://cors.yardansh.com/";

// ====== ReelsVideo Config ======
const REELS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'hx-request': 'true',
    'hx-current-url': 'https://reelsvideo.io/',
    'hx-target': 'target',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': 'https://reelsvideo.io',
    'Referer': 'https://reelsvideo.io/'
};

function generateTS() {
    return Math.floor(Date.now() / 1000);
}

function generateTT(ts) {
    return CryptoJS.MD5(ts + 'X-Fc-Pp-Ty-eZ').toString();
}

// ====== FastDL Functions ======
async function fastDLDownload(igUrl) {
  const isStory = igUrl.includes("/stories/");
  let cleanUrl = igUrl.split("?")[0];
  if (!cleanUrl.endsWith("/")) cleanUrl += "/";

  const homeRes = await axios.get(CORS_PROXY + "https://fastdl.app/id", {
    headers: { "User-Agent": CONFIG.userAgent },
  });
  const cookieStr = homeRes.headers["set-cookie"]
    ? homeRes.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ")
    : "";

  const msecRes = await axios.get(CORS_PROXY + "https://fastdl.app/msec", {
    headers: { "User-Agent": CONFIG.userAgent, Cookie: cookieStr },
  });
  const serverTime = Math.floor(msecRes.data.msec * 1000);
  const ts = serverTime - 450;

  const signatureSource = isStory
    ? JSON.stringify({ url: cleanUrl }) + ts
    : cleanUrl + ts;
  const signature = crypto
    .createHmac("sha256", Buffer.from(CONFIG.secretKeyHex, "hex"))
    .update(signatureSource)
    .digest("hex");

  let response;
  if (isStory) {
    response = await axios.post(
      CORS_PROXY + "https://api-wh.fastdl.app/api/v1/instagram/story",
      {
        url: cleanUrl,
        ts,
        _ts: CONFIG.appVersionTS,
        _tsc: 0,
        _sv: 2,
        _s: signature,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.userAgent,
          Origin: "https://fastdl.app",
          Referer: "https://fastdl.app/id/story-saver",
          Cookie: cookieStr,
        },
      },
    );
  } else {
    const params = new URLSearchParams();
    params.append("sf_url", cleanUrl);
    params.append("ts", ts);
    params.append("_ts", CONFIG.appVersionTS);
    params.append("_tsc", "0");
    params.append("_sv", "2");
    params.append("_s", signature);

    response = await axios.post(
      CORS_PROXY + "https://api-wh.fastdl.app/api/convert",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": CONFIG.userAgent,
          Origin: "https://fastdl.app",
          Referer: "https://fastdl.app/id",
          Cookie: cookieStr,
        },
      },
    );
  }
  return response.data;
}

function formatStoryResult(data) {
  const result = data.result[0];
  const media = [];
  if (result.video_versions?.length > 0)
    media.push({
      type: "video",
      url: result.video_versions[0].url_wrapped || result.video_versions[0].url,
    });
  if (result.image_versions2?.candidates?.length > 0)
    media.push({
      type: "image",
      url: result.image_versions2.candidates[0].url_wrapped || result.image_versions2.candidates[0].url,
    });
  return {
    username: result.user?.username || "-",
    id: result.user?.id || "-",
    is_private: result.user?.is_private || false,
    profile_url: result.user?.profile_pic_url || "-",
    taken_at: result.taken_at || "-",
    media,
  };
}

function formatPostResult(data) {
  const items = Array.isArray(data) ? data : [data];
  const media = [];
  const firstItem = items[0];
  const meta = firstItem.meta || {};

  for (const item of items) {
    if (item.url && Array.isArray(item.url)) {
      const videoUrl = item.url.find(u => u.type === 'video');
      if (videoUrl) {
        media.push({ type: 'video', url: videoUrl.url || '' });
      } else {
        const imageUrl = item.url[0];
        media.push({ type: imageUrl.type || 'image', url: imageUrl.url || '' });
      }
    } else if (item.hd) {
      media.push({ type: 'video', url: item.hd });
    } else if (item.sd) {
      media.push({ type: 'video', url: item.sd });
    } else if (item.thumb) {
      media.push({ type: 'image', url: item.thumb });
    }
  }

  return {
    title: meta.title || "-",
    likes: meta.like_count || "-",
    comment: meta.comment_count || "-",
    username: meta.username || "-",
    taken_at: meta.taken_at || "-",
    thumbnail: firstItem.thumb || "-",
    media,
    comments: meta.comments || [],
  };
}

async function fastDL(igUrl) {
  try {
    const data = await fastDLDownload(igUrl);
    return igUrl.includes("/stories/")
      ? formatStoryResult(data)
      : formatPostResult(data);
  } catch (e) {
    return null;
  }
}

// ====== ReelsVideo Functions ======
async function reelsvideo(igUrl) {
    try {
        const ts = generateTS();
        const tt = generateTT(ts);

        const body = new URLSearchParams();
        body.append('id', igUrl);
        body.append('locale', 'en');
        body.append('cf-turnstile-response', '');
        body.append('tt', tt);
        body.append('ts', ts);

        const res = await axios.post(
            'https://reelsvideo.io/reel/DUU67gXiTwU/?igsh=MTZxdm1yd3pnN3Rvdg==/',
            body,
            { headers: REELS_HEADERS, timeout: 30000 }
        );

        const $ = cheerio.load(res.data);

        const username = $('.bg-white span.text-400-16-18').first().text().trim() || null;
        const thumb = $('div[data-bg]').first().attr('data-bg') || null;

        const videos = [];
        $('a.type_videos').each((_, el) => {
            const href = $(el).attr('href');
            if (href) videos.push(href);
        });

        const images = [];
        $('a.type_images').each((_, el) => {
            const href = $(el).attr('href');
            if (href) images.push(href);
        });

        let type = 'unknown';
        if (videos.length && images.length) type = 'carousel';
        else if (videos.length) type = 'video';
        else if (images.length) type = 'photo';

        const media = [];
        videos.forEach(v => media.push({ type: 'video', url: v }));
        images.forEach(i => media.push({ type: 'image', url: i }));

        return { type, username, thumb, media };
    } catch (e) {
        return null;
    }
}

// ====== Main Export ======
/**
 * Download Instagram post/story/reel
 * @param {string} url - Instagram URL
 * @returns {Promise<{username?: string, media: Array, thumbnail?: string, title?: string}>}
 */
export async function instagramDownloader(url) {
  // Try FastDL first
  let result = await fastDL(url);

  // Fallback to ReelsVideo
  if (!result || !result.media || result.media.length === 0) {
    result = await reelsvideo(url);
  }

  return result || { media: [] };
}

export default instagramDownloader;
