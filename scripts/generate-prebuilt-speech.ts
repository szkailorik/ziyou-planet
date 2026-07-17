import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { CURRICULUM_CHARACTERS } from '../src/data/curriculum-characters';
import { PRIMARY_POEM_SPEECH } from '../src/data/primary-poem-speech';
import { PREBUILT_SPEECH_VERSION } from '../src/domain/prebuilt-speech';
import { buildQwenPayload, resolveSpeechInput } from '../functions/api/tts';

type Kind = 'characters' | 'poems' | 'all';
type SpeechTask = {
  label: string;
  output: string;
  request: { kind: 'character'; character: string } | { kind: 'poem'; slug: string };
};

const args = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
const outputRoot = join(root, 'public', 'audio', 'tts', PREBUILT_SPEECH_VERSION);
const kind = option('--kind', 'all') as Kind;
const concurrency = positiveNumber(option('--concurrency', '8'), '--concurrency');
const limitValue = option('--limit', '');
const limit = limitValue ? positiveNumber(limitValue, '--limit') : Number.POSITIVE_INFINITY;
const credentialsCsv = option('--credentials-csv', '');
const proxyUrl = option('--proxy-url', '');
const ffmpeg = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';

if (!['characters', 'poems', 'all'].includes(kind)) throw new Error('--kind 必须是 characters、poems 或 all');

const credentials = credentialsCsv ? await readCredentials(credentialsCsv) : {};
const apiKey = process.env.DASHSCOPE_API_KEY || credentials.apiKey;
const baseUrl = (process.env.DASHSCOPE_BASE_URL || credentials.baseUrl || 'https://dashscope.aliyuncs.com/api/v1').replace(/\/$/, '');

if (!proxyUrl && !apiKey) throw new Error('缺少 DASHSCOPE_API_KEY；也可以通过 --proxy-url 使用已配置的安全代理');
if (!proxyUrl && !/^https:\/\/[^/]*\.aliyuncs\.com(?:\/|$)/.test(baseUrl)) throw new Error('DASHSCOPE_BASE_URL 必须是 aliyuncs.com 的 HTTPS 地址');
if (proxyUrl && !/^https:\/\//.test(proxyUrl)) throw new Error('--proxy-url 必须是 HTTPS 地址');

const allTasks = buildTasks().slice(0, limit);
await mkdir(outputRoot, { recursive: true });
const pending: SpeechTask[] = [];
let skipped = 0;
for (const task of allTasks) {
  if (await isValidAudio(task.output)) skipped += 1;
  else pending.push(task);
}

console.log(`预生成语音：共 ${allTasks.length} 项，已有 ${skipped} 项，待生成 ${pending.length} 项，并发 ${concurrency}`);

let completed = 0;
let cursor = 0;
const failures: Array<{ label: string; message: string }> = [];
await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
  while (cursor < pending.length) {
    const task = pending[cursor++];
    try {
      await generateTask(task);
      completed += 1;
      if (completed === pending.length || completed % 25 === 0) {
        console.log(`进度 ${completed}/${pending.length}（总完成 ${skipped + completed}/${allTasks.length}）`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ label: task.label, message });
      console.error(`生成失败：${task.label}：${message}`);
    }
  }
}));

if (failures.length) {
  console.error(`本轮有 ${failures.length} 项失败；重新运行同一命令会自动断点续跑。`);
  process.exitCode = 1;
} else {
  if (kind === 'all' && !Number.isFinite(limit)) await writeManifest();
  console.log(`语音预生成完成：新增 ${completed} 项，复用 ${skipped} 项。`);
}

function buildTasks() {
  const tasks: SpeechTask[] = [];
  if (kind === 'characters' || kind === 'all') {
    Array.from(CURRICULUM_CHARACTERS).forEach((character, index) => tasks.push({
      label: `字 ${index + 1} “${character}”`,
      output: join(outputRoot, 'characters', `${index + 1}.mp3`),
      request: { kind: 'character', character }
    }));
  }
  if (kind === 'poems' || kind === 'all') {
    Object.keys(PRIMARY_POEM_SPEECH).forEach((slug) => tasks.push({
      label: `诗词 ${slug}`,
      output: join(outputRoot, 'poems', `${slug}.mp3`),
      request: { kind: 'poem', slug }
    }));
  }
  return tasks;
}

async function generateTask(task: SpeechTask) {
  await mkdir(dirname(task.output), { recursive: true });
  const speech = resolveSpeechInput(task.request);
  const payload = buildQwenPayload(speech);
  const wav = join(tmpdir(), `ziyou-tts-${randomUUID()}.wav`);
  const mp3 = join(tmpdir(), `ziyou-tts-${randomUUID()}.mp3`);
  try {
    const audio = await withRetry(async () => proxyUrl ? fetchFromProxy(task.request) : fetchFromDashScope(payload));
    await writeFile(wav, audio);
    await runFfmpeg(wav, mp3);
    if (!await isValidAudio(mp3)) throw new Error('压缩后的音频文件无效');
    await rename(mp3, task.output);
  } finally {
    await Promise.all([rm(wav, { force: true }), rm(mp3, { force: true })]);
  }
}

async function fetchFromProxy(request: SpeechTask['request']) {
  const response = await fetchWithTimeout(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  }, 120_000);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`语音代理 ${response.status}: ${detail.slice(0, 160) || '没有返回音频'}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchFromDashScope(payload: ReturnType<typeof buildQwenPayload>) {
      const response = await fetchWithTimeout(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey!}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 90_000);
      const responseText = await response.text();
      if (!responseText) throw new Error(`Qwen3-TTS ${response.status}: 返回内容为空`);
      let result: { message?: string; output?: { audio?: { url?: string } } };
      try {
        result = JSON.parse(responseText) as typeof result;
      } catch {
        throw new Error(`Qwen3-TTS ${response.status}: 返回内容不是 JSON`);
      }
      if (!response.ok || !result.output?.audio?.url) throw new Error(`Qwen3-TTS ${response.status}: ${result.message || '没有返回音频'}`);
      const audioResponse = await fetchWithTimeout(result.output.audio.url, {}, 45_000);
      if (!audioResponse.ok) throw new Error(`下载音频失败 ${audioResponse.status}`);
      return Buffer.from(await audioResponse.arrayBuffer());
}

async function runFfmpeg(input: string, output: string) {
  await new Promise<void>((accept, reject) => {
    const child = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '48k', output], { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', (chunk) => { errorText += String(chunk); });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? accept() : reject(new Error(`ffmpeg 退出码 ${code}: ${errorText.trim()}`)));
  });
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((accept) => setTimeout(accept, Math.min(12_000, 750 * 2 ** attempt) + Math.random() * 500));
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isValidAudio(path: string) {
  try {
    return (await stat(path)).size >= 1_000;
  } catch {
    return false;
  }
}

async function readCredentials(path: string) {
  const raw = await readFile(resolve(path), 'utf8');
  const values = raw.split(/[\r\n,;]/).map((value) => value.replace(/^\s*["']|["']\s*$/g, '').trim());
  const apiKey = values.find((value) => value.startsWith('sk-') && value.length >= 16);
  const baseUrl = values.find((value) => /^https:\/\/[^/]*\.aliyuncs\.com(?:\/.*)?$/.test(value));
  return { apiKey, baseUrl };
}

async function writeManifest() {
  const manifest = {
    version: PREBUILT_SPEECH_VERSION,
    engine: 'qwen3-tts-instruct-flash',
    voice: 'Cherry',
    format: { codec: 'mp3', bitrateKbps: 48, sampleRateHz: 24_000, channels: 1 },
    characters: Array.from(CURRICULUM_CHARACTERS).length,
    poems: Object.keys(PRIMARY_POEM_SPEECH).length
  };
  await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function option(name: string, fallback: string) {
  const inline = args.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] ?? '') : fallback;
}

function positiveNumber(value: string, name: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${name} 必须是正整数`);
  return number;
}
