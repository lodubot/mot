// src/scrape/facebook.js
import axios from "axios";
import forge from "node-forge";
import crypto from "node:crypto";

const API = "https://api.hitube.io";
const WEB = "https://www.hitube.io";
const PUBLIC_KEY =
  "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDCAdf/EyIbLBxjGqmh7qLU6/CPCzru+75+82OSPZ+nf4BFvg88drpZ6KigNW0J8TNgxe6Yms1irCZNVDyu+RXsl4y/7c2KOHc4OGTzHB5fUMiMasFUvcEs2P70e6yA/sKHZfBLG1XPhlb84Ibs3nhD3W5e2SuC+4EuVkaqzN08LQIDAQAB";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

function createSessionId() {
  const random = crypto.randomBytes(6).toString("base64url").slice(0, 10);
  return `hitube.io_${random}_${Date.now()}`;
}

function createSecureMessage() {
  const pem = `-----BEGIN PUBLIC KEY-----\n${PUBLIC_KEY.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;
  const publicKey = forge.pki.publicKeyFromPem(pem);
  const encrypted = publicKey.encrypt(Date.now().toString(), "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted);
}

function mediaUrl(token, sessionid) {
  return `${API}/st-tik-video/token/${encodeURIComponent(token)}?sessionid=${encodeURIComponent(sessionid)}&wh=www.hitube.io`;
}

function mapMedia(item, sessionid) {
  const data = {
    type: item.type || "file",
    url: item.url ? mediaUrl(item.url, sessionid) : null
  };

  if (item.tag) data.quality = item.tag;
  if (item.size) data.size = item.size;
  if (item.cover) data.cover = mediaUrl(item.cover, sessionid);
  if (item.thumb) data.thumbnail = mediaUrl(item.thumb, sessionid);

  return data;
}

/**
 * Download Facebook video/photo menggunakan hitube.io
 * @param {string} url - URL Facebook (post/reel/video)
 * @returns {Promise<{status: boolean, code: number, title?: string, username?: string, media: Array<{type: string, url: string, quality?: string, size?: string}>}>}
 */
export async function facebookDownloader(url) {
  const sessionid = createSessionId();

  try {
    const res = await axios.get(`${API}/st-tik-video/fb/dl`, {
      timeout: 60000,
      validateStatus: () => true,
      params: {
        url,
        sessionid
      },
      headers: {
        "x-secure-message": createSecureMessage(),
        accept: "application/json, text/plain, */*",
        origin: WEB,
        referer: `${WEB}/`,
        "user-agent": UA
      }
    });

    const data = res.data;

    if (res.status !== 200 || data?.code !== 200) {
      return {
        status: false,
        code: data?.code || res.status,
        media: []
      };
    }

    const list = Array.isArray(data?.result?.fbBos) ? data.result.fbBos : [];
    const media = list
      .map(item => mapMedia(item, sessionid))
      .filter(item => item.url);

    // Ambil judul/username jika ada
    const title = data?.result?.title || data?.result?.description || '';
    const username = data?.result?.author || '';

    return {
      status: media.length > 0,
      code: data.code,
      title,
      username,
      media
    };
  } catch (e) {
    return {
      status: false,
      code: e.response?.status || 500,
      media: []
    };
  }
}

export default facebookDownloader;
