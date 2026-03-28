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
  ws: {
    properties: {
      $os: 'Windows',
      $browser: 'Discord Client',
      $device: 'Discord Client'
    }
  }
});

const APP_NAMES = [
  '邂逅と邂逅のあいだ',
  '遂巡の残像',
  '存在の余白に棲む',
  '帰還できない夜明け前',
  '誰かの概念になりたかった',
  '輪郭だけが残っている',
  '静止した時間の縫い目',
  '午前三時の主体性',
  '忘れられた座標にいる',
  '漂流する固有名詞',
];

const IMAGES = [
  '1457346793753804925',
  '1457346793041035337',
  '1457346796886954128'
];

const STATUSES = [
  { details: '弱者男性、募集中。', state: '∈存在の再分配区域' },
  { details: '弱者男性のための余白、あります', state: '∈主体なき者たちの集会所' },
  { details: '孤独の総量が多い人、来てください', state: '∈Ressentimentt / ∈State space' },
  { details: '弱者男性サーバー、絶賛漂流中', state: '∈帰る場所を失った者の座標' },
  { details: '君の弱さに名前をつけたい', state: '∈輪郭のない共同体' },
  { details: '弱者男性という概念に参加する', state: '∈遂巡と邂逅のあいだ' },
];

const CHANNEL_IDS = process.env.CHANNEL_IDS.split(',').map(id => id.trim());
const PROMPT = process.env.POST_PROMPT;

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInterval() {
  return (30 + Math.random() * 30) * 60 * 1000;
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
        console.error(`[GROQ FATAL] リトライ上限に達しました`);
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
  try {
    const channelId = randomFrom(CHANNEL_IDS);
    const channel = await client.channels.fetch(channelId);
    const message = await generateWithRetry();
    await channel.send(message);
    console.log(`[書き込み完了] ch:${channelId} 「${message}」`);
  } catch (err) {
    console.error('[POST ERROR]', err);
  } finally {
    setTimeout(postMessage, randomInterval());
  }
}

setInterval(updatePresence, 30000);

const PORT = process.env.PORT || 8080;
http.createServer((req, res) => res.end('Active')).listen(PORT);

client.once('ready', async () => {
  console.log(`[READY] ${client.user.tag}`);
  updatePresence();

  try {
    const channel = await client.channels.fetch(TEST_CHANNEL_ID);
    const message = await generateWithRetry();
    await channel.send(message);
    console.log(`[テスト送信完了] 「${message}」`);
  } catch (err) {
    console.error('[テスト送信エラー]', err);
  }

  setTimeout(postMessage, randomInterval());
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);