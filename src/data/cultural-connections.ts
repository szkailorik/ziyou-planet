export type IdiomConnection = {
  text: string;
  meaning: string;
  example: string;
};

export type ClassicConnection = {
  line: string;
  title: string;
  author: string;
  dynasty: string;
  note: string;
};

type Targeted<T> = T & { targets: string };

const idioms: Array<Targeted<IdiomConnection>> = [
  { targets: '一心意', text: '一心一意', meaning: '专心做好一件事。', example: '她一心一意地搭完了积木。' },
  { targets: '三二', text: '三心二意', meaning: '心里想好几件事，不能专心。', example: '写作业时不要三心二意。' },
  { targets: '四面八方', text: '四面八方', meaning: '周围各个方向。', example: '人们从四面八方来到广场。' },
  { targets: '五颜六色', text: '五颜六色', meaning: '颜色很多，非常好看。', example: '花园里开着五颜六色的花。' },
  { targets: '七上下', text: '七上八下', meaning: '心里不安，安静不下来。', example: '等成绩时，他心里七上八下。' },
  { targets: '九牛毛', text: '九牛一毛', meaning: '很多东西中很少的一点。', example: '这一粒米只是粮仓里的九牛一毛。' },
  { targets: '十全美', text: '十全十美', meaning: '各方面都非常完美。', example: '作品不必十全十美，认真完成就很好。' },
  { targets: '人山海', text: '人山人海', meaning: '人非常多。', example: '节日的公园里人山人海。' },
  { targets: '大小同异', text: '大同小异', meaning: '大部分相同，只有小地方不同。', example: '这两幅画大同小异。' },
  { targets: '小翼', text: '小心翼翼', meaning: '做事非常小心。', example: '他小心翼翼地捧起小鸟。' },
  { targets: '不知觉', text: '不知不觉', meaning: '没有注意到事情已经发生。', example: '不知不觉，天已经黑了。' },
  { targets: '自言语', text: '自言自语', meaning: '自己对自己说话。', example: '她一边找笔，一边自言自语。' },
  { targets: '欢喜地', text: '欢天喜地', meaning: '非常高兴。', example: '大家欢天喜地地迎接新年。' },
  { targets: '风和丽', text: '风和日丽', meaning: '微风温和，阳光明亮。', example: '今天风和日丽，适合去郊游。' },
  { targets: '鸟花香', text: '鸟语花香', meaning: '鸟儿鸣叫，花儿飘香，景色很好。', example: '春天的公园鸟语花香。' },
  { targets: '清水秀', text: '山清水秀', meaning: '山水清丽，景色优美。', example: '这座小城山清水秀。' },
  { targets: '春暖开', text: '春暖花开', meaning: '春天天气变暖，花儿开放。', example: '春暖花开时，我们去看桃花。' },
  { targets: '秋高气爽', text: '秋高气爽', meaning: '秋天天空高远，天气清爽。', example: '秋高气爽，正适合运动。' },
  { targets: '冰雪', text: '冰天雪地', meaning: '到处都是冰雪，天气很冷。', example: '窗外一片冰天雪地。' },
  { targets: '东张西望', text: '东张西望', meaning: '向四周到处看。', example: '过马路时不要东张西望。' },
  { targets: '南来北往', text: '南来北往', meaning: '从不同方向来来往往。', example: '车站里的人南来北往。' },
  { targets: '手忙脚乱', text: '手忙脚乱', meaning: '事情一多，动作慌乱。', example: '先排好顺序，就不会手忙脚乱。' },
  { targets: '井条', text: '井井有条', meaning: '整齐清楚，很有顺序。', example: '她把书桌收拾得井井有条。' },
  { targets: '开门见', text: '开门见山', meaning: '说话直接，一开始就讲重点。', example: '他开门见山地说出了自己的想法。' },
  { targets: '积累', text: '日积月累', meaning: '每天积累一点，慢慢变多。', example: '汉字日积月累，就会越认越多。' },
  { targets: '目转睛', text: '目不转睛', meaning: '眼睛一直看着，不移开。', example: '孩子们目不转睛地看着舞台。' },
  { targets: '学致用', text: '学以致用', meaning: '把学到的知识真正用起来。', example: '认出路牌上的字，就是学以致用。' }
];

const classics: Array<Targeted<ClassicConnection>> = [
  { targets: '江莲田', line: '江南可采莲，莲叶何田田。', title: '江南', author: '汉乐府', dynasty: '汉', note: '写江南水乡荷叶茂盛、可以采莲的画面。' },
  { targets: '鹅曲歌', line: '鹅，鹅，鹅，曲项向天歌。', title: '咏鹅', author: '骆宾王', dynasty: '唐', note: '像在眼前看见白鹅伸长脖子高声鸣叫。' },
  { targets: '风秋叶', line: '解落三秋叶，能开二月花。', title: '风', author: '李峤', dynasty: '唐', note: '不直接写风的样子，而是写风带来的变化。' },
  { targets: '柳树高', line: '碧玉妆成一树高，万条垂下绿丝绦。', title: '咏柳', author: '贺知章', dynasty: '唐', note: '把嫩绿的柳树想象成碧玉和绿色丝带。' },
  { targets: '山河海流', line: '白日依山尽，黄河入海流。', title: '登鹳雀楼', author: '王之涣', dynasty: '唐', note: '写太阳落山、黄河入海的辽阔画面。' },
  { targets: '春眠晓鸟', line: '春眠不觉晓，处处闻啼鸟。', title: '春晓', author: '孟浩然', dynasty: '唐', note: '从清晨的鸟鸣里感受到春天已经来到。' },
  { targets: '床前明月光霜', line: '床前明月光，疑是地上霜。', title: '静夜思', author: '李白', dynasty: '唐', note: '月光洒在床前，明亮得像地上的白霜。' },
  { targets: '小时白盘', line: '小时不识月，呼作白玉盘。', title: '古朗月行', author: '李白', dynasty: '唐', note: '孩子把圆圆的月亮想象成白玉做的盘子。' },
  { targets: '飞直千尺', line: '飞流直下三千尺，疑是银河落九天。', title: '望庐山瀑布', author: '李白', dynasty: '唐', note: '用夸张的想象写瀑布又高又壮观。' },
  { targets: '两个黄青天', line: '两个黄鹂鸣翠柳，一行白鹭上青天。', title: '绝句', author: '杜甫', dynasty: '唐', note: '黄、翠、白、青组成一幅明亮的春景。' },
  { targets: '火草生', line: '野火烧不尽，春风吹又生。', title: '赋得古原草送别', author: '白居易', dynasty: '唐', note: '写小草生命力旺盛，春风一来又会生长。' },
  { targets: '寒石径云家', line: '远上寒山石径斜，白云生处有人家。', title: '山行', author: '杜牧', dynasty: '唐', note: '沿着山间小路望去，白云深处还有人家。' },
  { targets: '雪绝万', line: '千山鸟飞绝，万径人踪灭。', title: '江雪', author: '柳宗元', dynasty: '唐', note: '大雪之后，山野安静得看不到鸟和行人。' },
  { targets: '禾午汗土', line: '锄禾日当午，汗滴禾下土。', title: '悯农（其二）', author: '李绅', dynasty: '唐', note: '写农民在烈日下劳动，提醒人们珍惜粮食。' },
  { targets: '泉眼细爱晴柔', line: '泉眼无声惜细流，树阴照水爱晴柔。', title: '小池', author: '杨万里', dynasty: '宋', note: '写泉水、树荫和阳光组成的安静小池。' },
  { targets: '识真面', line: '不识庐山真面目，只缘身在此山中。', title: '题西林壁', author: '苏轼', dynasty: '宋', note: '站的位置不同，看到的样子也可能不同。' },
  { targets: '竹桃两枝鸭先', line: '竹外桃花三两枝，春江水暖鸭先知。', title: '惠崇春江晚景', author: '苏轼', dynasty: '宋', note: '从桃花开放和鸭子下水看见早春的暖意。' },
  { targets: '等闲紫红总', line: '等闲识得东风面，万紫千红总是春。', title: '春日', author: '朱熹', dynasty: '宋', note: '百花盛开、颜色缤纷，就是春天的模样。' },
  { targets: '儿童急走追蝶菜寻', line: '儿童急走追黄蝶，飞入菜花无处寻。', title: '宿新市徐公店', author: '杨万里', dynasty: '宋', note: '黄蝴蝶飞进黄色菜花里，一下子看不见了。' },
  { targets: '出红胜蓝', line: '日出江花红胜火，春来江水绿如蓝。', title: '忆江南', author: '白居易', dynasty: '唐', note: '用鲜明的红和绿写出江南春天的颜色。' }
];

export const IDIOM_BY_CHAR = new Map<string, IdiomConnection>();
for (const { targets, ...idiom } of idioms) {
  for (const char of targets) if (!IDIOM_BY_CHAR.has(char)) IDIOM_BY_CHAR.set(char, idiom);
}

export const CLASSIC_BY_CHAR = new Map<string, ClassicConnection>();
for (const { targets, ...classic } of classics) {
  for (const char of targets) if (!CLASSIC_BY_CHAR.has(char)) CLASSIC_BY_CHAR.set(char, classic);
}
