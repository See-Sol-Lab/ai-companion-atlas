# Atlas card copy schema

The directory card is a navigation preview. Full research belongs in the detail page below the hero (`intro` / `facts`).

## Four visible copy layers

1. `name.zh` — display title.
   - If the project has a Chinese name, use only that Chinese name.
   - Do not append positioning copy with `·`, `：`, dashes, or helper phrases.
   - If the project has no Chinese name, put the official English project name here.

2. `name.en` — English project name.
   - When `name.zh` is Chinese, this becomes the second line.
   - When the project name is already English, keep the same official English name here; the renderer suppresses the duplicate second line.

3. `hook` — one concise positioning sentence or phrase.
   - Say what the project is, not the full feature list.
   - Good: `AI 小手机`, `角色扮演游戏`, `跨窗口上下文网关`, `会做事的长期伴侣`.

4. `summary` — short directory detail.
   - Maximum target: 150 Chinese characters / equivalent length.
   - Desktop rendering is capped at three lines.
   - Keep only the few capabilities needed to understand the project at a glance.

## Detail hero

`heroDescription` should also stay concise: one short paragraph, normally within 150 Chinese characters / equivalent length. Put implementation details, limitations, licensing nuance, upstream relationships, and technical evidence in `intro.paragraphs` and `intro.facts`.

## Example

```json
{
  "name": { "zh": "万花筒", "en": "Kaleidoscope RP" },
  "hook": "角色扮演游戏",
  "summary": "面向一个人和一个 AI 的自托管长线 RP 后端：词槽生成世界，主角可主动召唤旁白或 NPC，并用红线和滚动摘要维持边界与连续性。"
}
```

Do not turn the title, hook, and summary into three repetitions of the same long description.
