process.env.DISCORDJS_WVOICE = 'false';
const http = require('http');
const { Client } = require('discord.js-selfbot-v13');
const Groq = require('groq-sdk');
require('dotenv').config();

const APP_ID = '1375082813384032286';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const client = new Client({
  checkUpdate: false,
  syncStatus: true,
  patchVoice: true,
  ws: {
    properties: {
      $os: 'Windows',
      $browser: 'Discord Client',
      $device: 'Discord Client'
    }
  }
});

const IMAGES = ['1501114018075770901'];
const PROMPT = process.env.POST_PROMPT;

// 投稿先チャンネルを固定（.env に TARGET_CHANNEL_ID を設定）
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
if (!TARGET_CHANNEL_ID) {
  console.warn('[WARN] TARGET_CHANNEL_ID が未設定です。CHANNEL_IDSの先頭を使います。');
}

// 深夜帯（0〜6時）はスキップ
function isLateNight() {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 6;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 投稿間隔：30分 ± 5分
function randomInterval() {
  const base = 30 * 60 * 1000;
  const variance = (Math.random() * 10 - 5) * 60 * 1000;
  return base + variance;
}

async function generateWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[GROQ] 生成開始 (試行${i + 1}/${retries})`);
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: PROMPT }],
        max_tokens: 100,
      });
      const text = completion.choices[0].message.content.trim();
      console.log(`[GROQ] 生成成功: 「${text}」`);
      return text;
    } catch (err) {
      console.error(`[GROQ ERROR] status:${err.status} message:${err.message}`);
      if (err.status === 429 && i < retries - 1) {
        const wait = 20000 * (i + 1);
        console.log(`[RETRY] ${i + 1}回目 ${wait / 1000}秒後に再試行...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

async function updatePresence() {
  try {
    client.ws.broadcast({
      op: 3,
      d: {
        since: null,
        afk: false,
        status: 'online',
        activities: [{
          name: 'タップでプロフィールが表示👈',
          type: 0,
          application_id: APP_ID,
          assets: {
            large_image: randomFrom(IMAGES),
            large_text: '眠たい'
          },
          timestamps: { start: 1 },
          party: {
            id: 'nemutai',
            size: [384838486, 384838488]
          },
          buttons: ['サーバーに参加'],
          metadata: {
            button_urls: ['https://discord.gg/VnSpuRCh7H']
          }
        }]
      }
    });
    console.log('[RPC更新] 完了');
  } catch (err) {
    console.error('[RPC ERROR]', err);
  }
}

async function postMessage() {
  // 深夜帯はスキップ
  if (isLateNight()) {
    console.log('[SKIP] 深夜帯のため休止中 (0:00〜5:59)');
    setTimeout(postMessage, 60 * 60 * 1000);
    return;
  }

  if (process.env.ENABLE_POSTING !== 'true') {
    console.log('[SKIP] メッセージ送信は無効');
    setTimeout(postMessage, randomInterval());
    return;
  }

  try {
    let channelId = TARGET_CHANNEL_ID;
    if (!channelId) {
      const fallbackIds = process.env.CHANNEL_IDS?.split(',').map(id => id.trim()) || [];
      channelId = fallbackIds[0];
      if (!channelId) throw new Error('有効なチャンネルIDがありません');
    }

    const channel = await client.channels.fetch(channelId);
    
    // ★★★ タイピング表示を完全に削除 ★★★
    // sendTyping() も待機時間も一切なし → AI生成が終わり次第即送信
    const message = await generateWithRetry();
    await channel.send(message);
    console.log(`[書き込み完了] ch:${channelId} 「${message}」`);
  } catch (err) {
    console.error('[POST ERROR]', err);
  } finally {
    const wait = randomInterval();
    console.log(`[次回まで] ${(wait / 60000).toFixed(1)}分`);
    setTimeout(postMessage, wait);
  }
}

// RPC更新（30秒ごと）
setInterval(updatePresence, 30000);

// HTTPスリープ防止サーバー
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => res.end('Active')).listen(PORT);

client.once('ready', async () => {
  console.log(`[READY] ${client.user.tag}`);
  updatePresence();
  setTimeout(postMessage, randomInterval());
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
