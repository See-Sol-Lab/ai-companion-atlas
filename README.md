# AI Companion Atlas

项目卡片和详情页由项目数据统一生成。Time Anchor 是当前母模板。

新增项目时：

1. 复制 `projects/time-anchor.json`，改成新项目的文件名和内容。
2. 在仓库根目录运行 `node scripts/generate-projects.mjs`。
3. 检查首页卡片与 `projects/<slug>/` 详情页。

网站保持纯静态，不需要安装依赖。
