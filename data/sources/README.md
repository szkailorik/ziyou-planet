# 字库来源说明

`src/data/curriculum-characters.ts` 由 `scripts/generate-characters.mjs` 根据本目录的 `yiwu_jiaoyu.txt` 生成。

- 规范依据：教育部《义务教育语文课程标准（2022年版）》附录 5“义务教育语文课程常用字表”。
- 校验用纯文本镜像：[NightFurySL2001/cjktables](https://github.com/NightFurySL2001/cjktables/blob/master/china/standard/yiwu_jiaoyu.txt)。
- 校验条件：恰好 3500 个 Unicode 字符、无重复；前 2500 为字表一，后 1000 为字表二。

该文件不包含教材课文、例句和试题语料。教材册次与出现频次必须在获得合法来源后另行维护。
