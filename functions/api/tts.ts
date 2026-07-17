import { CURRICULUM_CHARACTERS, CURRICULUM_PINYIN } from '../../src/data/curriculum-characters';
import { PRIMARY_POEM_SPEECH } from '../../src/data/primary-poem-speech';

type Env = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
};

type Context = { request: Request; env: Env; waitUntil?: (promise: Promise<unknown>) => void };
type SpeechInput = ({ kind: 'character'; character: string } | { kind: 'poem'; slug: string }) & { variant?: number };

const MODEL = 'qwen3-tts-instruct-flash';
const VOICE = 'Cherry';
const CACHE_VERSION = 'v1';
const CACHE_MAX_AGE = 60 * 60 * 24 * 30;
const POEM_INSTRUCTIONS = '请用自然、温暖、标准的普通话朗读古诗。语速舒缓，标题、朝代、作者和诗句之间停顿清楚；语气含蓄克制，贴合诗意，不添加任何内容。';

export function characterInstructions(character: string, pinyin: string) {
  return `请把汉字“${character}”读作“${pinyin}”，只朗读这个汉字一遍，不要读出拼音或任何解释。发音清晰、自然、使用标准的普通话。`;
}

export function resolveSpeechInput(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('请求格式不正确');
  const value = input as Partial<SpeechInput>;
  const variant = value.variant === undefined ? 1 : Number(value.variant);
  if (!Number.isInteger(variant) || variant < 1 || variant > 3) throw new Error('语音变体不正确');
  if (value.kind === 'character') {
    const character = String(value.character ?? '').trim();
    const index = CURRICULUM_CHARACTERS.indexOf(character);
    if ([...character].length !== 1 || index < 0) throw new Error('汉字不在课程字库中');
    const pinyin = CURRICULUM_PINYIN[index];
    return { kind: 'character' as const, id: `${index + 1}`, variant, text: character, instructions: characterInstructions(character, pinyin) };
  }
  if (value.kind === 'poem') {
    const slug = String(value.slug ?? '').trim();
    const poem = PRIMARY_POEM_SPEECH[slug];
    if (!poem) throw new Error('没有找到这首诗');
    return {
      kind: 'poem' as const,
      id: slug,
      variant,
      text: [`《${poem.title}》`, `${poem.dynasty}，${poem.author}`, ...poem.lines].join('。\n'),
      instructions: POEM_INSTRUCTIONS
    };
  }
  throw new Error('不支持的朗读类型');
}

export function buildAudioCacheKey(requestUrl: string, input: ReturnType<typeof resolveSpeechInput>) {
  const url = new URL(requestUrl);
  const variantSuffix = input.variant > 1 ? `-retry${input.variant}` : '';
  url.pathname = `/api/tts-cache/${CACHE_VERSION}/${input.kind}/${encodeURIComponent(input.id)}${variantSuffix}.wav`;
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}

export function buildQwenPayload(input: ReturnType<typeof resolveSpeechInput>) {
  return {
    model: MODEL,
    input: {
      text: input.text,
      voice: VOICE,
      language_type: 'Chinese',
      instructions: input.instructions,
      optimize_instructions: true
    }
  };
}

export async function onRequestPost({ request, env, waitUntil }: Context): Promise<Response> {
  try {
    assertSameOrigin(request);
    if (!env.DASHSCOPE_API_KEY || !env.DASHSCOPE_BASE_URL) return errorResponse('语音服务尚未配置', 503);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2048) return errorResponse('语音请求过大', 413);
    const speech = resolveSpeechInput(JSON.parse(raw));
    const cache = typeof caches === 'undefined' ? null : caches.default;
    const cacheKey = buildAudioCacheKey(request.url, speech);
    const cached = await cache?.match(cacheKey);
    if (cached) return withCacheStatus(cached, 'HIT');

    const baseUrl = validateBaseUrl(env.DASHSCOPE_BASE_URL);
    const upstream = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildQwenPayload(speech))
    });
    const result = await upstream.json() as {
      request_id?: string;
      message?: string;
      output?: { audio?: { url?: string } };
    };
    const audioUrl = result.output?.audio?.url;
    if (!upstream.ok || !audioUrl) {
      console.error('Qwen3-TTS synthesis failed', { status: upstream.status, requestId: result.request_id, message: result.message });
      return errorResponse('阿里云语音暂时不可用', 502);
    }

    const audio = await fetch(audioUrl);
    if (!audio.ok || !audio.body) return errorResponse('语音文件暂时不可用', 502);
    const response = new Response(audio.body, {
      status: 200,
      headers: {
        'Content-Type': audio.headers.get('Content-Type') ?? 'audio/wav',
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
        'X-TTS-Engine': 'qwen3-tts-instruct-flash',
        'X-TTS-Cache': 'MISS',
        ...(result.request_id ? { 'X-DashScope-Request-Id': result.request_id } : {})
      }
    });
    if (cache) {
      const cacheWrite = cache.put(cacheKey, response.clone()).catch((error) => {
        console.warn('Qwen3-TTS cache write failed', error);
      });
      if (waitUntil) waitUntil(cacheWrite);
      else await cacheWrite;
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : '语音请求不正确';
    return errorResponse(message, message.includes('JSON') ? 400 : 400);
  }
}

function withCacheStatus(response: Response, status: 'HIT' | 'MISS') {
  const headers = new Headers(response.headers);
  headers.set('X-TTS-Cache', status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function validateBaseUrl(value: string) {
  const url = new URL(value.trim().replace(/\/$/, ''));
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.aliyuncs.com')) throw new Error('语音服务地址配置不正确');
  return url.toString().replace(/\/$/, '');
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new Error('不允许跨站调用语音服务');
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
