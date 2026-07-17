import { useEffect, useMemo, useState } from 'react';
import { selectMandarinVoice } from './domain/poem-narration';
import { prebuiltSpeechUrl, type PrebuiltSpeechRequest } from './domain/prebuilt-speech';

export type QwenSpeechRequest = PrebuiltSpeechRequest;

type Status = 'preparing' | 'ready' | 'playing' | 'fallback';

const audioCache = new Map<string, Promise<string>>();
let activeAudio: HTMLAudioElement | null = null;
let activeKey = '';
let activeEnded: (() => void) | null = null;

function requestKey(request: QwenSpeechRequest) {
  return request.kind === 'character' ? `character:${request.character}` : `poem:${request.slug}`;
}

async function prepareQwenSpeech(request: QwenSpeechRequest) {
  const key = requestKey(request);
  const existing = audioCache.get(key);
  if (existing) return existing;
  const pending = prepareSpeechBlob(request).catch((error) => {
    audioCache.delete(key);
    throw error;
  });
  audioCache.set(key, pending);

  if (audioCache.size > 48) {
    const oldest = audioCache.entries().next().value as [string, Promise<string>] | undefined;
    if (oldest && oldest[0] !== key) {
      audioCache.delete(oldest[0]);
      void oldest[1].then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
    }
  }
  return pending;
}

async function prepareSpeechBlob(request: QwenSpeechRequest) {
  const staticUrl = prebuiltSpeechUrl(request);
  if (staticUrl) {
    const staticResponse = await fetch(staticUrl, { cache: 'force-cache' });
    const contentType = staticResponse.headers.get('Content-Type') ?? '';
    if (staticResponse.ok && contentType.startsWith('audio/')) return URL.createObjectURL(await staticResponse.blob());
  }
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(detail.error ?? 'Qwen3-TTS 暂时不可用');
  }
  return URL.createObjectURL(await response.blob());
}

export function stopQwenSpeech(key?: string) {
  if (key && activeKey !== key) return;
  activeAudio?.pause();
  activeAudio = null;
  activeKey = '';
  const ended = activeEnded;
  activeEnded = null;
  ended?.();
}

async function playQwenSpeech(request: QwenSpeechRequest, onEnded: () => void) {
  stopQwenSpeech();
  const key = requestKey(request);
  const audio = new Audio(await prepareQwenSpeech(request));
  activeAudio = audio;
  activeKey = key;
  activeEnded = onEnded;
  audio.onended = () => stopQwenSpeech(key);
  audio.onerror = () => stopQwenSpeech(key);
  await audio.play();
}

function playWithDevice(text: string, rate: number, onEnded: () => void) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = rate;
  utterance.voice = selectMandarinVoice(window.speechSynthesis.getVoices()) ?? null;
  utterance.onend = onEnded;
  utterance.onerror = onEnded;
  window.speechSynthesis.speak(utterance);
  return true;
}

export default function QwenSpeechButton({
  request,
  enabled,
  className,
  readyLabel,
  playingLabel,
  preparingLabel = '语音准备中…',
  ariaLabel,
  fallbackText,
  fallbackRate = 0.8
}: {
  request: QwenSpeechRequest;
  enabled: boolean;
  className: string;
  readyLabel: string;
  playingLabel: string;
  preparingLabel?: string;
  ariaLabel: string;
  fallbackText: string;
  fallbackRate?: number;
}) {
  const key = useMemo(() => requestKey(request), [request]);
  const [status, setStatus] = useState<Status>('preparing');

  useEffect(() => {
    let current = true;
    if (!enabled) return () => undefined;
    setStatus('preparing');
    void prepareQwenSpeech(request).then(() => {
      if (current) setStatus('ready');
    }).catch(() => {
      if (current) setStatus('fallback');
    });
    return () => {
      current = false;
      stopQwenSpeech(key);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [enabled, key]);

  async function toggle() {
    if (!enabled || status === 'preparing') return;
    if (status === 'playing') {
      stopQwenSpeech(key);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setStatus(audioCache.has(key) ? 'ready' : 'fallback');
      return;
    }
    const done = () => setStatus(audioCache.has(key) ? 'ready' : 'fallback');
    if (status === 'fallback') {
      setStatus('playing');
      if (!playWithDevice(fallbackText, fallbackRate, done)) done();
      return;
    }
    setStatus('playing');
    try {
      await playQwenSpeech(request, done);
    } catch {
      audioCache.delete(key);
      if (!playWithDevice(fallbackText, fallbackRate, done)) done();
    }
  }

  const label = !enabled ? '声音已关闭' : status === 'preparing' ? preparingLabel : status === 'playing' ? playingLabel : readyLabel;
  return <button type="button" disabled={!enabled || status === 'preparing'} className={`${className} ${status === 'playing' ? 'is-playing' : ''}`} aria-label={ariaLabel} aria-pressed={status === 'playing'} title="预生成的阿里云 Qwen3-TTS 标准普通话；缺失时自动在线补充" onClick={() => void toggle()}><span aria-hidden="true">{status === 'playing' ? '■' : status === 'preparing' ? '◌' : '♪'}</span>{label}</button>;
}
