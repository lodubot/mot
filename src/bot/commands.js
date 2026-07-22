// Bot Commands Handler
import { config } from '../../config.js';
import { youtubeDownloader } from '../scrape/youtube.js';
import { instagramDownloader } from '../scrape/instagram.js';
import { instagramSnapInsta } from '../scrape/instagram-snapinsta.js';
import { instagramAudio } from '../scrape/instagram-audio.js';
import { facebookDownloader } from '../scrape/facebook.js';
import { downloadBuffer, escapeMarkdown, truncate, detectPlatform } from '../utils/helpers.js';
import { initGramJS, sendLargeFile, sendLargeBuffer, checkFileSize } from '../utils/telegram-client.js';
import axios from 'axios';

const cooldownMap = new Map();
let gramjsReady = false;

// Initialize GramJS on startup
async function ensureGramJS() {
  if (gramjsReady) return true;
  if (!config.apiId || config.apiId === "25461006") return false;
  try {
    await initGramJS(config.apiId, config.apiHash);
    gramjsReady = true;
    return true;
  } catch (e) {
    console.error('[GramJS Init]', e.message);
    return false;
  }
}

function isOnCooldown(userId) {
  const last = cooldownMap.get(userId);
  if (!last) return false;
  return (Date.now() - last) < (config.cooldown * 1000);
}

function setCooldown(userId) {
  cooldownMap.set(userId, Date.now());
}

// Detect file type from buffer
function detectFileType(buffer) {
  if (!buffer || buffer.length < 8) return 'unknown';
  const hex = buffer.toString('hex', 0, 8).toLowerCase();
  if (hex.startsWith('00000018') || hex.startsWith('0000001c')) return 'video';
  if (hex.startsWith('1a45dfa3')) return 'video';
  if (hex.startsWith('52494646')) return 'video';
  if (hex.startsWith('ffd8ff')) return 'image';
  if (hex.startsWith('89504e47')) return 'image';
  if (hex.startsWith('47494638')) return 'image';
  if (hex.startsWith('494433') || hex.startsWith('fffb')) return 'audio';
  const str = buffer.toString('ascii', 4, 8);
  if (str === 'ftyp') return 'video';
  return 'unknown';
}

// Smart send - uses Bot API for small files, GramJS for large files
async function smartSend(ctx, url, caption, type = 'video') {
  try {
    // Check file size
    const { size, isLarge } = await checkFileSize(url);
    console.log(`[SmartSend] Size: ${size} bytes, Large: ${isLarge}`);

    // Small file (<50MB) - use Bot API (faster)
    if (!isLarge) {
      try {
        if (type === 'video') await ctx.replyWithVideo(url, { caption, supports_streaming: true });
        else if (type === 'image') await ctx.replyWithPhoto(url, { caption });
        else if (type === 'audio') await ctx.replyWithAudio(url, { caption, title: caption });
        else await ctx.replyWithDocument(url, { caption });
        return true;
      } catch (e) {
        console.log('[Bot API] Failed, trying GramJS...');
      }
    }

    // Large file or Bot API failed - use GramJS (up to 2GB)
    if (gramjsReady || await ensureGramJS()) {
      const chatId = ctx.chat.id;
      await sendLargeFile(chatId, url, { caption });
      return true;
    }

    // Fallback: send link if GramJS not available
    await ctx.reply(`📎 *File too large for Bot API*\n🔗 *Download Link:* ${url}\n\n_Size: ${(size / 1024 / 1024).toFixed(2)} MB_`, { parse_mode: 'Markdown' });
    return true;

  } catch (e) {
    console.error('[SmartSend]', e.message);
    // Last resort: send link
    await ctx.reply(`📎 *Download Link:* ${url}`, { parse_mode: 'Markdown' }).catch(() => {});
    return false;
  }
}

// Smart buffer send
async function smartSendBuffer(ctx, buffer, caption, type = 'video', filename = 'file.mp4') {
  try {
    const size = buffer.length;
    const isLarge = size > 50 * 1024 * 1024;

    if (!isLarge) {
      try {
        if (type === 'video') await ctx.replyWithVideo({ source: buffer }, { caption, supports_streaming: true });
        else if (type === 'image') await ctx.replyWithPhoto({ source: buffer }, { caption });
        else if (type === 'audio') await ctx.replyWithAudio({ source: buffer }, { caption, title: caption });
        else await ctx.replyWithDocument({ source: buffer }, { caption });
        return true;
      } catch (e) {
        console.log('[Bot API Buffer] Failed, trying GramJS...');
      }
    }

    if (gramjsReady || await ensureGramJS()) {
      const chatId = ctx.chat.id;
      await sendLargeBuffer(chatId, buffer, filename, { caption });
      return true;
    }

    return false;
  } catch (e) {
    console.error('[SmartSendBuffer]', e.message);
    return false;
  }
}

function getQualityButtons(url) {
  const qualities = ['1080p', '720p', '480p', '360p', '240p', '144p'];
  const buttons = qualities.map(q => ({ text: `📹 ${q}`, callback_data: `yt_${q}_${url}` }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  rows.push([{ text: '🎵 Download MP3', callback_data: `mp3_${url}` }]);
  return rows;
}

export async function startCommand(ctx) {
  try {
    const name = ctx.from.first_name || 'User';
    await ctx.reply(`🎉 *Welcome ${escapeMarkdown(name)}!*\n\n📹 *YouTube* - Choose quality: 1080p to 144p\n📸 *Instagram* - Posts, Reels, Stories + MP3\n📘 *Facebook* - Videos & Photos\n\n*Commands:*\n/yt <url> - YouTube quality selection\n/ig <url> - Instagram HD download\n/igmp3 <url> - Instagram Reels Audio\n/fb <url> - Facebook download\n\n_Made with ❤️ by ${escapeMarkdown(config.owner)}_`, { parse_mode: 'Markdown' });
  } catch (err) { await ctx.reply('Welcome! Send me any link to download.').catch(() => {}); }
}

export async function helpCommand(ctx) {
  try {
    await ctx.reply(`📖 *Bot Help*\n\n*Commands:*\n/yt <url> - YouTube with quality buttons\n/ig <url> - Instagram HD (SnapInsta)\n/igmp3 <url> - Instagram Reels Audio/MP3\n/fb <url> - Facebook downloader\n\n*Auto Detect:* Just paste any supported link!\n\n*Support:* ${escapeMarkdown(config.support)}`, { parse_mode: 'Markdown' });
  } catch (err) { await ctx.reply('Send any link to download!').catch(() => {}); }
}

export async function youtubeCommand(ctx) {
  const userId = ctx.from.id;
  if (isOnCooldown(userId)) return ctx.reply('⏳ Please wait.').catch(() => {});
  const args = ctx.message.text.split(' ').slice(1);
  let url = args[0];
  if (!url && ctx.message.reply_to_message) {
    const quotedText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
    const match = quotedText?.match(/(https?:\/\/\S+)/);
    if (match) url = match[1];
  }
  if (!url) return ctx.reply('❌ Please provide a YouTube URL.\nExample: `/yt https://youtu.be/xxxxx`', { parse_mode: 'Markdown' }).catch(() => {});
  if (!/(youtube\.com|youtu\.be)/i.test(url)) return ctx.reply('❌ Invalid YouTube URL.').catch(() => {});
  setCooldown(userId);
  try {
    await ctx.reply('📺 *YouTube Video Detected!*\nChoose your quality:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: getQualityButtons(url) } });
  } catch (err) { await ctx.reply('❌ Error showing quality options.').catch(() => {}); }
}

export async function youtubeQualityCallback(ctx) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('yt_')) return;
  const match = data.match(/^yt_(\d+p)_(.+)$/);
  if (!match) return;
  const quality = match[1], url = match[2], userId = ctx.from.id;
  if (isOnCooldown(userId)) return ctx.answerCbQuery('⏳ Please wait...').catch(() => {});
  setCooldown(userId);
  try {
    await ctx.answerCbQuery(`📹 Downloading ${quality}...`);
    const msg = await ctx.reply(`⏳ Downloading ${quality}...`);
    const result = await youtubeDownloader(url, 'mp4', quality);
    if (!result.status) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed: ${result.error || 'Unknown error'}`).catch(() => {});
      return;
    }
    const caption = `🎵 *${escapeMarkdown(truncate(result.title, 50))}*\n📦 Size: ${result.size || 'Unknown'}\n🎬 Quality: ${result.quality || quality}`;

    const sent = await smartSend(ctx, result.url, caption, 'video');

    if (sent) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed to send.`).catch(() => {});
  } catch (err) { await ctx.reply(`❌ Error: ${err.message}`).catch(() => {}); }
}

export async function mp3CallbackHandler(ctx) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('mp3_')) return;
  const url = data.replace('mp3_', '');
  const userId = ctx.from.id;
  if (isOnCooldown(userId)) return ctx.answerCbQuery('⏳ Please wait...').catch(() => {});
  setCooldown(userId);
  try {
    await ctx.answerCbQuery('🎵 Downloading MP3...');
    const msg = await ctx.reply('⏳ Converting to MP3...');
    const result = await youtubeDownloader(url, 'mp3', '128kbps');
    if (!result.status) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ MP3 Failed: ${result.error || 'Unknown'}`).catch(() => {});
      return;
    }
    const caption = `🎵 *${escapeMarkdown(truncate(result.title, 50))}*\n📦 Size: ${result.size || 'Unknown'}\n🎬 Quality: ${result.quality || '128kbps'}`;

    const sent = await smartSend(ctx, result.url, caption, 'audio');

    if (sent) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed.`).catch(() => {});
  } catch (err) { await ctx.reply(`❌ Error: ${err.message}`).catch(() => {}); }
}

export async function instagramCommand(ctx) {
  const userId = ctx.from.id;
  if (isOnCooldown(userId)) return ctx.reply('⏳ Please wait.').catch(() => {});
  const args = ctx.message.text.split(' ').slice(1);
  let url = args[0];
  if (!url && ctx.message.reply_to_message) {
    const quotedText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
    const match = quotedText?.match(/(https?:\/\/\S+)/);
    if (match) url = match[1];
  }
  if (!url) return ctx.reply('❌ Please provide an Instagram URL.\nExample: `/ig https://instagram.com/p/xxxxx`', { parse_mode: 'Markdown' }).catch(() => {});
  if (!/instagram\.com/i.test(url)) return ctx.reply('❌ Invalid Instagram URL.').catch(() => {});
  setCooldown(userId);
  let msg;
  try { msg = await ctx.reply('⏳ Downloading Instagram...'); } catch (e) { return; }
  try {
    let result = await instagramSnapInsta(url);
    if (!result.media.length) result = await instagramDownloader(url);
    if (!result || !result.media || result.media.length === 0) {
      return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ No media found.').catch(() => {});
    }

    const isReel = url.includes('/reel/');
    const isStory = url.includes('/stories/');
    const caption = `📸 *Instagram ${isStory ? 'Story' : isReel ? 'Reel' : 'Post'}*\n👤 User: ${escapeMarkdown(result.username || 'Unknown')}`;

    let sentCount = 0;
    for (const item of result.media) {
      const itemUrl = item.url;
      if (!itemUrl) continue;

      const sendType = isReel ? 'video' : (item.type === 'video' ? 'video' : 'image');
      const sent = await smartSend(ctx, itemUrl, caption, sendType);

      if (sent) sentCount++;
      await new Promise(r => setTimeout(r, 800));
    }

    if (isReel && sentCount > 0) {
      try { await ctx.reply('🎵 Want the audio?', { reply_markup: { inline_keyboard: [[{ text: '🎵 Download Reels Audio', callback_data: `igmp3_${url}` }]] } }); } catch (e) {}
    }

    if (sentCount > 0) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ Failed to send media.').catch(() => {});

  } catch (err) {
    console.error('[IG CMD]', err);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Error: ${err.message}`).catch(() => {});
  }
}

export async function instagramMp3Command(ctx) {
  const userId = ctx.from.id;
  if (isOnCooldown(userId)) return ctx.reply('⏳ Please wait.').catch(() => {});
  const args = ctx.message.text.split(' ').slice(1);
  let url = args[0];
  if (!url && ctx.message.reply_to_message) {
    const quotedText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
    const match = quotedText?.match(/(https?:\/\/\S+)/);
    if (match) url = match[1];
  }
  if (!url) return ctx.reply('❌ Please provide an Instagram Reel URL.\nExample: `/igmp3 https://instagram.com/reel/xxxxx`', { parse_mode: 'Markdown' }).catch(() => {});
  if (!/instagram\.com/i.test(url)) return ctx.reply('❌ Invalid Instagram URL.').catch(() => {});
  setCooldown(userId);
  let msg;
  try { msg = await ctx.reply('⏳ Extracting audio...'); } catch (e) { return; }
  try {
    const result = await instagramAudio(url);
    if (!result.status) {
      return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed: ${result.error || 'Audio not available'}`).catch(() => {});
    }
    const caption = `🎵 *Instagram Reels Audio*`;
    const sent = await smartSend(ctx, result.url, caption, 'audio');
    if (sent) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed.`).catch(() => {});
  } catch (err) {
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Error: ${err.message}`).catch(() => {});
  }
}

export async function igMp3CallbackHandler(ctx) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('igmp3_')) return;
  const url = data.replace('igmp3_', '');
  const userId = ctx.from.id;
  if (isOnCooldown(userId)) return ctx.answerCbQuery('⏳ Please wait...').catch(() => {});
  setCooldown(userId);
  try {
    await ctx.answerCbQuery('🎵 Downloading Reels Audio...');
    const msg = await ctx.reply('⏳ Extracting audio...');
    const result = await instagramAudio(url);
    if (!result.status) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed: ${result.error || 'Audio not available'}`).catch(() => {});
      return;
    }
    const caption = `🎵 *Instagram Reels Audio*`;
    const sent = await smartSend(ctx, result.url, caption, 'audio');
    if (sent) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed.`).catch(() => {});
  } catch (err) { await ctx.reply(`❌ Error: ${err.message}`).catch(() => {}); }
}

export async function facebookCommand(ctx) {
  const userId = ctx.from.id;
  if (isOnCooldown(userId)) return ctx.reply('⏳ Please wait.').catch(() => {});
  const args = ctx.message.text.split(' ').slice(1);
  let url = args[0];
  if (!url && ctx.message.reply_to_message) {
    const quotedText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
    const match = quotedText?.match(/(https?:\/\/\S+)/);
    if (match) url = match[1];
  }
  if (!url) return ctx.reply('❌ Please provide a Facebook URL.\nExample: `/fb https://facebook.com/xxxxx`', { parse_mode: 'Markdown' }).catch(() => {});
  if (!/(facebook|fb\.watch|fb\.me)/i.test(url)) return ctx.reply('❌ Invalid Facebook URL.').catch(() => {});
  setCooldown(userId);
  let msg;
  try { msg = await ctx.reply('⏳ Processing Facebook...'); } catch (e) { return; }
  try {
    const result = await facebookDownloader(url);
    if (!result.status || !result.media || result.media.length === 0) {
      return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed (Code: ${result.code})`).catch(() => {});
    }
    const caption = `📘 *Facebook*\n📝 ${escapeMarkdown(truncate(result.title, 50))}\n👤 ${escapeMarkdown(result.username || 'Unknown')}`;
    let sentCount = 0;
    for (const item of result.media) {
      const itemUrl = item.url;
      if (!itemUrl) continue;
      const isVideo = /\.(mp4|mov|webm)/i.test(itemUrl) || item.quality;
      const sendType = isVideo ? 'video' : 'image';
      const sent = await smartSend(ctx, itemUrl, caption, sendType);
      if (sent) sentCount++;
      await new Promise(r => setTimeout(r, 500));
    }
    if (sentCount > 0) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ Failed to send.').catch(() => {});
  } catch (err) {
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Error: ${err.message}`).catch(() => {});
  }
}

export async function autoDetectHandler(ctx) {
  const text = ctx.message.text || ctx.message.caption;
  if (!text) return;
  const url = text.match(/(https?:\/\/[^\s]+)/i)?.[1];
  if (!url) return;
  const platform = detectPlatform(url);
  if (!platform) return;
  const userId = ctx.from.id;
  if (isOnCooldown(userId)) return;
  setCooldown(userId);
  try {
    if (platform === 'youtube') {
      await ctx.reply('📺 *YouTube Video Detected!*\nChoose your quality:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: getQualityButtons(url) } });
    } else if (platform === 'instagram') {
      const isReel = url.includes('/reel/');
      const msg = await ctx.reply('⏳ Downloading Instagram...');
      let result = await instagramSnapInsta(url);
      if (!result.media.length) result = await instagramDownloader(url);
      if (result?.media?.length > 0) {
        const caption = `📸 *Instagram*\n👤 ${escapeMarkdown(result.username || 'Unknown')}`;
        let sentCount = 0;
        for (const item of result.media) {
          const itemUrl = item.url;
          if (!itemUrl) continue;
          const sendType = isReel ? 'video' : (item.type === 'video' ? 'video' : 'image');
          const sent = await smartSend(ctx, itemUrl, caption, sendType);
          if (sent) sentCount++;
          await new Promise(r => setTimeout(r, 800));
        }
        if (isReel && sentCount > 0) {
          try { await ctx.reply('🎵 Want the audio?', { reply_markup: { inline_keyboard: [[{ text: '🎵 Download Reels Audio', callback_data: `igmp3_${url}` }]] } }); } catch (e) {}
        }
        if (sentCount > 0) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
        else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ Failed.').catch(() => {});
      } else {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ No media found.').catch(() => {});
      }
    } else if (platform === 'facebook') {
      const msg = await ctx.reply('⏳ Downloading Facebook...');
      const result = await facebookDownloader(url);
      if (result.status && result.media.length > 0) {
        const caption = `📘 *Facebook*\n📝 ${escapeMarkdown(truncate(result.title, 50))}`;
        let sentCount = 0;
        for (const item of result.media) {
          const itemUrl = item.url;
          if (!itemUrl) continue;
          const isVideo = /\.(mp4|mov|webm)/i.test(itemUrl) || item.quality;
          const sendType = isVideo ? 'video' : 'image';
          const sent = await smartSend(ctx, itemUrl, caption, sendType);
          if (sent) sentCount++;
          await new Promise(r => setTimeout(r, 500));
        }
        if (sentCount > 0) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
        else await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ Failed.').catch(() => {});
      } else {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ Failed.').catch(() => {});
      }
    }
  } catch (err) { await ctx.reply(`❌ Error: ${err.message}`).catch(() => {}); }
}
