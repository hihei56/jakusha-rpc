process.env.DISCORDJS_WVOICE = 'false';
const http = require('http');
const { Client } = require('discord.js-selfbot-v13');
const Groq = require('groq-sdk');
require('dotenv').config();

const APP_ID = '1447891267336802400';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TEST_CHANNEL_ID = '1476939503510884638';

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

const APP_NAMES = [
  '気軽に話せるサーバーを探しています',
  '一人で悩んでいませんか？',
  '雑談サーバーで話しませんか',
  '居場所を探しています',
  'のんびり話せる場所があります',
  '誰でも歓迎のサーバーです',
  'ゆるく話せるコミュニティ',
  '気軽に参加できるサーバー',
  '仲間を探しています',
  '一緒に話せる人を募集中',
];

const IMAGES = [
  '1457346793753804925',
  '1457346793041035337',
  '1457346796886954128'
];

const STATUSES = [
  { details: '気軽に話せる場所、あります', state: '↓ Discordサーバーに参加する' },
  { details: '一人で悩まないで、一緒に話そう', state: '↓ 参加はこちら' },
  { details: '居場所がない人、大歓迎です', state: '↓ サーバーに参加する' },
  { details: 'ゆるく雑談できるメンバー募集中', state: '↓ 気軽に参加してください' },
  { details: 'どんな悩みも話せるサーバーです', state: '↓ まずは覗いてみてください' },
  { details: '認証なし・ルール少なめの雑談サーバー', state: '↓ 参加してみませんか' },
];

const CHANNEL_IDS = process.env.CHANNEL_IDS.split(',').map(id => id.trim());
const PROMPT = process.env.POST_PROMPT;

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 投稿間隔を完全にランダム化（連投・通常・長時間休憩の3パターン）
function randomInterval() {
  const rand = Math.random();
  if (rand < 0.15) {
    // 15%の確率で「連投モード」（3〜10分）
    return (3 + Math.random() * 7) * 60 * 1000;
  } else if (rand < 0.85) {
    // 70%の確率で「通常モード」（40〜150分）
    return (40 + Math.random() * 110) * 60 * 1000;
  } else {
    // 15%の確率で「長時間休憩モード」（4〜8時間）
    return (240 + Math.random() * 240) * 60 * 1000;
  }
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
    const appName = randomFrom(APP_NAMES);
    const image = randomFrom(IMAGES);
    const status = randomFrom(STATUSES);
    const now = Date.now();
    const totalAnimeTime = 24 * 60 * 1000;
    const randomElapsed = Math.floor(Math.random() * 18 * 60 * 1000);

    client.ws.broadcast({
      op: 3,
      d: {
        since: null,
        afk: false,
        status: 'online',
        activities: [{
          name: appName,
          type: 3,
          application_id: APP_ID,
          details: status.details,
          state: status.state,
          assets: {
            large_image: image,
            small_image: '1457346948989321384',
            large_text: '烈核解放中'
          },
          timestamps: {
            start: now - randomElapsed,
            end: now - randomElapsed + totalAnimeTime
          },
          buttons: ['Discordサーバーに参加'],
          metadata: {
            button_urls: ['https://discord.gg/VwSpNkncWd']
          }
        }]
      }
    });

    console.log(`[RPC更新] ${appName} / ${status.details}`);
  } catch (err) {
    console.error('[RPC ERROR]', err);
  }
}

async function postMessage() {
  // 環境変数 ENABLE_POSTING でオンオフ設定
  if (process.env.ENABLE_POSTING !== 'true') {
    console.log('[SKIP] メッセージ送信は現在無効です (ENABLE_POSTING != true)');
    setTimeout(postMessage, 60 * 60 * 1000); // 1時間後に再チェック
    return;
  }

  try {
    const channelId = randomFrom(CHANNEL_IDS);
    const channel = await client.channels.fetch(channelId);
    
    // タイピング状態の演出
    await channel.sendTyping();
    const typingTime = (Math.random() * 7000) + 5000;
    
    const message = await generateWithRetry();
    await new Promise(r => setTimeout(r, typingTime));
    
    await channel.send(message);
    console.log(`[書き込み完了] ch:${channelId} 「${message}」`);
  } catch (err) {
    console.error('[POST ERROR]', err);
  } finally {
    const nextWait = randomInterval();
    console.log(`[次回の投稿まで] ${(nextWait / 60 / 1000).toFixed(1)}分待機します`);
    setTimeout(postMessage, nextWait);
  }
}

setInterval(updatePresence, 30000);

const PORT = process.env.PORT || 8080;
http.createServer((req, res) => res.end('Active')).listen(PORT);

client.once('ready', async () => {
  console.log(`[READY] ${client.user.tag}`);
  updatePresence();
  setTimeout(postMessage, 10000); // 起動10秒後に最初の投稿チェック
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
