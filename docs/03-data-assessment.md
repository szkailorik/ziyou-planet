# 字库、测评与复习规则

## 1. 字库实体

```ts
type CharacterEntry = {
  id: number;
  char: string;
  unicode: string;
  curriculumList: 1 | 2;
  productBand: 'seed' | 'core' | 'extended';
  pinyin?: string[];
  words?: string[];
  example?: string;
  scene?: string;
  confusables?: string[];
  englishBridges?: { zh: string; en: string }[];
  characterFamily?: { anchor: string; members: string[]; note: string };
  sourceId: string;
  contentStatus: 'basic' | 'reviewed';
};
```

完整 3500 字提供规范字、Unicode、课标字表层级和产品序号。代表性种子字提供审核过的拼音、词语、场景和易混字；其余内容逐步编辑完善。拼音和多音字必须绑定词语语境，不把多个读音平铺成无解释标签。

教材关系另表存储：

```ts
type TextbookOccurrence = {
  characterId: number;
  edition: string;
  grade: number;
  volume: '上' | '下';
  unit?: number;
  lesson?: string;
  requirement: 'recognize' | 'write';
  firstAppearance: boolean;
  sourceRef: string;
  reviewedBy: string[];
};
```

未经授权和复核时，界面不显示具体教材页码与频次，只显示“课标字表一/二”和已审核词语。

## 2. 事件是事实，状态是派生值

家庭设置保存 `children[]` 与 `activeChildId`。每个作答事件绑定不可变的 `childId`，切换 Kai、Lorik 或其他档案时只切换查询范围，不复制或混合进度。全家备份包含全部档案；单个档案删除时同步删除该 `childId` 的事件。

```ts
type AttemptEvent = {
  id: string;
  childId: string;
  characterId: number;
  mode: 'self-check' | 'pronunciation-choice' | 'meaning-choice' | 'context-choice';
  result: 'correct' | 'partial' | 'incorrect' | 'skipped';
  confidence?: 'sure' | 'unsure' | 'teach-me';
  latencyMs: number;
  hintUsed: boolean;
  occurredAt: string;
  ruleVersion: string;
};
```

所有状态都能从事件重算。不要只保存一个可被覆盖的“认识=true”。

## 3. 掌握状态

外部六态：

- 未测
- 初次接触
- 正在形成
- 基本掌握
- 稳定掌握
- 待复习/可能遗忘

首版规则：

- 自报 `sure`：记一次低权重正证据，安排客观复核，不直接稳定。
- `unsure`：进入 1 天内复习。
- `teach-me` 或错误：进入学习中，当天再次出现。
- 基本掌握：至少两次客观题正确，累计证据分达到阈值。
- 稳定掌握：至少两种题型正确，跨两个日期，且包含词境证据；首版快速扫描不会直接生成稳定掌握。
- 到期未复测或后续错误：标记待复习，置信分下降。

另外派生“识字自动化”指标，不把它混成一个模糊总分：

- 客观正确率：所有非自报题中的正确比例。
- 正确反应中位时间：最近 5 次该字无提示正确作答；全局报告最多看最近 100 次。
- 自动化：至少 3 次客观作答、正确率不低于 80%、正确中位时间不高于 3 秒，同时具备跨日和词句语境证据。
- 速度不能抵消错误；不同设备反应时只用于观察同一儿童趋势。

## 4. 复习调度

初始间隔为：同课内、1、3、7、14、30 天。根据结果调整：

- 无提示且反应流畅：进到下一间隔。
- 正确但较慢或用提示：保持当前间隔。
- 不确定：回到 1 天。
- 错误/请教我：回到同课内或当天。

这只是可解释的起始策略，不宣称对所有儿童最优；上线后用匿名、监护人同意的聚合指标校准。

## 5. 识字量估计

快速扫描只展示：已扫描数量、三档信心分布、需要客观复核数量，不把它直接等同于识字量。

后续自适应测评：

1. 按课标层级、产品难度、结构与频率分层。
2. 先抽约 60 题定位能力边界。
3. 在边界附近追加 40-60 题。
4. 每 6-8 题切换题型并允许休息。
5. 输出估计区间、置信度和样本量，而不是伪精确整数。

## 6. 报告口径

家长报告分开显示：

- 扫描自信度（家长/儿童主观信号）。
- 客观复核正确率。
- 基本掌握与稳定掌握数量。
- 识字量估计区间与可靠度。
- 认字与写字的不同掌握度。
- 各课程层级覆盖、易混字与未来 7 天到期字。

不显示未经可靠常模支持的“超过全国多少孩子”，不把反应时解释成聪明度。
