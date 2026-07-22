// YouTube Downloader - Combined y2mate + ytmp3 fallback
import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";

const BASE_URL = "https://id-y2mate.com";
const MAX_TOTAL_TIME = 58000;
const POLL_LIMIT = 55;
const POLL_DELAY = 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  return String(text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function compactAvailable(links) {
  const result = {};
  for (const [type, group] of Object.entries(links || {})) {
    for (const [id, item] of Object.entries(group || {})) {
      const format = item.f || type;
      let quality = item.q || id;
      if (id.includes("@")) {
        quality = id;
      }
      if (format === "m4a" && quality === ".m4a") {
        quality = cleanText(item.q_text).replace(".m4a", "").replace(/[()]/g, "").trim() || "256kbps";
      }
      if (!result[format]) result[format] = [];
      if (!result[format].includes(quality)) result[format].push(quality);
    }
  }
  return result;
}

function pickFormat(links, type, quality) {
  const group = links?.[type];
  if (!group) return null;
  const entries = Object.entries(group).map(([id, data]) => ({ id, ...data }));
  return entries.find(v => v.q === quality || v.id === quality || (v.f === type && v.q === quality)) || 
         entries.find(v => v.q === "auto") || 
         entries[0] || null;
}

function findDownloadUrl(data) {
  if (!data) return null;
  if (typeof data === "string") {
    const match = data.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0].replace(/\\\//g, "/") : null;
  }
  if (typeof data !== "object") return null;
  const keys = ["dlink", "download", "download_url", "url", "link", "result", "result_url", "file", "href"];
  for (const key of keys) {
    if (typeof data[key] === "string" && /^https?:\/\//i.test(data[key])) {
      return data[key].replace(/\\\//g, "/");
    }
  }
  for (const value of Object.values(data)) {
    const found = findDownloadUrl(value);
    if (found) return found;
  }
  return null;
}

// Fallback: akuari API
async function akuariYtmp3(url) {
  try {
    const { data } = await axios.get(`https://api.akuari.my.id/downloader/ytmp3`, {
      params: { link: url },
      timeout: 30000,
      maxRedirects: 5,
    });
    if (data?.status && data?.hasil?.url) {
      return {
        status: true,
        title: data.hasil.title || 'YouTube Audio',
        url: data.hasil.url,
        size: null,
        format: 'mp3',
        quality: '128kbps'
      };
    }
    return { status: false, error: 'Gagal mendapatkan audio dari akuari' };
  } catch (err) {
    return { status: false, error: 'Akuari error: ' + err.message };
  }
}

// ytmp3.mobi fallback
async function ytmp3Mobi(url, format = 'mp3') {
  try {
    const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const videoId = String(url || '').match(YOUTUBE_ID_REGEX)?.[1];
    if (!videoId) return { status: false, error: 'Invalid YouTube URL' };

    const normalizedFormat = String(format || 'mp3').toLowerCase() === 'mp4' ? 'mp4' : 'mp3';

    const client = axios.create({
      timeout: 60000,
      maxRedirects: 10,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7271.123 Mobile Safari/537.36',
        'Referer': 'https://id.ytmp3.mobi/',
      },
    });

    const { data: init } = await client.get('https://d.ymcdn.org/api/v1/init', {
      params: { p: 'y', 23: '1llum1n471', _: Math.random() },
    });

    if (!init?.convertURL) return { status: false, error: 'Init failed' };

    const { data: convert } = await client.get(init.convertURL, {
      params: { v: videoId, f: normalizedFormat, _: Math.random() },
    });

    if (!convert?.progressURL || !convert?.downloadURL) {
      return { status: false, error: 'Convert failed' };
    }

    let progress = 0;
    let title = convert.title || '';
    let attempts = 0;
    const maxAttempts = 20;

    while (progress < 3 && attempts < maxAttempts) {
      const { data } = await client.get(convert.progressURL);
      if ((data?.error || 0) > 0) {
        return { status: false, error: `Server error: ${data.error}` };
      }
      progress = Number(data?.progress || 0);
      title = data?.title || title;
      if (progress < 3) {
        attempts += 1;
        await sleep(250);
      }
    }

    if (attempts >= maxAttempts && progress < 3) {
      return { status: false, error: 'Request timeout' };
    }

    return {
      status: true,
      title,
      url: convert.downloadURL,
      size: null,
      format: normalizedFormat,
      quality: normalizedFormat === 'mp3' ? '128kbps' : '360p'
    };
  } catch (e) {
    return { status: false, error: `System Error: ${e.message}` };
  }
}

// Main y2mate function
export async function y2mate(url, type = 'mp4', quality = '360p') {
  const startedAt = Date.now();
  const jar = new CookieJar();

  if (process.env.CF_CLEARANCE) {
    await jar.setCookie(`cf_clearance=${process.env.CF_CLEARANCE}`, BASE_URL);
  }

  const api = wrapper(axios.create({
    jar,
    withCredentials: true,
    timeout: 20000,
    validateStatus: () => true,
    headers: {
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
      "accept": "*/*",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "origin": BASE_URL,
      "referer": `${BASE_URL}/`,
      "x-requested-with": "XMLHttpRequest",
      "sec-ch-ua": `"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"`,
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": `"Android"`
    }
  }));

  function elapsed() { return Date.now() - startedAt; }
  function timeoutReached() { return elapsed() >= MAX_TOTAL_TIME; }

  try {
    await api.get(`${BASE_URL}/`, {
      timeout: 15000,
      headers: { "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }
    });

    if (timeoutReached()) throw new Error("Timeout setelah load home");

    const body = new URLSearchParams({
      k_query: url,
      k_page: "home",
      hl: "en",
      q_auto: "0"
    });
    const analyzeRes = await api.post(`${BASE_URL}/mates/analyzeV2/ajax`, body.toString(), {
      timeout: 20000,
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }
    });

    if (analyzeRes.status !== 200 || analyzeRes.data?.status !== "ok") {
      return { status: false, error: `Gagal analyze: ${analyzeRes.data?.message || analyzeRes.status}` };
    }

    const detail = analyzeRes.data;
    const selected = pickFormat(detail.links, type, quality);
    if (!selected?.k) {
      return {
        status: false,
        error: `Format ${type} ${quality} tidak ditemukan`,
        available: compactAvailable(detail.links)
      };
    }

    const convertBody = new URLSearchParams({
      vid: detail.vid,
      k: selected.k
    });
    const convertRes = await api.post(`${BASE_URL}/mates/convertV2/index`, convertBody.toString(), {
      timeout: 20000,
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }
    });

    let resultUrl = findDownloadUrl(convertRes.data);

    if (!resultUrl && convertRes.data?.b_id && !timeoutReached()) {
      for (let i = 0; i < POLL_LIMIT; i++) {
        if (timeoutReached()) break;
        const pollBody = new URLSearchParams({ b_id: convertRes.data.b_id });
        const pollRes = await api.post(`${BASE_URL}/mates/convertV2/pool`, pollBody.toString(), {
          timeout: 10000,
          headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }
        });
        const urlFound = findDownloadUrl(pollRes.data);
        if (urlFound) {
          resultUrl = urlFound;
          break;
        }
        if (pollRes.data?.c_status === "FAILED" || pollRes.data?.status === "error") {
          break;
        }
        await sleep(POLL_DELAY);
      }
    }

    if (!resultUrl) {
      return {
        status: false,
        error: timeoutReached() ? "Timeout: proses terlalu lama" : "Link download tidak ditemukan",
        available: compactAvailable(detail.links)
      };
    }

    return {
      status: true,
      url: resultUrl,
      title: detail.title || null,
      duration: detail.t || null,
      size: selected.size || null,
      format: selected.f || type,
      quality: selected.q || quality,
      available: compactAvailable(detail.links)
    };

  } catch (error) {
    return {
      status: false,
      error: error.message || 'Terjadi kesalahan'
    };
  }
}

/**
 * Download YouTube video/audio with fallback
 * @param {string} url - YouTube URL
 * @param {string} type - 'mp3' or 'mp4'
 * @param {string} quality - e.g. '360p', '720p', '128kbps'
 */
export async function youtubeDownloader(url, type = 'mp4', quality = '360p') {
  // Try y2mate first
  let result = await y2mate(url, type, quality);

  if (!result.status) {
    // Fallback to ytmp3.mobi
    result = await ytmp3Mobi(url, type);
  }

  if (!result.status && type === 'mp3') {
    // Fallback to akuari for mp3 only
    result = await akuariYtmp3(url);
  }

  return result;
}

export default youtubeDownloader;
