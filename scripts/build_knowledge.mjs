import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PUBLIC_ROOT = path.resolve(process.cwd());
const CACHE_ROOT = process.env.DEEP_DIVE_CACHE || '/tmp/deep_dive_cache';
const KNOWLEDGE_ROOT = path.join(PUBLIC_ROOT, 'knowledge');
const DATA_ROOT = path.join(KNOWLEDGE_ROOT, 'data');
const RANGE = { start: '2026-04-07', end: '2026-05-06' };
const USE_CLAUDE = process.env.SKIP_CLAUDE !== '1';

const GROUPS = [
  {
    name: '『闲聊』海边晒太阳',
    cacheDir: '闲聊_海边晒太阳-e0fd9ca8',
    slug: '闲聊-海边晒太阳-e0fd9ca8',
    mark: 'CHAT',
    accent: 'ocean',
    target: 72,
  },
  {
    name: '赫兹的朋友们~出海交流',
    cacheDir: '赫兹的朋友们_出海交流-ff5659a4',
    slug: '赫兹的朋友们-出海交流-ff5659a4',
    mark: 'GLOBAL',
    accent: 'teal',
    target: 66,
  },
  {
    name: 'MH-2026赛季',
    cacheDir: 'MH-2026赛季-f78a82d2',
    slug: 'MH-2026赛季-f78a82d2',
    mark: 'MH26',
    accent: 'gold',
    target: 92,
  },
  {
    name: '哥飞的朋友们⑦',
    cacheDir: '哥飞的朋友们⑦-5412575b',
    slug: '哥飞的朋友们-5412575b',
    mark: 'GF7',
    accent: 'blue',
    target: 58,
  },
  {
    name: '哥飞的朋友们⑪',
    cacheDir: '哥飞的朋友们⑪-8f703d5c',
    slug: '哥飞的朋友们-8f703d5c',
    mark: 'GF11',
    accent: 'violet',
    target: 58,
  },
  {
    name: '出海独立开发交流群 - Asnull',
    cacheDir: '出海独立开发交流群_-_Asnull-b952374a',
    slug: '出海独立开发交流群-Asnull-b952374a',
    mark: 'INDIE',
    accent: 'green',
    target: 62,
  },
  {
    name: '君言戏语VIP读者群',
    cacheDir: '君言戏语VIP读者群-2417598a',
    slug: '君言戏语VIP读者群-2417598a',
    mark: 'VIP',
    accent: 'red',
    target: 30,
  },
  {
    name: '出海研习社「第四期」',
    cacheDir: '出海研习社_第四期-ac00c3ce',
    slug: '出海研习社-第四期-ac00c3ce',
    mark: 'STUDY',
    accent: 'ink',
    target: 26,
  },
];

const CATEGORY_ORDER = ['产品增长', '出海', 'AI编程', '商业投资', '工具资源', '方法论', '风险合规', '其他'];
const CATEGORY_ALIASES = new Map([
  ['增长', '产品增长'],
  ['产品', '产品增长'],
  ['海外', '出海'],
  ['独立开发', '出海'],
  ['AI 编程', 'AI编程'],
  ['编程', 'AI编程'],
  ['投资', '商业投资'],
  ['商业', '商业投资'],
  ['工具', '工具资源'],
  ['资源', '工具资源'],
  ['风险', '风险合规'],
  ['合规', '风险合规'],
]);

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function attr(value) {
  return htmlEscape(value).replaceAll('\n', ' ');
}

function stripMarkdown(value) {
  return String(value ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 $2')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutUrls(value) {
  return stripMarkdown(value)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b(www\.)?\w+\.(com|ai|app|fun|co|io|net|org|cn)\b/gi, (match) => match)
    .replace(/\s+/g, ' ')
    .trim();
}

function firstUsefulClause(value, max = 70) {
  const text = withoutUrls(value)
    .replace(/^[\-—\s]+/g, '')
    .replace(/记录时间[:：]?\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/---\d{4}-\d{2}-\d{2}---/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = text
    .split(/(?:。|；|;|\n| {2,}|-{6,}|[，,](?=.{12,}$))/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 5 && !/^(网址|地址|注册|上架|产品|流量|下载|收入|详情见)[:：]/.test(item));
  return truncate(parts[0] || text, max);
}

function truncate(value, max = 120) {
  const text = stripMarkdown(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function truncateClean(value, max = 120) {
  const text = withoutUrls(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function cleanUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw.startsWith('http')) return '';
  return raw.replace(/[，。；、)\]）】]+$/g, '');
}

function domainOf(url) {
  try {
    return new URL(cleanUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeCategory(category, fallback = '其他') {
  const value = String(category ?? '').trim();
  if (CATEGORY_ORDER.includes(value)) return value;
  if (CATEGORY_ALIASES.has(value)) return CATEGORY_ALIASES.get(value);
  for (const [key, alias] of CATEGORY_ALIASES.entries()) {
    if (value.includes(key)) return alias;
  }
  return fallback;
}

function pointCategoryFromText(point, fallback) {
  const text = `${point.category ?? ''} ${point.title ?? ''} ${point.summary ?? ''} ${(point.tags ?? []).join(' ')}`;
  if (/合规|协议|下架|封号|泄露|风险|法务|侵权|API key|key/i.test(text)) return '风险合规';
  if (/Claude|Codex|Cursor|Agent|MCP|API|代码|编程|模型|OpenAI|DeepSeek|Gemini/i.test(text)) return 'AI编程';
  if (/TikTok|出海|Stripe|收款|SEO|海外|独立开发|Google Play|App Store/i.test(text)) return '出海';
  if (/MRR|收入|利润|下载|投流|广告|转化|增长|留存|KOL|creator|ROI|爆款|流量/i.test(text)) return '产品增长';
  if (/融资|估值|投资|商业|月入|现金流|利润/i.test(text)) return '商业投资';
  if (/工具|资源|网站|平台|库|插件|模板|教程/i.test(text)) return '工具资源';
  return normalizeCategory(point.category, fallback);
}

function jsonFilesForGroup(group) {
  const dir = path.join(CACHE_ROOT, group.cacheDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort()
    .map((file) => path.join(dir, file));
}

function readGroupCandidates(group) {
  const rows = [];
  const dailyStats = [];
  for (const file of jsonFilesForGroup(group)) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    dailyStats.push({
      date: data.date,
      messages: Number(data.message_count ?? 0),
      signals: Number(data.candidate_signal_count ?? 0),
      selected: Number(data.selected_count ?? 0),
    });
    for (const c of data.candidates ?? []) {
      const excerpt = stripMarkdown(c.excerpt || c.body || '');
      const urls = Array.from(new Set((c.urls ?? []).map(cleanUrl).filter(Boolean))).slice(0, 4);
      const score = Number(c.score ?? 0);
      const category = normalizeCategory(c.category);
      const weakOther = category === '其他' && score < 20;
      const musicOnly = /网易云|Sia -|This Is Acting|Unstoppable/i.test(excerpt) && urls.length <= 1;
      if (excerpt.length < 12 || weakOther || musicOnly) continue;
      rows.push({
        group: group.name,
        slug: group.slug,
        date: c.date || data.date,
        time: c.time || '',
        category,
        score,
        body: excerpt,
        urls,
        signals: c.signals ?? [],
        hasMetric: Boolean(c.has_metric),
      });
    }
  }
  return { rows, dailyStats };
}

function selectClaudeInput(candidates, group) {
  const limit = Math.max(group.target * 3, group.slug.includes('MH-2026') ? 280 : 150);
  const ranked = [...candidates]
    .sort((a, b) => {
      const metricBoost = Number(b.hasMetric) - Number(a.hasMetric);
      if (metricBoost) return metricBoost;
      return b.score - a.score;
    })
    .slice(0, Math.min(limit, candidates.length))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  return ranked.map((c, index) => {
    const links = c.urls.length ? `\nlinks: ${c.urls.slice(0, 3).join(' ')}` : '';
    return `ID ${index + 1}
date: ${c.date} ${c.time}
category: ${c.category}
score: ${c.score}
excerpt: ${truncate(c.body, 520)}${links}`;
  }).join('\n\n');
}

function schemaForPoints() {
  return JSON.stringify({
    type: 'object',
    additionalProperties: false,
    required: ['points'],
    properties: {
      points: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'summary', 'takeaway', 'category', 'date', 'importance', 'source_quote', 'urls', 'tags'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            takeaway: { type: 'string' },
            category: { type: 'string' },
            date: { type: 'string' },
            importance: { type: 'integer', minimum: 1, maximum: 5 },
            source_quote: { type: 'string' },
            urls: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  });
}

function promptForGroup(group, candidates) {
  const selected = selectClaudeInput(candidates, group);
  const minCount = Math.max(18, Math.floor(group.target * 0.76));
  const maxCount = Math.ceil(group.target * 1.18);
  return `你是一个中文知识提炼编辑，任务是把微信群候选消息提炼成适合阅读的“原子知识点卡片”。

关键要求：
1. 不是聊天日报，不是原文目录，不要让读者再自己翻信息；每条输出必须是已经加工过的小知识点。
2. 一条高密度原话可以拆成多个知识点；无意义寒暄、音乐、纯转发、重复内容要丢弃。
3. ${group.name} 这类群里很多句子本身就是知识点，请尽量拆细，尤其是产品案例、数据指标、增长打法、风险提醒、工具用法。
4. 只基于输入内容，不补外部事实，不编造数字；不输出发言人 ID。
5. 每条卡片要让读者快速知道：这件事是什么、可记住什么、怎么用或该警惕什么。
6. source_quote 只能放 30-110 字的短证据，不要整段复制。
7. category 只能用：产品增长、出海、AI编程、商业投资、工具资源、方法论、风险合规、其他。
8. 输出 ${minCount}-${maxCount} 条，优先保证密度和可读性。

输出格式：严格返回 JSON 对象，形如 {"points":[...]}，不要 Markdown，不要解释。

群名：${group.name}
日期范围：${RANGE.start} 至 ${RANGE.end}
候选消息如下：

${selected}`;
}

function parseClaudeResult(stdout) {
  const envelope = JSON.parse(stdout);
  if (envelope.is_error) {
    throw new Error(envelope.result || 'Claude returned an error');
  }
  const result = String(envelope.result ?? '').trim();
  try {
    return JSON.parse(result);
  } catch {
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in Claude result');
    return JSON.parse(match[0]);
  }
}

function runClaude(prompt, groupName) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--model',
      'sonnet',
      '--effort',
      'low',
      '--output-format',
      'json',
      '--no-session-persistence',
      '--dangerously-skip-permissions',
      '--json-schema',
      schemaForPoints(),
    ];
    const child = spawn('claude', args, {
      cwd: PUBLIC_ROOT,
      env: {
        ...process.env,
        HTTP_PROXY: process.env.HTTP_PROXY || 'http://127.0.0.1:7890',
        HTTPS_PROXY: process.env.HTTPS_PROXY || 'http://127.0.0.1:7890',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${groupName} Claude exited ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(parseClaudeResult(stdout));
      } catch (error) {
        reject(new Error(`${groupName} Claude parse failed: ${error.message}\n${stdout.slice(0, 1200)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

async function callClaudeWithRetry(group, candidates) {
  const prompt = promptForGroup(group, candidates);
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      console.log(`Claude extracting ${group.name}, attempt ${attempt}`);
      return await runClaude(prompt, group.name);
    } catch (error) {
      lastError = error;
      console.warn(error.message);
    }
  }
  throw lastError;
}

function inferTitle(c) {
  const text = withoutUrls(c.body);
  const firstUrl = c.urls[0] ? domainOf(c.urls[0]) : '';
  const productMatch = text.match(/^([A-Za-z][A-Za-z0-9 ._-]{2,28}|[\u4e00-\u9fa5A-Za-z0-9][^：:|｜]{2,24})(?:[:：|｜]| 记录| 下载| 收入| MRR| 月访问| 火了)/);
  if (productMatch && !/^https?$/i.test(productMatch[1])) return truncateClean(productMatch[1].replace(/\s+/g, ' ').trim(), 24);
  const articleTitle = firstUsefulClause(text, 26);
  if (articleTitle && !/^https?$/i.test(articleTitle)) return articleTitle;
  if (/反穿|clone|克隆/i.test(text)) return '反穿流量可以吃搜索需求';
  if (/KOL|creator|Partnership|投流|广告/i.test(text)) return 'KOL 授权投流提升转化';
  if (/MRR|收入|下载|月入|利润/.test(text)) return '产品数据要绑定增长动作';
  if (/Claude|Codex|Agent|MCP/i.test(text)) return 'Agent 工作流要沉淀成能力';
  if (firstUrl) return `${firstUrl} 这条线索`;
  return truncateClean(text, 24);
}

function inferTakeaway(c) {
  const text = withoutUrls(c.body);
  if (/MRR|收入|下载|月入|利润|流量/.test(text)) return '先记录可验证指标，再反推渠道、素材和变现链路。';
  if (/TikTok|KOL|creator|投流|广告|CTR|CPM/i.test(text)) return '把渠道动作拆到素材、账号、授权和投放层，别只看表面爆款。';
  if (/Claude|Codex|Agent|MCP|API|代码/i.test(text)) return '把一次性提示词改成可复用流程，减少重复解释成本。';
  if (/合规|协议|下架|风险|封号|泄露|法务|侵权/i.test(text)) return '这类信号要进入风险清单，先确认规则再放大。';
  if (/SEO|搜索|关键词|Google/i.test(text)) return '搜索需求可以承接外部热度，页面要提前准备好。';
  return '把这条当成一个可验证假设，后续用数据或案例继续确认。';
}

function inferSummary(c) {
  const text = withoutUrls(c.body);
  const head = firstUsefulClause(text, 86);
  if (/从立项|诱饵|竞争对手|MVP|论证/.test(text)) {
    return '产品立项可以先拆诱饵、投放位置、现有数据、竞品动作和预期反应，再进入 MVP 验证。';
  }
  if (/先让CC|学习计划|历史内容|案例/.test(text)) {
    return '让 Claude Code 先理解历史内容和当前目标，再生成学习计划与案例检索方向。';
  }
  if (/反穿|clone|克隆|搜索/.test(text)) {
    return `反穿流量的关键是把外部爆款需求承接到搜索或 Web 页面上：${head}`;
  }
  if (/KOL|creator|Partnership|投流|广告|CTR|CPM/i.test(text)) {
    return `投流知识点：${head}`;
  }
  if (/MRR|收入|下载|月入|利润|流量|ROI/i.test(text)) {
    return `案例数据：${head}`;
  }
  if (/Claude|Codex|Agent|MCP|API|模型/i.test(text)) {
    return `AI 工作流知识点：${head}`;
  }
  if (/合规|协议|下架|风险|封号|泄露|法务|侵权/i.test(text)) {
    return `风险提醒：${head}`;
  }
  if (c.urls?.length && text.length < 95) {
    return `资料线索：${head}`;
  }
  return truncateClean(text, 106);
}

function fallbackPoints(group, candidates) {
  const picked = selectClaudeInput(candidates, group)
    .split(/\n\nID \d+\n/)
    .map((block, index) => ({ block, index }))
    .slice(0, group.target);

  const byDate = new Map(candidates.map((c) => [`${c.date} ${truncate(c.body, 80)}`, c]));
  const ranked = [...candidates].sort((a, b) => b.score - a.score).slice(0, group.target);
  return (ranked.length ? ranked : picked).slice(0, group.target).map((c, index) => {
    const row = c.body ? c : [...byDate.values()][index];
    return {
      title: inferTitle(row),
      summary: inferSummary(row),
      takeaway: inferTakeaway(row),
      category: pointCategoryFromText({ title: row.body, category: row.category }, row.category),
      date: row.date,
      importance: Math.max(2, Math.min(5, Math.ceil((Number(row.score ?? 10) + 10) / 18))),
      source_quote: truncateClean(row.body, 100),
      urls: row.urls ?? [],
      tags: Array.from(new Set([row.category, ...(row.signals ?? [])].filter(Boolean))).slice(0, 4),
    };
  });
}

function normalizePoint(point, group, index) {
  const urls = Array.from(new Set((point.urls ?? []).map(cleanUrl).filter(Boolean))).slice(0, 4);
  const category = pointCategoryFromText(point, normalizeCategory(point.category));
  const tags = Array.from(new Set((point.tags ?? [])
    .map((tag) => stripMarkdown(tag).replace(/^#/, '').trim())
    .filter(Boolean))).slice(0, 5);
  return {
    id: `${group.slug}-${String(index + 1).padStart(3, '0')}`,
    group: group.name,
    groupSlug: group.slug,
    mark: group.mark,
    accent: group.accent,
    title: truncate(point.title, 32),
    summary: truncate(point.summary, 108),
    takeaway: truncate(point.takeaway, 92),
    category,
    date: /^\d{4}-\d{2}-\d{2}$/.test(point.date ?? '') ? point.date : RANGE.end,
    importance: Math.max(1, Math.min(5, Number(point.importance ?? 3))),
    sourceQuote: truncate(point.source_quote || point.sourceQuote || point.summary, 116),
    urls,
    tags,
  };
}

async function extractAllKnowledge() {
  ensureDir(DATA_ROOT);
  const allPoints = [];
  const groupSummaries = [];

  for (const group of GROUPS) {
    const { rows, dailyStats } = readGroupCandidates(group);
    const outputPath = path.join(DATA_ROOT, `${group.slug}.json`);
    let points = null;
    if (existsSync(outputPath) && process.env.FORCE_REBUILD !== '1') {
      const cached = JSON.parse(readFileSync(outputPath, 'utf8'));
      points = cached.points;
      console.log(`Using cached points for ${group.name}: ${points.length}`);
    }
    if (!points) {
      try {
        if (!USE_CLAUDE) {
          points = fallbackPoints(group, rows).map((point, index) => normalizePoint(point, group, index));
        } else {
          const extracted = await callClaudeWithRetry(group, rows);
          points = (extracted?.points ?? []).map((point, index) => normalizePoint(point, group, index));
        }
      } catch (error) {
        console.warn(`Falling back for ${group.name}: ${error.message}`);
        points = fallbackPoints(group, rows).map((point, index) => normalizePoint(point, group, index));
      }
      writeFileSync(outputPath, JSON.stringify({
        group: group.name,
        slug: group.slug,
        range: RANGE,
        pointCount: points.length,
        points,
      }, null, 2));
    }

    const messageCount = dailyStats.reduce((sum, day) => sum + day.messages, 0);
    const signalCount = dailyStats.reduce((sum, day) => sum + day.signals, 0);
    const days = dailyStats.filter((day) => day.messages > 0).length;
    const categories = countBy(points, (point) => point.category);
    const topTags = topEntries(countBy(points.flatMap((point) => point.tags), (tag) => tag), 6).map(([tag]) => tag);
    groupSummaries.push({
      ...group,
      days,
      messageCount,
      signalCount,
      pointCount: points.length,
      categories,
      topTags,
      topPoints: [...points].sort((a, b) => b.importance - a.importance).slice(0, 3),
    });
    allPoints.push(...points);
  }

  allPoints.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`);
  });
  writeFileSync(path.join(DATA_ROOT, 'points.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    range: RANGE,
    groups: groupSummaries,
    pointCount: allPoints.length,
    points: allPoints,
  }, null, 2));
  return { allPoints, groupSummaries };
}

function countBy(values, picker) {
  const result = {};
  for (const value of values) {
    const key = picker(value);
    if (!key) continue;
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function topEntries(object, limit = 5) {
  return Object.entries(object).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function renderLayout({ title, description, body, depth = 0 }) {
  const prefix = depth === 0 ? '' : '../'.repeat(depth);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${htmlEscape(title)}</title>
<meta name="description" content="${attr(description)}">
<style>${knowledgeCss()}</style>
</head>
<body>
${body}
<script>${knowledgeJs()}</script>
</body>
</html>
`.replaceAll('__ROOT__', prefix);
}

function knowledgeCss() {
  return `
:root{--bg:#f3f6f7;--ink:#111827;--muted:#667085;--card:#ffffff;--line:#dfe5e8;--soft:#eef3f4;--shadow:0 18px 46px rgba(15,23,42,.10);--ocean:#0b6f86;--teal:#0f766e;--gold:#a16207;--blue:#2557a7;--violet:#6d4a91;--green:#24714d;--red:#a33a4a;--inkAccent:#1f2937}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Avenir Next","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;line-height:1.65}a{color:inherit}.topbar{background:#0f172a;color:#fff;border-bottom:1px solid rgba(255,255,255,.1)}.topbar-inner{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{font-weight:800;letter-spacing:.02em}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a{font-size:13px;text-decoration:none;color:#d9e2e8;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 11px}.hero{background:linear-gradient(135deg,#101827 0%,#173c49 52%,#704d18 100%);color:#fff}.hero-inner{max-width:1180px;margin:0 auto;padding:48px 20px 40px}.kicker{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#b7c4ce}.hero h1{font-size:42px;line-height:1.08;margin:10px 0 12px;letter-spacing:0}.hero p{max-width:820px;margin:0;color:#d8e2e6;font-size:16px}.meta-strip{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.meta-pill{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 12px;font-size:13px;color:#f4f7f8}.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 70px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:-54px 0 26px}.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:17px 18px;box-shadow:0 8px 22px rgba(15,23,42,.08)}.stat b{display:block;font-size:29px;line-height:1.1;letter-spacing:0}.stat span{display:block;margin-top:8px;color:var(--muted);font-size:13px;font-weight:700}.section-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin:32px 0 14px}.section-head h2{margin:0;font-size:20px;letter-spacing:0}.section-head p{margin:0;color:var(--muted);font-size:13px}.group-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.group-card{--accent:var(--ocean);display:grid;grid-template-columns:64px minmax(0,1fr);gap:16px;text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;box-shadow:0 2px 8px rgba(15,23,42,.04);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.group-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:color-mix(in srgb,var(--accent) 38%,var(--line))}.mark{width:56px;height:56px;border-radius:7px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:900;font-size:12px;letter-spacing:.04em}.group-card h3{font-size:20px;line-height:1.25;margin:0 0 7px}.group-meta{color:var(--muted);font-size:13px;margin-bottom:11px}.chips{display:flex;gap:7px;flex-wrap:wrap}.chip{border:1px solid color-mix(in srgb,var(--accent) 22%,var(--line));background:color-mix(in srgb,var(--accent) 9%,white);color:color-mix(in srgb,var(--accent) 82%,black);border-radius:999px;padding:3px 8px;font-size:12px;font-weight:800}.point-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.point-card{--accent:var(--teal);position:relative;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;box-shadow:0 2px 8px rgba(15,23,42,.04)}.point-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent);border-radius:10px 0 0 10px}.point-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.point-cat{background:color-mix(in srgb,var(--accent) 11%,white);color:color-mix(in srgb,var(--accent) 84%,black);border-radius:999px;padding:3px 8px;font-size:12px;font-weight:900;white-space:nowrap}.point-date{font-family:"SF Mono",Menlo,monospace;color:#7b8790;font-size:12px}.point-card h3{font-size:18px;line-height:1.3;margin:0 0 8px}.summary{font-size:14px;color:#313b44;margin:0 0 10px}.takeaway{border-top:1px solid #edf1f3;padding-top:10px;margin-top:10px;color:#44515b;font-size:13px}.quote{margin:10px 0 0;padding:9px 10px;background:#f7fafb;border:1px solid #e8eef0;border-radius:7px;color:#69757d;font-size:12px}.links{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.links a{font-size:12px;text-decoration:none;color:#1d4d7a;background:#edf5fb;border:1px solid #d7e8f5;border-radius:999px;padding:3px 8px}.source{display:inline-flex;margin-top:10px;font-size:12px;text-decoration:none;color:#5d6972;border-bottom:1px dashed #aab5bb}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px}.filter{appearance:none;border:1px solid var(--line);background:white;color:#34404a;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:800;cursor:pointer}.filter.active{background:#111827;color:#fff;border-color:#111827}.accent-ocean{--accent:var(--ocean)}.accent-teal{--accent:var(--teal)}.accent-gold{--accent:var(--gold)}.accent-blue{--accent:var(--blue)}.accent-violet{--accent:var(--violet)}.accent-green{--accent:var(--green)}.accent-red{--accent:var(--red)}.accent-ink{--accent:var(--inkAccent)}footer{padding:30px 20px;text-align:center;color:#8b98a1;font-size:12px}.empty{display:none}.is-hidden{display:none!important}@media(max-width:980px){.stats{grid-template-columns:repeat(2,1fr);margin-top:-34px}.point-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.topbar-inner{align-items:flex-start;flex-direction:column}.hero h1{font-size:30px}.hero-inner{padding:36px 16px 34px}.wrap{padding:22px 14px 58px}.stats,.group-grid,.point-grid{grid-template-columns:1fr}.section-head{align-items:flex-start;flex-direction:column}.group-card{grid-template-columns:52px minmax(0,1fr);padding:15px}.mark{width:46px;height:46px;font-size:11px}.group-card h3{font-size:18px}.stat b{font-size:25px}}
`;
}

function knowledgeJs() {
  return `
document.querySelectorAll('[data-filter-scope]').forEach((scope) => {
  const buttons = scope.querySelectorAll('[data-filter]');
  const cards = scope.querySelectorAll('[data-category]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.filter;
      buttons.forEach((item) => item.classList.toggle('active', item === button));
      cards.forEach((card) => {
        card.classList.toggle('is-hidden', target !== '全部' && card.dataset.category !== target);
      });
    });
  });
});
`;
}

function statBlock(stats) {
  return `<div class="stats">${stats.map((item) => `<div class="stat"><b>${htmlEscape(item.value)}</b><span>${htmlEscape(item.label)}</span></div>`).join('')}</div>`;
}

function pointCard(point, depth = 0) {
  const sourcePrefix = depth === 0 ? '../' : '../../';
  const rawHref = `${sourcePrefix}groups/${encodeURI(point.groupSlug)}/${point.date}.html`;
  const linkHtml = point.urls.map((url) => {
    const label = domainOf(url) || 'link';
    return `<a href="${attr(url)}" target="_blank" rel="noreferrer">${htmlEscape(label)}</a>`;
  }).join('');
  return `<article class="point-card accent-${attr(point.accent)}" data-category="${attr(point.category)}">
  <div class="point-top"><span class="point-cat">${htmlEscape(point.category)}</span><span class="point-date">${htmlEscape(point.date)}</span></div>
  <h3>${htmlEscape(point.title)}</h3>
  <p class="summary">${htmlEscape(point.summary)}</p>
  <div class="takeaway"><strong>可记：</strong>${htmlEscape(point.takeaway)}</div>
  <div class="quote">${htmlEscape(point.sourceQuote)}</div>
  ${linkHtml ? `<div class="links">${linkHtml}</div>` : ''}
  <a class="source" href="${rawHref}">证据页：${htmlEscape(point.group)}</a>
</article>`;
}

function categoryFilters(points) {
  const categories = ['全部', ...CATEGORY_ORDER.filter((category) => points.some((point) => point.category === category))];
  return `<div class="filters">${categories.map((category, index) => `<button class="filter${index === 0 ? ' active' : ''}" data-filter="${attr(category)}">${htmlEscape(category)}</button>`).join('')}</div>`;
}

function renderIndex({ allPoints, groupSummaries }) {
  const categoryCounts = countBy(allPoints, (point) => point.category);
  const featured = [...allPoints].sort((a, b) => b.importance - a.importance).slice(0, 48);
  const body = `<header class="topbar"><div class="topbar-inner"><div class="brand">微信群知识库</div><nav class="nav"><a href="__ROOT__index.html">首页</a><a href="__ROOT__groups/index.html">群入口</a></nav></div></header>
<section class="hero"><div class="hero-inner"><div class="kicker">EXTRACTED KNOWLEDGE POINTS</div><h1>8 群知识点提炼</h1><p>从最近 30 天 29,536 条群消息里，把高密度讨论拆成可直接阅读的知识点卡片。每张卡片都保留短证据和来源入口。</p><div class="meta-strip"><span class="meta-pill">${RANGE.start} 至 ${RANGE.end}</span><span class="meta-pill">8 个目标群</span><span class="meta-pill">${allPoints.length} 个知识点</span></div></div></section>
<main class="wrap">
${statBlock([
  { value: '8', label: '目标群' },
  { value: String(allPoints.length), label: '知识点卡片' },
  { value: '29,536', label: '消息来源' },
  { value: `${Object.keys(categoryCounts).length}`, label: '主题类目' },
])}
<section><div class="section-head"><h2>按群进入</h2><p>每个群都已经拆成可阅读的小点。</p></div><div class="group-grid">
${groupSummaries.map((group) => {
  const cats = topEntries(group.categories, 3).map(([category, count]) => `<span class="chip">${htmlEscape(category)} ${count}</span>`).join('');
  return `<a class="group-card accent-${attr(group.accent)}" href="${encodeURI(group.slug)}/index.html"><div class="mark">${htmlEscape(group.mark)}</div><div><h3>${htmlEscape(group.name)}</h3><div class="group-meta">${group.pointCount} 个知识点 / ${group.days} 天 / ${group.messageCount.toLocaleString('zh-CN')} 条消息</div><div class="chips">${cats}</div></div></a>`;
}).join('')}
</div></section>
<section data-filter-scope><div class="section-head"><h2>高价值知识点</h2><p>${topEntries(categoryCounts, 4).map(([category, count]) => `${category} ${count}`).join(' · ')}</p></div>${categoryFilters(featured)}<div class="point-grid">${featured.map((point) => pointCard(point, 0)).join('')}</div></section>
</main><footer>本地生成 · 最近 30 天 · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</footer>`;
  writeFileSync(path.join(KNOWLEDGE_ROOT, 'index.html'), renderLayout({
    title: '8群知识点提炼',
    description: '从微信群最近30天消息中提炼出的原子知识点卡片。',
    body,
    depth: 1,
  }));
}

function renderGroupPages({ allPoints, groupSummaries }) {
  for (const group of groupSummaries) {
    const points = allPoints
      .filter((point) => point.groupSlug === group.slug)
      .sort((a, b) => `${a.date}${a.id}`.localeCompare(`${b.date}${b.id}`));
    const groupDir = path.join(KNOWLEDGE_ROOT, group.slug);
    ensureDir(groupDir);
    const body = `<header class="topbar"><div class="topbar-inner"><div class="brand">${htmlEscape(group.name)}</div><nav class="nav"><a href="../index.html">知识点首页</a><a href="../../index.html">站点首页</a></nav></div></header>
<section class="hero"><div class="hero-inner"><div class="kicker">${htmlEscape(group.mark)} KNOWLEDGE</div><h1>${htmlEscape(group.name)}</h1><p>${group.pointCount} 个知识点，来自 ${group.days} 天、${group.messageCount.toLocaleString('zh-CN')} 条消息。这里展示的是提炼后的结论、做法、风险和证据。</p><div class="meta-strip"><span class="meta-pill">${RANGE.start} 至 ${RANGE.end}</span><span class="meta-pill">${group.signalCount.toLocaleString('zh-CN')} 条候选信号</span><span class="meta-pill">${group.topTags.slice(0, 3).map(htmlEscape).join(' / ') || '知识点'}</span></div></div></section>
<main class="wrap">
${statBlock([
  { value: String(group.pointCount), label: '知识点' },
  { value: String(group.days), label: '活跃天数' },
  { value: group.messageCount.toLocaleString('zh-CN'), label: '消息来源' },
  { value: group.signalCount.toLocaleString('zh-CN'), label: '候选信号' },
])}
<section data-filter-scope><div class="section-head"><h2>知识点清单</h2><p>${topEntries(group.categories, 4).map(([category, count]) => `${category} ${count}`).join(' · ')}</p></div>${categoryFilters(points)}<div class="point-grid">${points.map((point) => pointCard(point, 1)).join('')}</div></section>
</main><footer>本地生成 · ${htmlEscape(group.name)} · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</footer>`;
    writeFileSync(path.join(groupDir, 'index.html'), renderLayout({
      title: `${group.name}｜知识点提炼`,
      description: `${group.name} 最近30天消息提炼出的知识点。`,
      body,
      depth: 1,
    }));
  }
}

function renderGroupsEntry({ groupSummaries, allPoints }) {
  const body = `<header class="topbar"><div class="topbar-inner"><div class="brand">8群知识点提炼</div><nav class="nav"><a href="../index.html">首页</a><a href="../knowledge/index.html">知识点库</a></nav></div></header>
<section class="hero"><div class="hero-inner"><div class="kicker">GROUP KNOWLEDGE INDEX</div><h1>8 个目标群知识点</h1><p>这里是按群整理后的知识点入口，直接读结论、做法、风险和短证据。</p><div class="meta-strip"><span class="meta-pill">${RANGE.start} 至 ${RANGE.end}</span><span class="meta-pill">${allPoints.length} 个知识点</span><span class="meta-pill">29,536 条消息来源</span></div></div></section>
<main class="wrap">${statBlock([
  { value: '8', label: '目标群' },
  { value: String(allPoints.length), label: '知识点' },
  { value: '217', label: '证据日报页' },
  { value: '30 天', label: '时间范围' },
])}<div class="group-grid">${groupSummaries.map((group) => {
    const cats = topEntries(group.categories, 3).map(([category, count]) => `<span class="chip">${htmlEscape(category)} ${count}</span>`).join('');
    return `<a class="group-card accent-${attr(group.accent)}" href="../knowledge/${encodeURI(group.slug)}/index.html"><div class="mark">${htmlEscape(group.mark)}</div><div><h3>${htmlEscape(group.name)}</h3><div class="group-meta">${group.pointCount} 个知识点 / ${group.days} 天 / ${group.messageCount.toLocaleString('zh-CN')} 条消息</div><div class="chips">${cats}</div></div></a>`;
  }).join('')}</div></main><footer>知识点卡片已保留来源入口 · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</footer>`;
  const groupsIndex = path.join(PUBLIC_ROOT, 'groups', 'index.html');
  writeFileSync(groupsIndex, renderLayout({
    title: '8个目标群知识点',
    description: '8个目标微信群最近30天消息提炼出的知识点入口。',
    body,
    depth: 1,
  }));
}

function renderHome({ allPoints }) {
  const topCategories = topEntries(countBy(allPoints, (point) => point.category), 5)
    .map(([category, count]) => `${category} ${count}`)
    .join(' · ');
  const homePath = path.join(PUBLIC_ROOT, 'index.html');
  let html = readFileSync(homePath, 'utf8');
  const newCard = `<a class="card" data-accent="teal" href="knowledge/index.html">
  <div class="card-emoji" data-mark="POINTS"></div>
  <div class="card-body">
    <div class="card-title">8群知识点提炼</div>
    <div class="card-meta">8 群 / ${allPoints.length} 个知识点 / 29,536 条消息</div>
    <div class="card-summary">已经改成可直接阅读的知识点卡片：每条都有结论、可执行提醒、短证据和来源入口。</div>
  </div>
  <div class="card-side">
    <span class="badge">${allPoints.length} 知识点</span>
    <span class="card-kb">${htmlEscape(topCategories)}</span>
  </div>
</a>`;
  html = html.replace(/<a class="card" data-accent="teal" href="(?:groups|knowledge)\/index\.html">[\s\S]*?<\/a><\/div><\/section>/, `${newCard}</div></section>`);
  html = html
    .replace('WECHAT SIGNAL ARCHIVE', 'WECHAT KNOWLEDGE CARDS')
    .replace('<h1>微信群学习卡片</h1><p>把群消息整理成能直接翻阅的专题卡片、核心群日报和 8 个目标群的 30 天归档。</p>', '<h1>微信群知识点卡片</h1><p>把群消息加工成能直接阅读的知识点、专题卡片和证据来源；优先呈现结论，而不是原始聊天目录。</p>')
    .replace(/本地生成 · 数据来自你的 Obsidian vault · [^<]+/, `本地生成 · 数据来自你的 Obsidian vault · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} 更新`);
  writeFileSync(homePath, html);
  writeFileSync(path.join(PUBLIC_ROOT, '_index.html'), html);
}

async function main() {
  ensureDir(KNOWLEDGE_ROOT);
  ensureDir(DATA_ROOT);
  if (existsSync(KNOWLEDGE_ROOT) && process.env.CLEAN_KNOWLEDGE === '1') {
    rmSync(KNOWLEDGE_ROOT, { recursive: true, force: true });
    ensureDir(DATA_ROOT);
  }
  const { allPoints, groupSummaries } = await extractAllKnowledge();
  renderIndex({ allPoints, groupSummaries });
  renderGroupPages({ allPoints, groupSummaries });
  renderGroupsEntry({ allPoints, groupSummaries });
  renderHome({ allPoints });

  const htmlCount = readdirSync(KNOWLEDGE_ROOT, { recursive: true })
    .filter((file) => String(file).endsWith('.html')).length;
  const bytes = statSync(path.join(DATA_ROOT, 'points.json')).size;
  console.log(`Built ${allPoints.length} knowledge points, ${htmlCount} HTML pages, ${bytes} bytes JSON.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
