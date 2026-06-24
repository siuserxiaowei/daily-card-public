# Daily Learning Cards

<!-- SIUSER-REPO-GUIDE:START -->
## 项目介绍 / Project Introduction

### 中文
日报知识卡片：公开输出 AI 摘要、知识卡片和内容设计实验。

### English
Daily knowledge cards for public AI summaries, knowledge-card output, and content design experiments.

## 使用方式 / Usage

### 中文
1. 优先打开在线入口或本地静态服务查看最终页面。
2. 内容型仓库通常从 `README.md`、`docs/`、`data/` 或 `content/` 开始阅读。
3. 更新资料后，重新生成或刷新静态页面，并检查链接、图片和文字是否正常。

### English
1. Start with the live link or a local static server to view the final page.
2. For content repositories, begin with `README.md`, `docs/`, `data/`, or `content/`.
3. After updating material, regenerate or refresh the static page and check links, images, and copy.

## 入口与元信息 / Entry Points & Metadata

- GitHub 仓库 / Repository: https://github.com/siuserxiaowei/daily-card-public
- Live / 在线入口：https://siuserxiaowei.github.io/daily-card-public/
- 默认分支 / Default branch: `main`
- 主要语言 / Primary language: `HTML`
- 可见性 / Visibility: `public`
- 仓库类型 / Repository type: `source`
- Topics / 主题：`ai`, `daily-report`, `github-pages`, `knowledge-cards`, `wechat`

## 本地运行 / Local Run

```bash
git clone https://github.com/siuserxiaowei/daily-card-public.git
cd daily-card-public
python3 -m http.server 8000
```

## 仓库结构 / Repository Map

| 路径 / Path | 中文说明 | English |
| --- | --- | --- |
| `README.md` | 项目入口说明，先读这里。 | Main project entry point and orientation. |
| `index.html` | 静态站首页或页面入口。 | Static-site homepage or entry page. |
| `assets` | 图片、样式、数据等资源。 | Images, styles, data, and other assets. |
| `scripts` | 构建、同步、生成或维护脚本。 | Build, sync, generation, or maintenance scripts. |
| `2026-05-26-selected-groups` | 项目文件或目录。 | Project file or directory. |
| `events` | 项目文件或目录。 | Project file or directory. |
| `google-io-2026` | 项目文件或目录。 | Project file or directory. |
| `groups` | 项目文件或目录。 | Project file or directory. |
| `knowledge` | 项目文件或目录。 | Project file or directory. |
| `.gitignore` | 项目文件或目录。 | Project file or directory. |
| `2026-05-03 学习卡片.html` | 项目文件或目录。 | Project file or directory. |
| `2026-05-04 内容创作专题.html` | 项目文件或目录。 | Project file or directory. |

## 维护备注 / Maintenance Notes

- 中文：当项目目标、在线入口、运行命令或目录结构变化时，同步更新本说明。
- English: Keep this guide updated when the project purpose, live link, run commands, or structure changes.
- 中文：修改代码、数据或生成页面后，优先运行相关构建、测试或校验命令。
- English: After changing code, data, or generated pages, run the relevant build, test, or validation command.

## 安全与隐私 / Safety & Privacy

- 中文：不要提交 API key、token、密码、cookie、私有链接或内部账号资料。
- English: Do not commit API keys, tokens, passwords, cookies, private URLs, or internal account data.
- 中文：公开 GitHub Pages 前，确认资料已脱敏并允许公开。
- English: Before publishing GitHub Pages output, confirm the material is redacted and cleared for public release.
<!-- SIUSER-REPO-GUIDE:END -->



<!-- SIUSER-SEO-INTRO:START -->

## 项目介绍 / Project Introduction

**中文介绍**：`daily-card-public` 是公开版日报与知识卡片主输出，用于沉淀 AI 摘要、内容视觉化、长图排版和可分享的脱敏学习素材。

**English**: `daily-card-public` is the main public output for daily cards and knowledge cards, publishing privacy-preserving AI summaries, visualized content, long-image layouts, and shareable learning assets.

**SEO 关键词 / SEO Keywords**: daily card, AI summary, knowledge card, content design, 长图排版, 内容视觉化

<!-- SIUSER-SEO-INTRO:END -->

每日由 AI 从社群讨论、个人学习素材和公开资料中浓缩出来的学习卡片与专题日报（脱敏分享版）。这里展示的是 `daily-card-public` 的公开输出，不是完整聊天记录归档。

🌐 **在线浏览**: https://siuserxiaowei.github.io/daily-card-public/

## 项目介绍

`daily-card-public` 是一个面向个人学习和社群复盘的公开知识卡片库，也是这个流程的主输出站点。它把每天分散在社群讨论、个人笔记和公开资料里的高价值信息，按主题压缩成更容易阅读、检索和转发的 HTML 卡片。

我关注的方向主要包括 AI 编程、AI 模型、出海独立开发、产品增长、内容创作、投资商业和电商等。这个仓库不是完整聊天记录存档，而是经过 AI 总结、人工筛选和脱敏处理后的公开学习入口。

适合这些使用场景：

- 每天快速浏览 AI/独立开发/商业增长相关讨论重点
- 回看某一天或某个专题的学习卡片
- 把社群里的碎片信息沉淀为可检索资料
- 给朋友或团队分享一份更干净的日报页面

## 这是什么

AI 替我梳理 AI 编程 / 出海 / 内容创作 / 独立开发方向的社群讨论和学习素材,
把每天**有学习价值的内容浓缩成一张知识卡片** — 保留观点、工具和链接，不发布完整聊天上下文。

每天早 8:30 自动更新一次。

## 内容结构

- `index.html`：公开首页，汇总最近更新的日报和专题卡片。
- `YYYY-MM-DD 学习卡片.html`：每日综合学习卡片。
- `YYYY-MM-DD AI编程专题.html`：AI 编程与工具链专题。
- `YYYY-MM-DD AI模型专题.html`：模型能力、产品更新和使用经验。
- `YYYY-MM-DD 出海独立开发专题.html`：独立开发、增长、分发和商业化。
- `YYYY-MM-DD 产品增长专题.html`：产品、运营、获客和用户增长。
- `groups/`、`knowledge/`：按群组或知识主题整理的索引页面。

## 为什么公开

- 卡片里只保留**观点 + 链接 + 工具名**,不含具体群名 / 群成员对话原文
- 帮朋友也省时间 — 一份卡片 ≈ 替你过滤一整天的高噪音信息流
- 让学习内容从“刷过就没了”变成“可以复查、可以引用、可以继续生长”

## 脱敏原则

- 不公开原始聊天记录。
- 不公开群成员姓名、微信号、手机号等个人信息。
- 不把私密社群内容包装成公开来源。
- 只保留具有学习价值的观点、工具、链接和二次整理结论。

## 技术栈

- [Obsidian](https://obsidian.md) (vault)
- [jackwener/wx-cli](https://github.com/jackwener/wx-cli) (本地素材读取)
- Python (扫描 + 渲染)
- [Claude Sonnet 4.5](https://www.anthropic.com/claude) (AI 浓缩)
- GitHub Pages (托管)

## 适合谁看

- 想跟进 AI 工具、AI 编程和独立开发趋势的人
- 做社群运营、知识管理、日报自动化的人
- 想参考“AI 如何把聊天信息整理成公开卡片”的开发者
- 想用 GitHub Pages 做轻量知识库的人

## License

CC BY 4.0 — 个人非商业使用,转载请注明出处。

<!-- SIUSER-CONTACT:START -->

## 联系我 / Contact

想交流 AI 工具、内容自动化、SEO、私域增长或项目合作，可以扫码加我微信。

For collaboration on AI tools, content automation, SEO, private-domain growth, or product experiments, scan the WeChat QR code below.

<img src="https://raw.githubusercontent.com/siuserxiaowei/siuserxiaowei/main/assets/contact/wechat-qrcode.jpg" width="180" alt="WeChat QR code / 微信二维码" />

**关键词 / Keywords**: daily card, AI summary, knowledge card, content design, AI tools, AI automation, GitHub Pages, SEO

<!-- SIUSER-CONTACT:END -->
