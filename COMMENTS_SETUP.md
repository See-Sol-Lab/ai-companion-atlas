# 互动功能部署配置

代码使用 Cloudflare Pages Functions、D1 与 Turnstile。仓库不保存任何生产密钥。

## 1. 创建并绑定 D1

1. 在 Cloudflare 控制台创建一个 D1 数据库。
2. 在 D1 控制台按文件名顺序执行 [`migrations/`](./migrations/) 目录内的 SQL 迁移。
3. 打开当前 Pages 项目的 **Settings → Bindings → D1 database bindings**，添加绑定：
   - Variable name：`COMMENTS_DB`
   - D1 database：刚创建的数据库
4. Preview 与 Production 环境分别确认一次绑定。

## 2. 配置 Turnstile

1. 创建 Turnstile Widget，并把正式域名与 `ai-companion-atlas.pages.dev` 加入允许域名。
2. 在 Pages 项目的 Variables and Secrets 中配置：
   - `TURNSTILE_SITE_KEY`：Widget Site Key（普通变量）
   - `TURNSTILE_SECRET`：Widget Secret Key（Secret）
   - `TURNSTILE_HOSTNAME`：正式站点主机名，例如 `atlas.example.com`（推荐；Pages 预览环境可留空）

## 3. 配置隐私与审核密钥

在 Pages 项目的 Secrets 中配置：

- `IP_HASH_SALT`：随机生成的长字符串，用于不可逆 IP 哈希与频控。
- `ADMIN_TOKEN`：随机生成的长字符串，用于访问审核 API。
- `COMMUNITY_AI_READ_TOKEN`：AI 读取社区 GET 接口时使用的独立 Bearer token；不被任何写接口接受。

留言审核页地址为 `/admin/comments/`，项目投稿后台为 `/admin/submissions/`，社区审核页为 `/admin/community/`。三页共用 `ADMIN_TOKEN` 与当前标签页的 `sessionStorage`。留言和社区内容可以通过或删除；投稿可以标记已处理或删除。

## 4. 部署后验收

1. 打开任一项目详情页，确认可以读取空状态并显示 Turnstile。
2. 提交一条测试留言，页面应提示“审核通过后会公开显示”，详情页不应立即出现该留言。
3. 在 `/admin/comments/` 通过测试留言。
4. 刷新项目详情页，最长 30 秒后应显示该留言。
5. 删除测试数据，确认审核页恢复为空。

## 5. Cloudflare 社区预览验收

1. 确认已执行 `migrations/0004_community.sql` 与 `0005_community_accounts.sql`，并配置 `COMMUNITY_AI_READ_TOKEN`。
2. 在 `/admin/community/` 生成一次性邀请码。
3. 未登录打开 `/community/`，确认被送到 `/community/login/`。
4. 使用邀请码、用户名与密码注册，确认邀请码不能再次注册。
5. 登录后确认可以浏览、发帖与回复；身份来自账号，不再逐次输入邀请码或验证码。
6. 禁用测试账号，确认其会话立即失效并返回登录页。
7. 用 AI 只读 token 调用社区 GET 接口，确认可以读取；调用 POST 接口应被拒绝。
8. Preview 验收期间不要运行香港 `atlas-deploy`；确认论坛形态后再决定是否接入正式站。

当前频控为同一 IP 哈希每 2 分钟最多 3 条；D1 中不保存原始 IP。

项目点赞只提供正向反馈。同一项目与同一 IP 哈希只记录一次，不提供点踩或取消点赞接口。

在线项目投稿只进入私有人工核验队列，不提供公开读取接口，也不会自动生成项目卡片。

官方配置参考：[Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/)、[Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)、[D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)。
