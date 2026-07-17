import { CURRICULUM_CHARACTERS } from '../../src/data/curriculum-characters';
import { PRIMARY_POEMS } from '../../src/data/primary-poems';

type Env = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
};

type Context = { request: Request; env: Env };
type SpeechInput = { kind: 'character'; character: string } | { kind: 'poem'; slug: string };

const MODEL = 'qwen3-tts-instruct-flash';
const VOICE = 'Cherry';
const CHARACTER_INSTRUCTIONS = '请用清晰、自然、标准的普通话，像耐心的小学语文老师一样，只读给出的汉字，不添加任何内容。单字读音略慢，发音完整准确。';
const POEM_INSTRUCTIONS = '请用自然、温暖、标准的普通话朗读古诗。语速舒缓，标题、朝代、作者和诗句之间停顿清楚；语气含蓄克制，贴合诗意，不添加任何内容。';

export function resolveSpeechInput(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('请求格式不正确');
  const value = input as Partial<SpeechInput>;
  if (value.kind === 'character') {
    const character = String(value.character ?? '').trim();
    if ([...character].length !== 1 || !CURRICULUM_CHARACTERS.includes(character)) throw new Error('汉字不在课程字库中');
    return { kind: 'character' as const, text: character, instructions: CHARACTER_INSTRUCTIONS };
  }
  if (value.kind === 'poem') {
    const poem = PRIMARY_POEMS.find((item) => item.slug === value.slug);
    if (!poem) throw new Error('没有找到这首诗');
    return {
      kind: 'poem' as const,
      text: [`《${poem.title}》`, `${poem.dynasty}，${poem.author}`, ...poem.lines].join('。\n'),
      instructions: POEM_INSTRUCTIONS
    };
  }
  throw new Error('不支持的朗读类型');
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

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  try {
    assertSameOrigin(request);
    if (!env.DASHSCOPE_API_KEY || !env.DASHSCOPE_BASE_URL) return errorResponse('语音服务尚未配置', 503);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2048) return errorResponse('语音请求过大', 413);
    const speech = resolveSpeechInput(JSON.parse(raw));
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
    return new Response(audio.body, {
      status: 200,
      headers: {
        'Content-Type': audio.headers.get('Content-Type') ?? 'audio/wav',
        'Cache-Control': 'private, max-age=86400',
        'X-TTS-Engine': 'qwen3-tts-instruct-flash',
        ...(result.request_id ? { 'X-DashScope-Request-Id': result.request_id } : {})
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '语音请求不正确';
    return errorResponse(message, message.includes('JSON') ? 400 : 400);
  }
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
