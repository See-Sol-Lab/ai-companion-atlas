# AI Companion Atlas

项目卡片和详情页由项目数据统一生成。Time Anchor 是当前母模板。

新增项目时：

1. 复制 `projects/time-anchor.json`，改成新项目的文件名和内容。
2. 在仓库根目录运行 `node scripts/generate-projects.mjs`。
3. 检查首页卡片与 `projects/<slug>/` 详情页。

网站保持纯静态，不需要安装依赖。

匿名项目留言使用 Cloudflare Pages Functions、D1 与 Turnstile。部署前按 [`COMMENTS_SETUP.md`](./COMMENTS_SETUP.md) 配置数据库绑定与 Secrets。

项目推荐支持首页在线投稿与 GitHub Issue 两条路径。在线投稿仅进入私有后台人工核验，不会自动公开或收录。
