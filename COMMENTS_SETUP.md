# 匿名留言 V1 部署配置

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

审核页地址为 `/admin/comments/`。输入 `ADMIN_TOKEN` 后可读取 pending 留言，并执行通过或删除；令牌仅保存在当前标签页的 `sessionStorage`。

## 4. 部署后验收

1. 打开任一项目详情页，确认可以读取空状态并显示 Turnstile。
2. 提交一条测试留言，页面应提示“审核通过后会公开显示”，详情页不应立即出现该留言。
3. 在 `/admin/comments/` 通过测试留言。
4. 刷新项目详情页，最长 30 秒后应显示该留言。
5. 删除测试数据，确认审核页恢复为空。

当前频控为同一 IP 哈希每 10 分钟最多 3 条；D1 中不保存原始 IP。

项目点赞只提供正向反馈。同一项目与同一 IP 哈希只记录一次，不提供点踩或取消点赞接口。

官方配置参考：[Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/)、[Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)、[D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)。
