import { CURRICULUM_CHARACTERS } from '../data/curriculum-characters';

export type PrebuiltSpeechRequest =
  | { kind: 'character'; character: string }
  | { kind: 'poem'; slug: string };

export const PREBUILT_SPEECH_VERSION = 'v1';

export function prebuiltSpeechUrl(request: PrebuiltSpeechRequest) {
  if (request.kind === 'poem') {
    return `/audio/tts/${PREBUILT_SPEECH_VERSION}/poems/${encodeURIComponent(request.slug)}.mp3`;
  }
  const index = CURRICULUM_CHARACTERS.indexOf(request.character);
  return index < 0 ? null : `/audio/tts/${PREBUILT_SPEECH_VERSION}/characters/${index + 1}.mp3`;
}
