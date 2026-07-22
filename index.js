// Auto Downloader Bot - Main Entry (with MTProto 2GB support)
import { Telegraf } from 'telegraf';
import { config } from './config.js';
import { initGramJS } from './src/utils/telegram-client.js';
import {
  startCommand,
  helpCommand,
  youtubeCommand,
  instagramCommand,
  instagramMp3Command,
  facebookCommand,
  autoDetectHandler,
  youtubeQualityCallback,
  mp3CallbackHandler,
  igMp3CallbackHandler
} from './src/bot/commands.js';

// Validate config
if (!config.botToken || config.botToken === "7523456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
  console.error('❌ ERROR: Please add your BOT_TOKEN in config.js!');
  console.error('   Line 5 pe apna token paste karo');
  console.error('   Token @BotFather se milega');
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(config.botToken);

// ====== MIDDLEWARE ======
bot.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
  } catch (err) {
    console.error('Bot Error:', err);
    try {
      await ctx.reply('❌ An error occurred. Please try again later.');
    } catch {}
  }
  console.log(`[${new Date().toISOString()}] ${ctx.from?.username || ctx.from?.id}: ${ctx.updateType} - ${Date.now() - start}ms`);
});

// ====== COMMANDS ======
bot.command('start', startCommand);
bot.command('help', helpCommand);

// YouTube commands
bot.command(['yt', 'youtube', 'ytdl', 'ytmp3', 'ytmp4'], youtubeCommand);

// Instagram commands
bot.command(['ig', 'instagram', 'insta', 'igdl'], instagramCommand);
bot.command(['igmp3', 'igaudio', 'reelsaudio'], instagramMp3Command);

// Facebook commands
bot.command(['fb', 'facebook', 'fbdl'], facebookCommand);

// ====== CALLBACK QUERIES ======
bot.on('callback_query', async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith('yt_')) return youtubeQualityCallback(ctx);
  if (data.startsWith('mp3_')) return mp3CallbackHandler(ctx);
  if (data.startsWith('igmp3_')) return igMp3CallbackHandler(ctx);
  return next();
});

// ====== AUTO DETECT ======
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return next();
  const hasUrl = /https?:\/\//i.test(text);
  const hasPlatform = /(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|fb\.me)/i.test(text);
  if (hasUrl && hasPlatform) return autoDetectHandler(ctx);
  return next();
});

// ====== LAUNCH ======
console.log('🚀 Auto Downloader Bot Starting...');
console.log('📺 YouTube (1080p-144p) | 📸 Instagram HD + MP3 | 📘 Facebook');
console.log(`👤 Owner: ${config.owner}`);
console.log(`📢 Support: ${config.support}`);

// Initialize GramJS MTProto client (for 2GB files)
if (config.apiId && config.apiId !== "12345678") {
  console.log('🔌 Initializing GramJS MTProto client...');
  initGramJS(config.apiId, config.apiHash)
    .then(() => console.log('✅ GramJS ready for 2GB files!'))
    .catch(err => console.log('⚠️ GramJS init failed (2GB not available):', err.message));
} else {
  console.log('⚠️ MTProto API credentials not set. Limited to 50MB (Bot API only).');
  console.log('   Get API ID & Hash from https://my.telegram.org');
}

bot.launch()
  .then(() => console.log('✅ Bot is running!'))
  .catch(err => {
    console.error('❌ Failed to start bot:', err.message);
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
