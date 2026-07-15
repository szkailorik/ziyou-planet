# 跨设备同步设计

## 结论

学习数据不存放在 GitHub。GitHub 仓库只保存源代码、字库构建脚本和不含个人学习记录的产品文档。

生产环境采用三层结构：

1. 浏览器 IndexedDB（Dexie）保存完整本地副本，保证断网可学习。
2. 同域 Pages Functions 提供同步 API，不向前端暴露 Cloudflare 管理凭证。
3. Cloudflare D1 保存家庭设置、设备会话和追加式作答事件，供不同设备合并读取。

## 为什么不用 GitHub Token 存数据

Personal Access Token 是开发者凭证，不是终端用户登录机制。若把它放进浏览器，本机脚本、浏览器扩展或 XSS 都可能读取它；令牌权限也很难精确限制为“只能读写 Kai、Lorik 的学习记录”。Git 提交模型还会造成频繁冲突、历史数据难删除、API 限流和仓库膨胀。

GitHub 仍用于代码版本管理和部署追踪，但不接收儿童学习事件、家庭同步码、家长 PIN 或设备会话。

## 家庭身份与设备加入

- 第一个设备在家长中心设置 6 位家长 PIN，并建立家庭空间。
- 服务端生成约 80 bit 随机性的 `ZIYOU-XXXX-XXXX-XXXX-XXXX` 家庭同步码。
- 新设备需要同时输入同步码和家长 PIN。
- 加入成功后，服务端下发随机设备会话 Cookie；Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Strict`，前端 JavaScript 不可读取。
- D1 只保存同步码的 SHA-256 摘要、PBKDF2 派生后的 PIN 摘要和设备令牌摘要，不保存明文。
- 家长可从任一已连接设备生成新同步码。旧同步码立即失效，已连接设备不退出。

家庭同步码是恢复凭证，应与 PIN 分开保管。产品不要求儿童真实姓名、学校、生日、手机号或邮箱。

## 数据表

### `families`

保存家庭 ID、同步码摘要、PIN 盐与摘要、当前家庭设置 JSON、设置更新时间。

### `devices`

保存设备会话令牌摘要、家庭 ID、设备标签、创建时间和最近使用时间。退出本设备时只删除对应会话。

### `attempts`

保存不可变作答事件。主键为 `(family_id, attempt_id)`，同一事件重复上传会被 `INSERT OR IGNORE` 去重。

## 合并规则

- 作答事件采用追加合并，以 UUID 去重，不用“最后写入覆盖整个历史”。
- 家庭设置采用带时间戳的 last-write-wins。儿童档案被确认删除后，服务端删除该儿童的云端事件。
- 旧设备上传的设置时间早于云端时，不能恢复已删除档案；它提交的孤儿事件也会被过滤。
- 新设备加入时先下载家庭快照，不会把该设备自动生成的空白 Kai/Lorik 档案上传覆盖家庭数据。
- 每次学习先写本机，网络恢复后约 1.2 秒防抖自动同步；家长也可手动点击“立即同步”。

## 隐私与安全边界

- 所有写请求检查同源 `Origin`；会话 Cookie 使用 Strict SameSite，降低 CSRF 风险。
- 请求体上限 12 MB；家庭最多 8 个儿童档案、50,000 条作答事件，并执行与本地备份一致的字段校验。
- Cloudflare D1 绑定只存在于 Pages Functions 运行环境，浏览器拿不到数据库管理凭证，也拿不到 Wrangler OAuth 凭证。
- 学习内容和掌握度仍可完全离线运行。云同步失败只显示状态，不阻断儿童作答。
- 当前版本不是端到端加密：Cloudflare 平台负责传输与静态加密，服务端函数能读取同步所需的结构化学习数据。若未来进入学校或机构场景，应增加数据驻留、监护人同意、审计、删除导出 SLA 和适用法律评估。

## 部署

创建数据库：

```bash
npx wrangler d1 create ziyou-planet-data --location=apac
```

执行生产迁移：

```bash
npx wrangler d1 migrations apply ziyou-planet-data --remote
```

`wrangler.jsonc` 中的 `ZIYOU_DB` 绑定会把 D1 提供给 `/functions/api/sync/[[path]].ts`。部署仍使用：

```bash
npm run deploy:cloudflare
```

验收至少覆盖：创建家庭、写入事件、第二设备加入、第二设备读取同一事件、重复上传去重、错误 PIN 拒绝、退出后会话失效、断网时本地学习不受影响。
