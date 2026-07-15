import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pinyin } from 'pinyin-pro';

const input = process.argv[2] ?? 'data/sources/yiwu_jiaoyu.txt';
const output = process.argv[3] ?? 'src/data/curriculum-characters.ts';
const raw = await readFile(input, 'utf8');
const rows = raw
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/)[0]);

if (rows.length !== 3500) {
  throw new Error(`Expected 3500 characters, got ${rows.length}`);
}
if (new Set(rows).size !== rows.length) {
  throw new Error('Duplicate characters found in source list');
}

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
const pinyins = rows.map((char) => pinyin(char, { toneType: 'symbol' }));
const content = `/**\n * 义务教育语文课程常用字表（3500 字）\n * 顺序与教育部课程标准附录一致；1-2500 为字表一，2501-3500 为字表二。\n * 生成源：NightFurySL2001/cjktables 对公开标准的纯文本整理。\n */\nexport const CURRICULUM_CHARACTERS = ${JSON.stringify(rows.join(''))} as const;\nexport const CURRICULUM_PINYIN = ${JSON.stringify(pinyins)} as const;\n\nexport const CURRICULUM_CHARACTER_COUNT = Array.from(CURRICULUM_CHARACTERS).length;\n`;
await writeFile(output, content);
console.log(`Wrote ${rows.length} unique characters to ${output}`);
