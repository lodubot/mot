# 🤖 Auto Downloader Bot

Telegram bot that automatically detects and downloads media from **YouTube**, **Instagram**, and **Facebook**.

## ✨ Features

- 🔍 **Auto-detect** - Just paste a link, bot downloads automatically!
- 📹 **YouTube** - Videos (MP4) & Audio (MP3)
- 📸 **Instagram** - Posts, Reels, Stories, Carousels
- 📘 **Facebook** - Videos & Photos
- ⚡ **Fast** - Multiple download engines with fallback
- 🛡️ **Cooldown** - Anti-spam protection
- 📱 **Reply Support** - Reply to any message with link

## 🚀 Setup

### 1. Get Bot Token
- Go to [@BotFather](https://t.me/BotFather) on Telegram
- Create a new bot and copy the token

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure
```bash
cp .env.example .env
# Edit .env and add your BOT_TOKEN
```

### 4. Run
```bash
npm start
```

## 📖 Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Start the bot | `/start` |
| `/help` | Show help | `/help` |
| `/yt <url> [mp3/mp4]` | Download YouTube | `/yt https://youtu.be/xxxxx mp3` |
| `/ig <url>` | Download Instagram | `/ig https://instagram.com/p/xxxxx` |
| `/fb <url>` | Download Facebook | `/fb https://facebook.com/xxxxx` |

## 🔗 Auto Detection

Just send any supported link in chat:
```
https://youtu.be/dQw4w9WgXcQ
https://www.instagram.com/p/ABC123/
https://www.facebook.com/watch?v=123456
```

The bot will automatically detect and download!

## 📁 Project Structure

```
auto-downloader-bot/
├── index.js              # Main bot entry
├── config.js             # Bot configuration
├── package.json          # Dependencies
├── .env                  # Environment variables
├── src/
│   ├── bot/
│   │   └── commands.js   # Command handlers
│   ├── scrape/
│   │   ├── youtube.js    # YouTube downloader
│   │   ├── instagram.js  # Instagram downloader
│   │   └── facebook.js   # Facebook downloader
│   └── utils/
│       └── helpers.js    # Utility functions
└── README.md
```

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | ✅ Yes | Telegram bot token from @BotFather |
| `CF_CLEARANCE` | ❌ No | Cloudflare clearance cookie for y2mate |
| `OWNER_USERNAME` | ❌ No | Bot owner username |
| `SUPPORT_CHANNEL` | ❌ No | Support channel/group |

## 🛠️ Tech Stack

- [Telegraf](https://telegraf.js.org/) - Telegram Bot Framework
- [Axios](https://axios-http.com/) - HTTP Client
- [Cheerio](https://cheerio.js.org/) - Server-side jQuery
- [node-forge](https://github.com/digitalbazaar/forge) - Crypto utilities

## 📝 Credits

- Made with ❤️ by [@MOTU_PATALU_HINDU_HAI](https://t.me/MOTU_PATALU_HINDU_HAI)
- Support: [@Hx5x5x5x](https://t.me/Hx5x5x5x)

## 📄 License

MIT License - Feel free to use and modify!
