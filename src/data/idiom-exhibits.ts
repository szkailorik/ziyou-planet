import { PRIMARY_IDIOMS, type IdiomConnection } from './primary-idioms';

export type IdiomCategory = 'numbers' | 'nature' | 'animals' | 'learning' | 'character' | 'action';
export type IdiomOriginType = '原典故事' | '本义画面' | '现代用法';
export type IdiomVisualSymbol = 'sun' | 'mountain' | 'water' | 'flower' | 'tree' | 'snow' | 'wind' | 'fire' | 'rabbit' | 'tiger' | 'fox' | 'horse' | 'bird' | 'fish' | 'frog' | 'snake' | 'dragon' | 'cow' | 'book' | 'speech' | 'heart' | 'people' | 'hand' | 'clock' | 'star' | 'boat' | 'road';

export type IdiomExhibit = IdiomConnection & {
  id: number;
  category: IdiomCategory;
  originType: IdiomOriginType;
  originNote: string;
  visualBasis: string;
  visualSymbols: IdiomVisualSymbol[];
  sourceLabel?: string;
  sourceUrl?: string;
};

type OriginOverride = Pick<IdiomExhibit, 'originType' | 'originNote' | 'visualBasis' | 'sourceLabel' | 'sourceUrl' | 'visualSymbols'>;

const ORIGIN_OVERRIDES: Record<string, OriginOverride> = {
  守株待兔: {
    originType: '原典故事',
    originNote: '《韩非子·五蠹》写宋国农人偶然捡到撞树而死的兔子，便放下农具守在树桩旁，结果再也等不到兔子。重点是不主动努力，只等偶然好运。',
    visualBasis: '画树桩、跑兔和放在一旁的农具；人物只作战国寓言中的普通农人，不画成具体历史人物。',
    sourceLabel: '《韩非子·五蠹》', sourceUrl: 'https://ctext.org/hanfeizi/wu-du/zhs', visualSymbols: ['tree', 'rabbit', 'hand']
  },
  狐假虎威: {
    originType: '原典故事',
    originNote: '《战国策·楚策一》写狐狸借老虎同行时百兽逃跑的现象，假称动物是在怕自己。重点是借别人的力量吓唬人。',
    visualBasis: '狐狸走在虎前，远处动物散开；不把狐狸真的画成百兽之王。',
    sourceLabel: '《战国策·楚策一》', sourceUrl: 'https://ctext.org/text.pl?if=gb&node=49859', visualSymbols: ['fox', 'tiger', 'people']
  },
  亡羊补牢: {
    originType: '原典故事',
    originNote: '《战国策·楚策四》用“羊丢了再修羊圈，还不算迟”说明出了问题及时补救仍有价值。',
    visualBasis: '画空羊圈、破洞和正在修补的手；重点放在“及时补救”，不渲染羊被伤害。',
    sourceLabel: '《战国策·楚策四》', sourceUrl: 'https://ctext.org/text.pl?if=gb&node=49948', visualSymbols: ['hand', 'road', 'star']
  },
  画蛇添足: {
    originType: '原典故事',
    originNote: '《战国策·齐策二》写众人比赛画蛇，先画好的人又给蛇添脚，反而失去饮酒资格。重点是多做无用的事，坏了原来的结果。',
    visualBasis: '画一条已经完成的蛇和多余的小脚，旁边保留画具；不表现饮酒细节。',
    sourceLabel: '《战国策·齐策二》', sourceUrl: 'https://ctext.org/zhan-guo-ce/qi-er/zhs', visualSymbols: ['snake', 'hand', 'star']
  },
  井底之蛙: {
    originType: '原典故事',
    originNote: '《庄子·秋水》有井中之蛙与东海之鳖的对话，用有限的小井和广阔大海说明见识受到环境限制。',
    visualBasis: '从井口看小青蛙与远处大海的尺度对比；不把“井蛙”画成坏孩子。',
    sourceLabel: '《庄子·秋水》', sourceUrl: 'https://ctext.org/zhuangzi/floods-of-autumn/zhs', visualSymbols: ['frog', 'water', 'star']
  },
  惊弓之鸟: {
    originType: '原典故事',
    originNote: '典故写受过箭伤的鸟听见弓弦声便惊落下来，后来用来形容受过惊吓后格外害怕。',
    visualBasis: '只画远处飞鸟、弓弦声的波纹和旧伤暗示，不表现射击或受伤过程。',
    sourceLabel: '《战国策》相关故事', sourceUrl: 'https://ctext.org/zhan-guo-ce/zhs', visualSymbols: ['bird', 'wind', 'heart']
  },
  九牛一毛: {
    originType: '原典故事',
    originNote: '司马迁《报任安书》用“九牛亡一毛”比喻极多中的极少部分。今天使用时重点是数量差距，不需要画司马迁本人。',
    visualBasis: '用一群牛与一根轻小牛毛作大小、数量对比，避免人物肖像。',
    sourceLabel: '司马迁《报任安书》', sourceUrl: 'https://ctext.org/wiki.pl?if=gb&res=613365', visualSymbols: ['cow', 'people', 'star']
  },
  画龙点睛: {
    originType: '原典故事',
    originNote: '传统典故讲画师为龙画上眼睛后，画面仿佛有了生命。今天常用来指在关键处加一笔，让整体更精彩。',
    visualBasis: '画卷上的龙与落在眼睛处的一点亮光；明确是艺术想象，不当作真实动物事件。',
    sourceLabel: '《历代名画记》相关记载', visualSymbols: ['dragon', 'hand', 'star']
  },
  一鸣惊人: {
    originType: '原典故事',
    originNote: '先秦到汉代文献有“不鸣则已，一鸣惊人”的相关故事版本，今天指平时不显眼，一有表现便很出色。',
    visualBasis: '画安静小鸟忽然放声、周围目光被吸引的瞬间；不锁定某位国君或具体宫廷。',
    sourceLabel: '《韩非子》《史记》相关故事', visualSymbols: ['bird', 'speech', 'star']
  },
  开卷有益: {
    originType: '原典故事',
    originNote: '“开卷”就是打开书卷。相关故事常联系宋太宗勤读《太平御览》，今天用来说明读书通常能有收获。',
    visualBasis: '画打开的书卷和从书页升起的新发现，不塑造宋太宗肖像。',
    sourceLabel: '宋代笔记相关记载', visualSymbols: ['book', 'star', 'sun']
  }
};

const SYMBOL_RULES: Array<[RegExp, IdiomVisualSymbol]> = [
  [/日|阳|明|光/, 'sun'], [/山|岭|峰|岩/, 'mountain'], [/水|江|河|海|湖|浪/, 'water'], [/花|春|柳|草|华/, 'flower'], [/树|林|木|株/, 'tree'], [/雪|冰|寒/, 'snow'], [/风|云|气/, 'wind'], [/火|焚|暖/, 'fire'], [/兔/, 'rabbit'], [/虎/, 'tiger'], [/狐/, 'fox'], [/马/, 'horse'], [/鸟|鸣/, 'bird'], [/鱼/, 'fish'], [/蛙|井/, 'frog'], [/蛇/, 'snake'], [/龙|凤/, 'dragon'], [/牛/, 'cow'], [/学|书|卷|知|思|读/, 'book'], [/言|语|说|声|口/, 'speech'], [/心|意|情|喜|惊|诚/, 'heart'], [/人|众|家|友|同|协|齐/, 'people'], [/手|足|脚|做|画|拾/, 'hand'], [/日|月|年|时|分|秒/, 'clock'], [/路|来|往|行|进/, 'road'], [/船|舟|帆/, 'boat']
];

const CATEGORY_RULES: Array<[IdiomCategory, RegExp]> = [
  ['animals', /兔|虎|狐|马|鸟|鱼|蛙|蛇|龙|凤|牛|羊/],
  ['nature', /山|水|江|河|海|湖|风|云|花|春|秋|雪|冰|林|树|火/],
  ['learning', /学|书|卷|知|思|练|读|温故|举一反三|融会贯通/],
  ['numbers', /一|二|三|四|五|六|七|八|九|十|百|千|万|日|月|年|时|分|秒/],
  ['character', /诚|信|公|私|助|尊|爱|德|实事求是|磊落|坚持|恒/]
];

function inferCategory(item: IdiomConnection): IdiomCategory {
  const text = `${item.text}${item.meaning}`;
  return CATEGORY_RULES.find(([, rule]) => rule.test(text))?.[0] ?? 'action';
}

function inferSymbols(item: IdiomConnection, category: IdiomCategory): IdiomVisualSymbol[] {
  const text = `${item.text}${item.meaning}`;
  const symbols = SYMBOL_RULES.filter(([rule]) => rule.test(text)).map(([, symbol]) => symbol);
  const fallback: Record<IdiomCategory, IdiomVisualSymbol[]> = {
    numbers: ['star', 'clock'], nature: ['mountain', 'sun'], animals: ['bird', 'tree'],
    learning: ['book', 'star'], character: ['heart', 'people'], action: ['hand', 'road']
  };
  return [...new Set([...symbols, ...fallback[category]])].slice(0, 3);
}

function defaultOrigin(category: IdiomCategory): Pick<IdiomExhibit, 'originType' | 'originNote' | 'visualBasis'> {
  if (category === 'nature') return {
    originType: '本义画面',
    originNote: '这个成语可以先从自然或生活画面理解，没有可靠依据时不强行附会成某一个历史故事。',
    visualBasis: '小图保留能帮助理解的本义景物，再用构图提示今天的常用意思。'
  };
  return {
    originType: '现代用法',
    originNote: '这个成语在今天主要表达一种做事方式、感受或判断。没有核实到单一原典故事时，不用“古人曾经这样做”的口吻讲解。',
    visualBasis: '小图按今天常用义画成儿童可理解的生活场景，不把四个字机械拼贴。'
  };
}

export const PRIMARY_IDIOM_EXHIBITS: IdiomExhibit[] = PRIMARY_IDIOMS.map((item, index) => {
  const category = inferCategory(item);
  const override = ORIGIN_OVERRIDES[item.text];
  return {
    ...item,
    id: index + 1,
    category,
    ...defaultOrigin(category),
    ...override,
    visualSymbols: override?.visualSymbols ?? inferSymbols(item, category)
  };
});

export const IDIOM_EXHIBIT_BY_TEXT = new Map(PRIMARY_IDIOM_EXHIBITS.map((item) => [item.text, item]));
