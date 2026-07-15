import { PRIMARY_POEMS } from '../src/data/primary-poems.ts';

const dynastyGuidance: Record<string, string> = {
  汉: '汉代平民服饰、木构与生产器具参考出土画像材料；朴素实用，不使用唐宋明清式宫装。',
  北朝: '北朝北方草原与农牧交界环境，服饰体现北方民族传统与汉化并存；避免清代旗装和现代蒙古旅游服。',
  唐: '盛唐至中晚唐的交领袍衫、襦裙、幞头、木构和交通器具，阶层与场景相称；避免明清服饰。',
  宋: '宋代克制雅致的襕衫、褙子、巾帽、木构市井或乡居，参考宋画生活细节；避免现代景区复建物。',
  元: '元代文人画语境，纸墨、服饰与书斋器物克制，重点保留水墨留白。',
  明: '明代平民劳动服、石灰窑和工具按工艺场景呈现，不画戏服式官员肖像。',
  清: '清代乡野儿童与文人画语境按题材分别处理，衣着朴素；避免影视宫廷装与民国元素。'
};

const manifest = PRIMARY_POEMS.filter((poem) => poem.image.startsWith('/images/poems/')).map((poem) => ({
  slug: poem.slug,
  prompt: [
    'Use case: historical-scene.',
    'Asset type: 小学诗词馆的 3:2 横向原创插画，1280×853 或同等比例。',
    `Primary request: 为${poem.dynasty}代${poem.author}《${poem.title}》创作一幅让 7—12 岁儿童看图就能进入诗意的历史场景。`,
    `Poem: ${poem.lines.join('')}`,
    `Learning objective: ${poem.interpretation}`,
    `Scene and composition: ${poem.visualBasis}`,
    `Historical constraints: ${dynastyGuidance[poem.dynasty]} ${poem.historicalContext}`,
    `Mood and lighting: ${poem.mood}。用天气、光线、空间和人物动作表达，不依赖文字说明。`,
    'Style: 有审美质感的中国儿童历史绘本，温润矿物色与淡墨肌理，形体清楚、细节可信、留白适度；不是照片，不模仿任何在世艺术家。',
    'People: 只画匿名人物与背影或远景，除非诗句明确要求也不画作者肖像；儿童人物自然、不幼稚化。',
    'Avoid: 现代物件、现代景区建筑、年代错误服饰、日式或韩式服装、仙侠宫殿、电子游戏感、过度卡通、大头人物、血腥战争、浮空文字、汉字、书法、题款、印章、边框、logo、水印。',
    'No text anywhere in the image.'
  ].join('\n')
}));

process.stdout.write(JSON.stringify(manifest));
