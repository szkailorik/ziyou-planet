import { CURRICULUM_CHARACTERS } from '../data/curriculum-characters';

export type PrebuiltSpeechRequest =
  | { kind: 'character'; character: string }
  | { kind: 'poem'; slug: string };

export const PREBUILT_SPEECH_VERSION = 'v1';
export const PREBUILT_SPEECH_REVISION = '20260717a';

function withRevision(path: string) {
  return `${path}?rev=${PREBUILT_SPEECH_REVISION}`;
}

export function prebuiltSpeechUrl(request: PrebuiltSpeechRequest) {
  if (request.kind === 'poem') {
    return withRevision(`/audio/tts/${PREBUILT_SPEECH_VERSION}/poems/${encodeURIComponent(request.slug)}.mp3`);
  }
  const index = CURRICULUM_CHARACTERS.indexOf(request.character);
  return index < 0 ? null : withRevision(`/audio/tts/${PREBUILT_SPEECH_VERSION}/characters/${index + 1}.mp3`);
}
