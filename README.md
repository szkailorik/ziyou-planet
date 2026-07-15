# 字游星球

面向小学阶段儿童的本地优先识字训练 PWA。产品把“快速认识更多字”拆成可解释的诊断、短回合学习、跨日复测和家长报告，并把儿童学习界面与家长数据界面分开。可选家庭云同步使用 Cloudflare D1，让同一家庭在多台设备上继续学习；断网时仍使用本机数据。

默认建立 Kai 与 Lorik 两个独立档案，也可以在家长中心继续添加。每个孩子拥有独立的扫描记录、复习队列、掌握度和报告。

## 文档

- [研究与产品需求](docs/01-research-and-prd.md)
- [架构与模型选型](docs/02-architecture-and-ai.md)
- [字库、测评与复习规则](docs/03-data-assessment.md)
- [开发计划与验收标准](docs/04-development-plan.md)
- [集中识字、词语与句子设计](docs/05-concentrated-literacy-design.md)
- [跨设备同步与安全设计](docs/06-cross-device-sync.md)

## 项目原则

- 课程标准是字库边界，模型记忆不是数据源。
- “点一次认识”只是自信度信号，不等于稳定掌握。
- 核心学习、评估、报告离线可运行，大模型是可关闭的增强项。
- 不要求儿童真实姓名、学校、生日、手机号；云同步由家长主动开启。
- 教材位置和出现频次只展示可追溯、版本化、获得合法使用权的数据。

## 本地运行

```bash
npm install
npm run dev
```

验证与生产构建：

```bash
npm run test
npm run build
```

课程字表源文件已放在 `data/sources/yiwu_jiaoyu.txt`。只有更新字表源时才需要运行 `npm run generate:data`；生成脚本会校验 3500 字且无重复。

构建产物位于 `dist/`。首次在线加载生产构建后，Service Worker 会缓存应用壳与完整字库；Mac 的 Safari 可使用“添加到 Dock”安装为独立 Web App。

部署到 Cloudflare Pages：

```bash
npm run deploy:cloudflare
```

部署配置位于 `wrangler.jsonc`；`public/_headers` 提供安全与缓存头，`public/_redirects` 保证单页应用路由可回退到首页。同步 API 位于 `functions/api/sync/[[path]].ts`，D1 结构由 `migrations/` 管理。首次部署同步后先执行：

```bash
npx wrangler d1 migrations apply ziyou-planet-data --remote
```

## 当前完成度

本仓库是可运行的 P0：家庭多儿童档案、3500 字底库、熟悉度扫描、字—词—句反馈、审核字客观读音复核、确定性掌握度、间隔复习、字册、家长报告、本地备份、PWA，以及可选的 D1 家庭跨设备同步均已实现。GitHub 只保存代码，不保存家庭学习记录。逐册教材出处、完整 300 基本字的人工词语/多音字审核、自适应识字量区间及可选 AI 属于 P1，不能把自动生成的基础拼音当成已审教材事实。
