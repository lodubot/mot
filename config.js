// Bot Configuration
// Token directly yahan add karo (no .env needed)

export const config = {
  // ⬇️ APNI BOT TOKEN YAHAN PASTE KARO ⬇️
  botToken: "8993593935:AAGwkSpz6g8VWeJAdj4ZSW1NaJGJYwVwsbQ",

  // ⬇️ MTProto API Credentials (my.telegram.org se milega) ⬇️
  // 2GB files bhejne ke liye REQUIRED hai
  apiId: "25461006",           // Telegram API ID
  apiHash: "be4d9b5dc42758bccb2087b071738359",  // Telegram API Hash

  owner: "@MOTU_PATALU_HINDU_HAI",
  support: "@Hx5x5x5x",

  // Auto-detect settings
  autoDownload: true,
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB MTProto limit

  // Cooldown (seconds)
  cooldown: 10,

  // Supported platforms
  platforms: {
    youtube: {
      patterns: [
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
        /youtube\.com\/shorts\/([^"&?\/\s]+)/i
      ],
      name: 'YouTube'
    },
    instagram: {
      patterns: [
        /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/[^\s]+/i,
        /https?:\/\/(www\.)?instagram\.com\/[^\s]+/i
      ],
      name: 'Instagram'
    },
    facebook: {
      patterns: [
        /https?:\/\/(www\.)?(facebook|fb)\.watch\/[^\s]+/i,
        /https?:\/\/(www\.)?facebook\.com\/[^\s]+/i,
        /https?:\/\/fb\.me\/[^\s]+/i
      ],
      name: 'Facebook'
    }
  }
};

export default config;
