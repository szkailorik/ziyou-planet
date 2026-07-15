export type CharacterFamily = { anchor: string; members: string[]; note: string };

const families: CharacterFamily[] = [
  { anchor: '青', members: ['青', '清', '请', '情', '晴', '睛'], note: '“青”常给读音线索；不同形旁提示水、语言、心情、天气或眼睛。' },
  { anchor: '马', members: ['马', '妈', '吗', '码', '蚂', '骂'], note: '“马”常给读音线索；女、口、石、虫等部件帮助分辨意思。' },
  { anchor: '包', members: ['包', '抱', '跑', '泡', '炮', '饱'], note: '这一族外形相近、读音并不完全相同，要同时看形旁和整个词。' },
  { anchor: '巴', members: ['巴', '把', '爸', '吧', '爬'], note: '“巴”提供部分读音线索，但声调甚至声母会变化，不能只靠猜。' },
  { anchor: '也', members: ['也', '他', '地', '池', '驰'], note: '同一个声旁进入不同结构后，结合形旁和词语判断字义。' },
  { anchor: '木', members: ['木', '本', '末', '林', '森', '休'], note: '这一组适合看字形关系：位置、数量或组合变化会带来新意思。' },
  { anchor: '日', members: ['日', '旦', '早', '明', '时', '晚'], note: '“日”常和太阳、光亮、日期、时间有关，但仍要放进词语确认。' }
];

export const CHARACTER_FAMILY_BY_CHAR = new Map<string, CharacterFamily>();
for (const family of families) for (const char of family.members) CHARACTER_FAMILY_BY_CHAR.set(char, family);
