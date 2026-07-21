import type { IdiomExhibit } from './data/idiom-exhibits';

export function idiomImagePath(id: number) {
  return `/images/idioms/${String(id).padStart(3, '0')}.webp`;
}

export default function IdiomThumbnail({ idiom, large = false }: { idiom: IdiomExhibit; large?: boolean }) {
  return (
    <img
      className={large ? 'idiom-thumbnail idiom-thumbnail--large' : 'idiom-thumbnail'}
      src={idiomImagePath(idiom.id)}
      alt={`${idiom.text}情境图：${idiom.meaning}`}
      loading={large ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
