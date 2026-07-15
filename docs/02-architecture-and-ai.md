# 架构与大模型选型

## ADR-001：PWA 优先，不先做 macOS 专用程序

状态：接受。

首版使用 React + TypeScript + Vite 构建响应式 PWA。它能覆盖 Mac、Windows、iPad 和安卓平板；首次加载后可离线运行。macOS Sonoma 14 及以上可把网站“添加到 Dock”作为独立 Web App 使用。

原生 Mac 应用推迟到确需 App Store、Keychain、系统级家长控制或本地视觉/语音模型时，再以 Tauri 封装同一领域层。现在直接做原生会把产品限制在 Mac，并增加签名、公证、沙箱和平台专属维护。

参考：[Apple：Use Safari web apps on Mac](https://support.apple.com/en-ie/104996)、[MDN：离线 PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)。

## ADR-002：本地优先、家庭同步可选

```text
版本化课程字库
      │
      ▼
PWA 应用壳 ─ Service Worker 缓存
      │
      ▼
纯 TypeScript 领域层
  ├─ 扫描与作答事件
  ├─ 掌握度状态机
  ├─ 间隔复习队列
  └─ 报告统计
      │
      ▼
IndexedDB 本地存储
  ├─ 轻量儿童档案
  ├─ 作答事件
  ├─ 字符掌握快照
  └─ 设置/内容版本

监护人可选开启：
同域 Pages Functions → D1 家庭空间
  ├─ HttpOnly 设备会话
  ├─ 家庭设置的版本合并
  └─ 追加式作答事件去重

监护人可选开启：
脱敏摘要 → 自有 AI Gateway → 模型适配器 → 受约束建议
```

核心域逻辑不得依赖 React，使其以后可复用到 Tauri、移动端或服务端。默认只使用本地数据库；家长可主动开启不要求邮箱、手机号或儿童实名的家庭同步。调用 `navigator.storage.persist()` 争取持久存储，同时提供显眼的备份与恢复，因为浏览器数据仍可能被用户清理。云端同步细节见 [跨设备同步设计](06-cross-device-sync.md)。

参考：[MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)、[MDN 存储配额与清理](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)。

## ADR-003：确定性评估，大模型不裁决

核心掌握度由事件和版本化规则重算。相同事件序列必须产生相同结果。模型不得直接修改分数、教材出处或复习时间。

大模型适合：

- 依据“允许字白名单 + 目标字”生成候选短句/故事。
- 把结构化数据改写成家长易懂的周报。
- 对易混字给出受约束的练习建议。
- 开发阶段批量生成候选内容，再由编辑审核。

大模型不适合：

- 决定孩子是否认识某字。
- 决定规范字表或教材事实。
- 与儿童进行无边界开放聊天。
- 接收真实姓名、学校、原始录音、照片或完整轨迹。
- 输出未经校验的读音、笔顺、教材频次。

## ADR-004：模型路由，不全部用 Sol

默认路径是 **0 次模型调用**。如果二期启用 AI，模型网关按风险和复杂度路由：

| 任务 | 默认方案 | 建议模型档位 |
| --- | --- | --- |
| 日常识字评估、复习调度 | 确定性本地规则 | 不用模型 |
| 短句候选、结构化分类 | 严格 JSON + 白名单 + 缓存 | 低成本高频模型 |
| 家长周报 | 脱敏聚合数据 + 模板回退 | 平衡型模型 |
| 内容批量审校、疑难案例 | 人工复核的离线生产流程 | 旗舰推理模型 |

截至 2026-07-15，OpenAI 官方建议复杂任务用 GPT-5.6 Sol，成本/能力平衡用 Terra，高频成本敏感用 Luna。因此即使国际版使用 OpenAI，运行时也应优先 Luna/Terra，Sol 只用于少量困难内容生产，而不是每张字卡。[OpenAI 模型目录](https://developers.openai.com/api/docs/models)

中国大陆儿童数据默认不走海外模型。若接入境内模型，也必须经过自有网关；业务代码只依赖内部任务名，例如 `sentence_candidate_v1`，不硬编码厂商模型名。固定模型快照、限制 token、按摘要哈希缓存、设置日/月预算，供应商失败直接回退静态内容。

## ADR-005：未成年人安全与隐私

默认只生成随机 ID 和昵称，不要求真实姓名、学校、班级、生日、手机号或定位。默认不保存原始录音、照片和手写图。家庭云同步必须由家长主动建立；GitHub 仅保存代码，不保存学习轨迹或家庭凭证。

以后若增加云端识音：

- 由监护人单独开启并显著告知。
- 只上传完成识别所需的短音频。
- 默认识别后删除，不进入训练集。
- 低置信结果交由家长复核，不直接判错。

中国《个人信息保护法》把不满十四周岁未成年人的个人信息列为敏感个人信息；《儿童个人信息网络保护规定》要求目的明确、必要最小、显著告知和监护人同意。OpenAI 的未成年人 API 指南同样要求额外保护、适龄过滤与数据最小化，并对 13 岁以下个人数据提出零数据保留前置要求。

- [全国人大：《个人信息保护法》](https://www.npc.gov.cn/npc/c2/c30834/202108/t20210820_313088.html)
- [国家网信办：《儿童个人信息网络保护规定》](https://www.cac.gov.cn/2019-08/23/c_1124913903.htm)
- [OpenAI：Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)

## AI 输出门禁

运行时生成内容必须通过：JSON Schema、目标字存在校验、允许字比例、句长/年级限制、敏感内容过滤、读音/释义词典校验和模板回退。界面显示“AI 生成建议”，不得伪装成教材原文或老师结论。
