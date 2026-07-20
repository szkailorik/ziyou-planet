import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CHARACTERS } from '../src/data/enrichment';
import { placementSampleIds } from '../src/domain/placement';

type GeneratedTeaching = {
  meaning: string;
  words: string[];
  example: string;
  englishBridges: Array<{ zh: string; en: string }>;
};

const args = process.argv.slice(2);
const credentialsPath = option('--credentials-csv', '');
const outputPath = resolve(option('--output', 'src/data/generated-teaching.json'));
const model = option('--model', 'qwen3.7-plus');
const limit = positiveNumber(option('--limit', '360'), '--limit');
const batchSize = positiveNumber(option('--batch-size', '30'), '--batch-size');
const credentials: { apiKey?: string; workspaceOrigin?: string } = credentialsPath ? await readCredentials(credentialsPath) : {};
const apiKey = process.env.DASHSCOPE_API_KEY || credentials.apiKey;
const configuredBaseUrl = process.env.DASHSCOPE_BASE_URL || credentials.workspaceOrigin;
if (!apiKey || !configuredBaseUrl) throw new Error('缺少 DASHSCOPE_API_KEY 和工作空间地址；也可以使用 --credentials-csv');
const workspaceOrigin = new URL(configuredBaseUrl).origin;
const endpoint = new URL('/compatible-mode/v1/chat/completions', workspaceOrigin).toString();
const targetIds = placementSampleIds(CHARACTERS, [], 360).slice(0, limit);
const targetEntries = targetIds.map((id) => CHARACTERS.find((entry) => entry.id === id)!);
const existing = await readExisting(outputPath);

for (let start = 0; start < targetEntries.length; start += batchSize) {
  const batch = targetEntries.slice(start, start + batchSize).filter((entry) => !existing[entry.char]);
  if (!batch.length) continue;
  let generated: Record<string, GeneratedTeaching> | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3 && !generated; attempt += 1) {
    try {
      generated = await generateBatch(batch);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 800));
    }
  }
  if (!generated) {
    console.log(`批次校验未通过，拆成 ${batch.length} 个单字继续生成`);
    generated = {};
    for (const entry of batch) {
      let single: Record<string, GeneratedTeaching> | undefined;
      for (let attempt = 1; attempt <= 3 && !single; attempt += 1) {
        try {
          single = await generateBatch([entry]);
        } catch (error) {
          lastError = error;
          if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
        }
      }
      if (!single) throw lastError;
      Object.assign(generated, single);
    }
  }
  Object.assign(existing, generated);
  await writeFile(outputPath, `${JSON.stringify(sortRecord(existing), null, 2)}\n`, 'utf8');
  console.log(`已生成 ${Math.min(start + batchSize, targetEntries.length)} / ${targetEntries.length}`);
}

async function generateBatch(entries: typeof targetEntries) {
  const requested = entries.map(({ char, pinyin }) => ({ char, pinyin }));
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      enable_thinking: false,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是小学中文识字内容编辑。请为每个汉字选择现代小学生最需要的常用义。不用生僻义、古义或不适龄内容。英文必须翻译具体中文词语，不强行一字一译。'
        },
        {
          role: 'user',
          content: `为以下汉字生成教学数据：${JSON.stringify(requested)}\n只返回 JSON 对象，格式必须是 {"items":[{"char":"字","meaning":"20至40字的儿童中文解释","words":["包含该字的常用词1","包含该字的常用词2"],"example":"包含该字、不超过25字的自然生活句","englishBridges":[{"zh":"上述某个中文词","en":"简短自然的英文词或短语"}]}]}。每个词和句子都必须包含目标字；每字给两个词、一个句子、一到两个中英词义桥。`
        }
      ]
    })
  }, 90_000);
  if (!response.ok) throw new Error(`Qwen 请求失败：${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Qwen 未返回内容');
  const parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { items?: Array<GeneratedTeaching & { char: string }> };
  if (!Array.isArray(parsed.items)) throw new Error('Qwen 返回格式错误');
  const byChar: Record<string, GeneratedTeaching> = {};
  for (const entry of entries) {
    const item = parsed.items.find((candidate) => candidate.char === entry.char);
    if (!item) throw new Error(`缺少汉字：${entry.char}`);
    validateItem(entry.char, item);
    byChar[entry.char] = {
      meaning: item.meaning.trim(),
      words: item.words.map((word) => word.trim()),
      example: item.example.trim(),
      englishBridges: item.englishBridges.map((bridge) => ({ zh: bridge.zh.trim(), en: bridge.en.trim() }))
    };
  }
  return byChar;
}

function validateItem(char: string, item: GeneratedTeaching) {
  if (typeof item.meaning !== 'string' || item.meaning.trim().length < 6 || item.meaning.length > 60) throw new Error(`${char} 字义不合格`);
  if (!Array.isArray(item.words) || item.words.length !== 2 || item.words.some((word) => typeof word !== 'string' || !word.includes(char) || word.length > 8)) throw new Error(`${char} 词语不合格`);
  if (typeof item.example !== 'string' || !item.example.includes(char) || item.example.length > 35) throw new Error(`${char} 句子不合格`);
  if (!Array.isArray(item.englishBridges) || item.englishBridges.length < 1 || item.englishBridges.length > 2) throw new Error(`${char} 英文桥不合格`);
  for (const bridge of item.englishBridges) {
    if (typeof bridge.zh !== 'string' || !bridge.zh.includes(char) || typeof bridge.en !== 'string' || !/[A-Za-z]/.test(bridge.en) || bridge.en.length > 45) throw new Error(`${char} 英文桥不合格`);
  }
}

async function readCredentials(path: string) {
  const raw = await readFile(resolve(path), 'utf8');
  const values = raw.split(/[\r\n,;]/).map((value) => value.replace(/^\s*["']|["']\s*$/g, '').trim());
  const apiKey = values.find((value) => value.startsWith('sk-') && value.length >= 16);
  const baseUrl = values.find((value) => /^https:\/\/[^/]*\.aliyuncs\.com(?:\/.*)?$/.test(value));
  if (!apiKey || !baseUrl) throw new Error('凭据文件缺少 API Key 或工作空间地址');
  return { apiKey, workspaceOrigin: new URL(baseUrl).origin };
}

async function readExisting(path: string): Promise<Record<string, GeneratedTeaching>> {
  try { return JSON.parse(await readFile(path, 'utf8')) as Record<string, GeneratedTeaching>; } catch { return {}; }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

function sortRecord(value: Record<string, GeneratedTeaching>) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'zh-CN')));
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
