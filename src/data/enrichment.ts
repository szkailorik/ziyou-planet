import { CURRICULUM_CHARACTERS, CURRICULUM_PINYIN } from './curriculum-characters';
import type { CharacterEntry } from '../types';
import { ENGLISH_BRIDGES } from './english-bridges';
import { CHARACTER_FAMILY_BY_CHAR } from './character-families';
import { CLASSIC_BY_CHAR, IDIOM_BY_CHAR } from './cultural-connections';

type Enrichment = Pick<CharacterEntry, 'words' | 'example' | 'scene' | 'confusables'>;

export const SEED_ORDER = Array.from(
  '一二三十百千万人个大小多少上下中天地日月山水火木土石田禾口耳目手足心力男女子父母爸妈爷奶我你他她我们的是有在不这那来去看听说读写学生老师学校家国门开关早晚今天明年春夏秋冬东西南北风雨云雪花草树鸟鱼虫猫狗马牛羊米饭果菜衣车路灯书本笔纸桌椅'
).filter((char, index, all) => all.indexOf(char) === index);

const enrichment: Record<string, Enrichment> = {
  一: { words: ['一个', '第一'], example: '我有一个新书包。', scene: '数字、日期和门牌上常见', confusables: ['二', '三'] },
  人: { words: ['大人', '人们'], example: '公园里有很多人。', scene: '车站、商店和故事书里常见', confusables: ['入', '八'] },
  大: { words: ['大家', '大海'], example: '大象有一对大耳朵。', scene: '大小标签和故事标题里常见', confusables: ['太', '犬'] },
  小: { words: ['小手', '小学'], example: '小鸟站在树枝上。', scene: '学校名称和生活标牌上常见', confusables: ['少'] },
  上: { words: ['上学', '上午'], example: '早上我们去上学。', scene: '电梯、地图和课程表上常见', confusables: ['下'] },
  下: { words: ['下雨', '下午'], example: '下午可能会下雨。', scene: '电梯、天气和时间表上常见', confusables: ['上'] },
  中: { words: ['中国', '中间'], example: '小猫坐在中间。', scene: '地图、校名和方位提示里常见', confusables: ['申'] },
  日: { words: ['日子', '生日'], example: '今天是我的生日。', scene: '日历和日期里常见', confusables: ['目', '白'] },
  月: { words: ['月亮', '月份'], example: '月亮慢慢升起来。', scene: '日历和夜空故事里常见', confusables: ['用'] },
  山: { words: ['大山', '山顶'], example: '远处有一座青山。', scene: '地图、公园和绘本里常见', confusables: ['出'] },
  水: { words: ['喝水', '水果'], example: '运动后要记得喝水。', scene: '水杯、洗手池和食品包装上常见', confusables: ['永'] },
  火: { words: ['火车', '火苗'], example: '红色火车开过来了。', scene: '车站和消防标志上常见', confusables: ['灭'] },
  木: { words: ['木头', '树木'], example: '树木长出了新叶子。', scene: '家具标签和自然读物里常见', confusables: ['本', '术'] },
  田: { words: ['田野', '水田'], example: '田野里一片绿色。', scene: '乡村地图和自然读物里常见', confusables: ['由', '甲'] },
  口: { words: ['门口', '人口'], example: '我们在门口见面。', scene: '出口、入口和地图上常见', confusables: ['回', '日'] },
  目: { words: ['目光', '目录'], example: '先看看书的目录。', scene: '书本目录和词语中常见', confusables: ['日', '自'] },
  手: { words: ['小手', '洗手'], example: '吃饭前要认真洗手。', scene: '洗手提示和动作词里常见', confusables: ['毛'] },
  心: { words: ['开心', '小心'], example: '过马路要小心。', scene: '安全提示和心情词里常见', confusables: ['必'] },
  女: { words: ['女孩', '女儿'], example: '女孩在草地上跳绳。', scene: '人物称呼和标识中常见', confusables: ['如'] },
  子: { words: ['孩子', '儿子'], example: '孩子们在操场上玩。', scene: '人物称呼和许多词语中常见', confusables: ['了'] },
  我: { words: ['我们', '自我'], example: '我喜欢读故事书。', scene: '对话、日记和作文里常见', confusables: ['找'] },
  你: { words: ['你好', '你们'], example: '你好，很高兴见到你。', scene: '对话和问候语里常见', confusables: ['他'] },
  他: { words: ['他们', '其他'], example: '他正在认真看书。', scene: '故事人物和对话里常见', confusables: ['她', '地'] },
  的: { words: ['我的', '好的'], example: '这是我的蓝色铅笔。', scene: '几乎所有故事和说明里都常见', confusables: ['白'] },
  学: { words: ['学生', '学习'], example: '我们一起快乐学习。', scene: '学校、课程表和书本上常见', confusables: ['字'] },
  生: { words: ['学生', '生日'], example: '今天是同学生日。', scene: '学校和日历中常见', confusables: ['牛'] },
  校: { words: ['学校', '校园'], example: '校园里开满了花。', scene: '校门、校服和通知上常见', confusables: ['桥'] },
  今: { words: ['今天', '今年'], example: '今天阳光很好。', scene: '日历、天气和每日计划里常见', confusables: ['令'] },
  天: { words: ['今天', '天气'], example: '今天的天气很温暖。', scene: '天气预报和日历里常见', confusables: ['夫'] },
  风: { words: ['大风', '风筝'], example: '春风吹动了风筝。', scene: '天气预报和自然故事里常见', confusables: ['凤'] },
  雨: { words: ['下雨', '雨伞'], example: '下雨天要带雨伞。', scene: '天气预报和生活用品上常见', confusables: ['两'] },
  花: { words: ['花朵', '红花'], example: '花园里的花开了。', scene: '公园、花店和绘本里常见', confusables: ['华'] },
  书: { words: ['书本', '读书'], example: '睡前我会读一本书。', scene: '图书馆、课程表和书店里常见', confusables: ['画'] },
  读: { words: ['读书', '朗读'], example: '请把这句话读一遍。', scene: '课本任务和阅读提示里常见', confusables: ['续'] },
  写: { words: ['写字', '书写'], example: '我在田字格里写字。', scene: '作业本和课堂指令里常见', confusables: ['与'] },
  字: { words: ['写字', '汉字'], example: '每个汉字都有自己的样子。', scene: '课本、字典和标牌上常见', confusables: ['学'] },
  门: { words: ['大门', '门口'], example: '请在学校门口等我。', scene: '房间、商店和出入口标识上常见', confusables: ['问', '闪'] },
  开: { words: ['开门', '开心'], example: '请轻轻打开窗户。', scene: '开关、电器和营业时间上常见', confusables: ['井'] },
  关: { words: ['关门', '开关'], example: '离开前请关灯。', scene: '开关、电器和安全提示上常见', confusables: ['天'] },
  早: { words: ['早上', '早安'], example: '早上好，我们出发吧。', scene: '时间表和问候语里常见', confusables: ['草'] },
  晚: { words: ['晚上', '晚安'], example: '晚上我们一起看月亮。', scene: '作息表和问候语里常见', confusables: ['兔'] },
  春: { words: ['春天', '春风'], example: '春天的小草变绿了。', scene: '日历和四季故事里常见', confusables: ['看'] },
  夏: { words: ['夏天', '夏日'], example: '夏天可以听到蝉鸣。', scene: '日历和四季故事里常见', confusables: ['复'] },
  秋: { words: ['秋天', '秋风'], example: '秋天的树叶变黄了。', scene: '日历和四季故事里常见', confusables: ['和'] },
  冬: { words: ['冬天', '冬雪'], example: '冬天要穿暖和的衣服。', scene: '日历和四季故事里常见', confusables: ['各'] },
  东: { words: ['东方', '东西'], example: '太阳从东方升起。', scene: '地图和方向标识里常见', confusables: ['车'] },
  西: { words: ['西方', '东西'], example: '操场在教学楼西边。', scene: '地图和方向标识里常见', confusables: ['酒'] },
  南: { words: ['南方', '南门'], example: '请从公园南门进入。', scene: '地图、车站和门牌里常见', confusables: ['商'] },
  北: { words: ['北方', '北门'], example: '北风吹来了雪花。', scene: '地图、车站和门牌里常见', confusables: ['比'] }
};

const seedWords: Record<string, string[]> = {
  二: ['二月', '第二'], 三: ['三个', '第三'], 十: ['十月', '十分'], 百: ['百花', '百年'], 千: ['千万', '千米'], 万: ['万里', '一万'], 个: ['一个', '个人'],
  多: ['多少', '许多'], 少: ['多少', '少年'], 地: ['大地', '土地'], 石: ['石头', '石桥'], 禾: ['禾苗', '锄禾'], 耳: ['耳朵', '木耳'], 足: ['足球', '手足'], 力: ['力气', '用力'],
  男: ['男孩', '男人'], 父: ['父亲', '父母'], 母: ['母亲', '父母'], 爸: ['爸爸', '爸妈'], 妈: ['妈妈', '爸妈'], 爷: ['爷爷', '老爷爷'], 奶: ['奶奶', '牛奶'],
  她: ['她们', '她的'], 们: ['我们', '人们'], 是: ['可是', '是的'], 有: ['没有', '有用'], 在: ['现在', '正在'], 不: ['不要', '不是'], 这: ['这里', '这个'], 那: ['那里', '那个'],
  来: ['回来', '来到'], 去: ['回去', '去年'], 看: ['看见', '看书'], 听: ['听见', '听说'], 说: ['说话', '小说'], 老: ['老师', '老人'], 师: ['老师', '师生'], 家: ['大家', '回家'], 国: ['中国', '国家'],
  明: ['明天', '明亮'], 年: ['今年', '过年'], 云: ['白云', '云朵'], 雪: ['下雪', '雪花'], 草: ['小草', '草地'], 树: ['大树', '树木'], 鸟: ['小鸟', '鸟儿'], 鱼: ['小鱼', '金鱼'],
  虫: ['小虫', '昆虫'], 猫: ['小猫', '熊猫'], 狗: ['小狗', '花狗'], 马: ['白马', '马上'], 牛: ['小牛', '牛奶'], 羊: ['山羊', '羊群'], 米: ['大米', '米饭'], 饭: ['吃饭', '米饭'],
  果: ['水果', '果园'], 菜: ['青菜', '白菜'], 衣: ['衣服', '上衣'], 车: ['火车', '汽车'], 路: ['马路', '路口'], 灯: ['电灯', '关灯'], 本: ['书本', '本子'], 笔: ['铅笔', '毛笔'],
  纸: ['白纸', '纸张'], 桌: ['书桌', '桌子'], 椅: ['椅子', '桌椅']
};

const themes = [
  { name: '数字与数量', chars: '一二三十百千万个大小多少' },
  { name: '方位与自然', chars: '上下中天地日月山水火木土石田禾春夏秋冬东西南北风雨云雪花草树' },
  { name: '身体与人物', chars: '人口耳目手足心力男女子父母爸妈爷奶我你他她们' },
  { name: '日常表达', chars: '的是有在不这那来去看听说读写' },
  { name: '学校与时间', chars: '学生老师校家国门开关早晚今天明年' },
  { name: '动物与食物', chars: '鸟鱼虫猫狗马牛羊米饭果菜' },
  { name: '生活用品', chars: '衣车路灯书本笔纸桌椅' }
];

const sourceChars = Array.from(CURRICULUM_CHARACTERS);
const sourceIndex = new Map(sourceChars.map((char, index) => [char, index]));
const orderedChars = [
  ...SEED_ORDER.filter((char) => sourceIndex.has(char)),
  ...sourceChars.filter((char) => !SEED_ORDER.includes(char))
];

export const CHARACTERS: CharacterEntry[] = orderedChars.map((char, productIndex) => {
  const officialIndex = sourceIndex.get(char)!;
  const curated = enrichment[char];
  const wordHints = curated?.words ?? seedWords[char] ?? [];
  const classic = CLASSIC_BY_CHAR.get(char);
  const idiom = IDIOM_BY_CHAR.get(char);
  const unicode = char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
  return {
    id: officialIndex + 1,
    char,
    unicode: `U+${unicode}`,
    curriculumList: officialIndex < 2500 ? 1 : 2,
    productBand: productIndex < 300 ? 'seed' : productIndex < 3000 ? 'core' : 'extended',
    pinyin: CURRICULUM_PINYIN[officialIndex],
    words: wordHints,
    example: curated?.example ?? (wordHints.length ? `读一读：${wordHints.join('，')}。` : '这个字已经收进课程常用字库，更多词语正在审核。'),
    classic,
    idiom,
    theme: themes.find((item) => item.chars.includes(char))?.name ?? '课程常用字',
    scene: curated?.scene ?? '课程阅读与日常书面语中会见到',
    confusables: curated?.confusables ?? [],
    englishBridges: ENGLISH_BRIDGES[char] ?? [],
    characterFamily: CHARACTER_FAMILY_BY_CHAR.get(char),
    contentStatus: curated ? 'reviewed' : 'basic'
  };
});

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((entry) => [entry.id, entry]));
