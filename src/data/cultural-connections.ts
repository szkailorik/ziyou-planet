export type ClassicConnection = {
  line: string;
  title: string;
  author: string;
  dynasty: string;
  note: string;
  historicalContext: string;
  visualBasis: string;
  evidenceLevel: '史实较明确' | '部分可考' | '情境复原';
  image?: string;
  imageAlt?: string;
};

type Targeted<T> = T & { targets: string };
type ClassicSeed = Omit<ClassicConnection, 'historicalContext' | 'visualBasis' | 'evidenceLevel' | 'image' | 'imageAlt'>;

const classics: Array<Targeted<ClassicSeed>> = [
  { targets: '江莲田', line: '江南可采莲，莲叶何田田。', title: '江南', author: '汉乐府', dynasty: '汉', note: '写江南水乡荷叶茂盛、可以采莲的画面。' },
  { targets: '鹅曲歌', line: '鹅，鹅，鹅，曲项向天歌。', title: '咏鹅', author: '骆宾王', dynasty: '唐', note: '像在眼前看见白鹅伸长脖子高声鸣叫。' },
  { targets: '风秋叶', line: '解落三秋叶，能开二月花。', title: '风', author: '李峤', dynasty: '唐', note: '不直接写风的样子，而是写风带来的变化。' },
  { targets: '柳树高', line: '碧玉妆成一树高，万条垂下绿丝绦。', title: '咏柳', author: '贺知章', dynasty: '唐', note: '把嫩绿的柳树想象成碧玉和绿色丝带。' },
  { targets: '山河海流', line: '白日依山尽，黄河入海流。', title: '登鹳雀楼', author: '王之涣', dynasty: '唐', note: '写太阳落山、黄河入海的辽阔画面。' },
  { targets: '春眠晓鸟', line: '春眠不觉晓，处处闻啼鸟。', title: '春晓', author: '孟浩然', dynasty: '唐', note: '从清晨的鸟鸣里感受到春天已经来到。' },
  { targets: '床前明月光霜', line: '床前明月光，疑是地上霜。', title: '静夜思', author: '李白', dynasty: '唐', note: '月光洒在床前，明亮得像地上的白霜。' },
  { targets: '小时白盘', line: '小时不识月，呼作白玉盘。', title: '古朗月行', author: '李白', dynasty: '唐', note: '孩子把圆圆的月亮想象成白玉做的盘子。' },
  { targets: '飞直千尺', line: '飞流直下三千尺，疑是银河落九天。', title: '望庐山瀑布（其二）', author: '李白', dynasty: '唐', note: '用夸张的想象写瀑布又高又壮观。' },
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

const classicResearch: Record<string, Omit<ClassicConnection, keyof ClassicSeed>> = {
  江南: {
    historicalContext: '这是汉乐府民歌，作者和具体采集地点不可考；不能把画中人物说成某位诗人。',
    visualBasis: '以汉代江南水乡采莲生活作情境复原；人物只用朴素交领衣、束发和木舟，不采用后世宫装。',
    evidenceLevel: '情境复原', image: '/images/classics/jiang-nan.jpg', imageAlt: '汉代江南水乡的荷塘里，人们乘木舟采莲的情境复原图'
  },
  咏鹅: {
    historicalContext: '作品传统署名骆宾王；“七岁作诗”的说法来自后世传述，画面因此不塑造儿童诗人肖像。',
    visualBasis: '只根据诗句呈现白鹅曲颈鸣叫、红掌拨水，并以克制的唐代园林环境陪衬。',
    evidenceLevel: '部分可考', image: '/images/classics/yong-e.jpg', imageAlt: '三只白鹅在唐代园池中游水，其中一只曲颈向天鸣叫'
  },
  风: {
    historicalContext: '李峤的诗没有交代具体地点；秋叶与二月花也不是同一时刻的纪实场面。',
    visualBasis: '用并置的秋林与早春花枝解释“看不见风，却看得见风造成的变化”，不画作者。',
    evidenceLevel: '情境复原', image: '/images/classics/feng.jpg', imageAlt: '风卷起秋叶并吹动早春花枝的两季并置画面'
  },
  咏柳: {
    historicalContext: '贺知章写柳，但原诗没有提供可核验的具体河岸、宅院或在场人物。',
    visualBasis: '画面以早春柳树和普通木桥为主，长枝像绿色丝带；不把任何地点冒充诗作现场。',
    evidenceLevel: '情境复原', image: '/images/classics/yong-liu.jpg', imageAlt: '早春河岸上一棵高柳垂下如绿色丝带般的枝条'
  },
  登鹳雀楼: {
    historicalContext: '诗传统署名王之涣，鹳雀楼与黄河景观关系明确；历史楼阁形制与今天的复建建筑不能等同。',
    visualBasis: '以唐代木构楼阁的高处视点、落日群山和宽阔黄河组成情境，不复制现代复建楼。',
    evidenceLevel: '史实较明确', image: '/images/classics/deng-guan-que-lou.jpg', imageAlt: '从唐代木楼高处眺望落日、群山与黄河的情境复原图'
  },
  春晓: {
    historicalContext: '孟浩然诗中是春日清晨，但具体住所、日期和窗外景物没有可靠记录。',
    visualBasis: '用唐代朴素居室、席地寝具、木格窗和清晨鸟鸣复原感受，不画孟浩然面貌。',
    evidenceLevel: '情境复原', image: '/images/classics/chun-xiao.jpg', imageAlt: '从唐代朴素居室望向春日清晨花树和群鸟的情境复原图'
  },
  静夜思: {
    historicalContext: '李白此诗存在文本版本和写作地点争议，无法可靠指定为某座城市或某间房。',
    visualBasis: '只复原通用的唐代旅舍：木格窗、低榻、席和月光；人物背对观者，不作为李白肖像。',
    evidenceLevel: '部分可考', image: '/images/classics/jing-ye-si.jpg', imageAlt: '唐代旅舍里，月光透过木窗洒在地面如白霜的情境复原图'
  },
  古朗月行: {
    historicalContext: '诗句是李白对童年想象的文学表达，不是可定位、可摄影式还原的一次事件。',
    visualBasis: '以普通唐代庭院和匿名儿童对照圆月与白色圆盘，呈现比喻，不塑造幼年李白肖像。',
    evidenceLevel: '情境复原', image: '/images/classics/gu-lang-yue-xing.jpg', imageAlt: '唐代庭院中的孩子举起白色圆盘并指向满月的想象画面'
  },
  '望庐山瀑布（其二）': {
    historicalContext: '诗明确写庐山瀑布，但“三千尺”和“银河落九天”是夸张与想象，不是尺度记录。',
    visualBasis: '后续画面应以庐山高瀑和水雾为核心，不按诗句数字机械绘制，也不虚构李白肖像。',
    evidenceLevel: '史实较明确'
  },
  绝句: {
    historicalContext: '这组名句通常联系杜甫成都草堂时期；画面中的鸟、柳、青天比作者形象更可靠。',
    visualBasis: '后续采用唐代成都春景与朴素草堂视点，人物和建筑细节保持克制。',
    evidenceLevel: '部分可考'
  },
  赋得古原草送别: {
    historicalContext: '白居易以“赋得”体写古原草，关于应试和年龄的流行故事不能当作画面事实。',
    visualBasis: '后续只画古原、野火痕迹与新生春草，不画考场或固定地点。',
    evidenceLevel: '情境复原'
  },
  山行: {
    historicalContext: '杜牧诗中的具体山岭在后世有不同说法，不能把某个旅游景点直接认定为写作现场。',
    visualBasis: '后续以唐代山路、白云和秋林作通用情境，避免现代道路与景区设施。',
    evidenceLevel: '情境复原'
  },
  江雪: {
    historicalContext: '常把《江雪》联系到柳宗元永州时期，但诗中雪江是高度凝练的文学画面，并非实景记录。',
    visualBasis: '后续突出空山、雪江、孤舟与蓑笠，不把舟中人画成可识别的柳宗元。',
    evidenceLevel: '部分可考'
  },
  '悯农（其二）': {
    historicalContext: '作品传统署名李绅；诗关注农人午间劳作，不意味着作者本人就在田边观看。',
    visualBasis: '后续参考唐代壁画中的农耕、短衣劳动者和木柄农具，避免清代斗笠与近现代农具。',
    evidenceLevel: '部分可考'
  },
  小池: {
    historicalContext: '杨万里写初夏小池，但具体池塘位置和建筑环境没有必要强行确定。',
    visualBasis: '后续只围绕泉眼、细流、树荫和晴日柔光复原自然观察。',
    evidenceLevel: '情境复原'
  },
  题西林壁: {
    historicalContext: '苏轼于宋神宗元丰七年游庐山并写下题壁诗，庐山与西林寺背景较明确。',
    visualBasis: '后续用移动视点表现山形变化；寺院只作远景线索，不臆造当年题壁原貌。',
    evidenceLevel: '史实较明确'
  },
  惠崇春江晚景: {
    historicalContext: '这是苏轼为惠崇画作所题的诗，不是苏轼站在春江边写生的现场记录。',
    visualBasis: '后续应明确采用“北宋画中之景”的方式呈现竹、桃花、春江与鸭，不画苏轼在河岸。',
    evidenceLevel: '史实较明确'
  },
  春日: {
    historicalContext: '朱熹诗写“泗水”，但当时当地处于金朝控制，后世也有把它理解为追慕孔学的观点。',
    visualBasis: '后续只画象征性的万紫千红春景，不把朱熹画成在泗水实地踏青。',
    evidenceLevel: '部分可考'
  },
  宿新市徐公店: {
    historicalContext: '杨万里诗题提供“新市徐公店”线索，但店舍原貌与追蝶儿童身份不可考。',
    visualBasis: '后续用南宋乡村篱落、菜花和普通儿童服饰复原，不复制后世民居。',
    evidenceLevel: '部分可考'
  },
  忆江南: {
    historicalContext: '白居易是在离开江南后追忆当地景色，诗中的红花绿水是记忆和提炼，不是眼前写生。',
    visualBasis: '后续把画面处理成温暖、略带记忆感的唐代江南晨景，不画作者在现场。',
    evidenceLevel: '史实较明确'
  }
};

export const CLASSIC_BY_CHAR = new Map<string, ClassicConnection>();
for (const { targets, ...seed } of classics) {
  const classic: ClassicConnection = { ...seed, ...classicResearch[seed.title] };
  for (const char of targets) if (!CLASSIC_BY_CHAR.has(char)) CLASSIC_BY_CHAR.set(char, classic);
}
