import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [, , sourceUrlArg] = process.argv;

if (!sourceUrlArg) {
  console.error('Usage: node daily-card-public/scripts/fetch_feishu_wiki_to_knowledge.mjs <feishu-wiki-url>');
  process.exit(1);
}

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'daily-card-public', 'knowledge', 'feishu-wiki', 'one-person-company-0-100w-2026');
const DOCS_DIR = path.join(OUT_ROOT, 'documents');

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

function decodeHtml(value) {
  return String(value ?? '')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#34;', '"')
    .replaceAll('&#39;', "'");
}

function slugify(value, fallback) {
  const text = decodeHtml(value)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return text || fallback;
}

function extractTitle(markdown, fallback = 'Untitled') {
  const titleTag = markdown.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleTag) return decodeHtml(titleTag[1]).trim();
  const heading = markdown.match(/^#\s+(.+)$/m);
  if (heading) return decodeHtml(heading[1]).trim();
  return fallback;
}

function extractCitations(markdown) {
  const citations = [];
  const seen = new Set();
  const citeRegex = /<cite\s+([^>]*?)><\/cite>/g;
  let match;
  while ((match = citeRegex.exec(markdown))) {
    const attrs = {};
    const attrRegex = /([a-zA-Z-]+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(match[1]))) {
      attrs[attrMatch[1]] = decodeHtml(attrMatch[2]);
    }
    if (!attrs.token) continue;
    const key = `${attrs['file-type'] || ''}:${attrs.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      token: attrs.token,
      title: attrs.title || attrs.token,
      fileType: attrs['file-type'] || '',
      docId: attrs['doc-id'] || '',
      type: attrs.type || '',
    });
  }
  return citations;
}

function runLarkFetch(doc) {
  return new Promise((resolve, reject) => {
    const args = [
      'docs',
      '+fetch',
      '--api-version',
      'v2',
      '--doc',
      doc,
      '--doc-format',
      'markdown',
      '--format',
      'json',
    ];
    const child = spawn('lark-cli', args, {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`lark-cli exited ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse lark-cli JSON: ${error.message}\n${stdout.slice(0, 800)}`));
      }
    });
  });
}

function markdownToSimpleHtml(markdown) {
  const lines = markdown
    .replace(/<title>[\s\S]*?<\/title>\n*/i, '')
    .replace(/<callout emoji="([^"]*)">([\s\S]*?)<\/callout>/g, (_m, emoji, body) => `\n> ${emoji} ${body.trim().replace(/\n+/g, '\n> ')}\n`)
    .replace(/<synced-source>[\s\S]*?<cite[^>]*title="([^"]*)"[^>]*token="([^"]*)"[^>]*><\/cite>[\s\S]*?<\/synced-source>/g, (_m, title, token) => `\n- 引用文档：${decodeHtml(title)}（${token}）\n`)
    .replace(/<sheet[^>]*token="([^"]*)"[^>]*><\/sheet>/g, (_m, token) => `\n- 引用表格：${token}\n`)
    .split(/\n/);
  const html = [];
  let inList = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      const level = Math.min(heading[1].length + 1, 5);
      html.push(`<h${level}>${htmlEscape(heading[2])}</h${level}>`);
      continue;
    }
    const list = line.match(/^[-*]\s+(.+)$/);
    if (list) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${htmlEscape(list[1])}</li>`);
      continue;
    }
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    html.push(`<p>${htmlEscape(line)}</p>`);
  }
  if (inList) html.push('</ul>');
  return html.join('\n');
}

function renderHtml({ rootDoc, children, sourceUrl, fetchedAt }) {
  const nav = [rootDoc, ...children].map((doc) => (
    `<a href="#${attr(doc.id)}"><span>${String(doc.order).padStart(2, '0')}</span>${htmlEscape(doc.title)}</a>`
  )).join('');
  const sections = [rootDoc, ...children].map((doc) => `
    <section class="doc" id="${attr(doc.id)}">
      <div class="doc-meta">${doc.order === 0 ? 'ROOT' : htmlEscape(doc.fileType || 'DOC')} · ${htmlEscape(doc.documentId || doc.token || '')}</div>
      <h2>${htmlEscape(doc.title)}</h2>
      <div class="doc-actions"><a href="documents/${attr(doc.fileName)}">Markdown 原文</a></div>
      <article>${markdownToSimpleHtml(doc.content)}</article>
    </section>
  `).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(rootDoc.title)} - 知识库归档</title>
  <style>
    :root{--bg:#f5f2ec;--ink:#171717;--muted:#6d675f;--card:#fffaf2;--line:#ded4c5;--red:#c84d3f;--teal:#0f766e;--gold:#b7791f}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Avenir Next","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;line-height:1.75}
    a{color:inherit}.hero{background:linear-gradient(135deg,#171717,#214642 58%,#8b4f22);color:white;padding:52px 22px}.hero-inner{max-width:1180px;margin:0 auto}.kicker{font-size:12px;letter-spacing:.16em;color:#eadfd0;text-transform:uppercase}.hero h1{max-width:900px;margin:12px 0;font-size:42px;line-height:1.12}.hero p{max-width:820px;color:#eadfd0;margin:0}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.pill{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);border-radius:999px;padding:7px 12px;font-size:13px}.wrap{max-width:1180px;margin:0 auto;padding:26px 22px 72px;display:grid;grid-template-columns:290px minmax(0,1fr);gap:24px}.toc{position:sticky;top:16px;align-self:start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;max-height:calc(100vh - 32px);overflow:auto}.toc h2{font-size:15px;margin:0 0 10px}.toc a{display:grid;grid-template-columns:32px minmax(0,1fr);gap:8px;text-decoration:none;border-top:1px solid #eee2d2;padding:9px 0;font-size:13px;color:#403b35}.toc span{font-family:Menlo,monospace;color:var(--red)}.doc{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:28px;margin-bottom:18px;box-shadow:0 12px 34px rgba(68,48,28,.06)}.doc-meta{font-size:12px;color:var(--muted);font-weight:800;letter-spacing:.08em}.doc h2{font-size:28px;line-height:1.22;margin:8px 0 8px}.doc-actions a{display:inline-flex;margin:4px 0 18px;border:1px solid var(--line);border-radius:999px;padding:5px 10px;text-decoration:none;color:#514a42;font-size:13px;background:#fff}.doc article h2,.doc article h3,.doc article h4,.doc article h5{margin:24px 0 8px;line-height:1.3}.doc article h2{font-size:23px;color:var(--red)}.doc article h3{font-size:20px}.doc article h4,.doc article h5{font-size:17px}.doc article p{margin:9px 0}.doc article ul{margin:9px 0 10px;padding-left:22px}.doc article li{margin:4px 0}footer{text-align:center;color:var(--muted);font-size:12px;padding:28px}
    @media(max-width:860px){.hero h1{font-size:30px}.wrap{display:block}.toc{position:relative;top:auto;margin-bottom:18px}.doc{padding:20px}.doc h2{font-size:23px}}
  </style>
</head>
<body>
  <header class="hero"><div class="hero-inner">
    <div class="kicker">FEISHU WIKI CRAWL</div>
    <h1>${htmlEscape(rootDoc.title)}</h1>
    <p>从飞书 Wiki 抓取并整理成个人知识库归档。保留根页面与引用子文档的 Markdown 原文，便于后续检索、摘要和二次加工。</p>
    <div class="meta"><span class="pill">来源：${htmlEscape(sourceUrl)}</span><span class="pill">抓取时间：${htmlEscape(fetchedAt)}</span><span class="pill">子文档：${children.length}</span></div>
  </div></header>
  <main class="wrap">
    <nav class="toc"><h2>文档目录</h2>${nav}</nav>
    <div>${sections}</div>
  </main>
  <footer>Generated by Codex · daily-card-public knowledge base</footer>
</body>
</html>`;
}

async function main() {
  ensureDir(DOCS_DIR);
  const fetchedAt = new Date().toISOString();
  const rootPayload = await runLarkFetch(sourceUrlArg);
  const rootContent = rootPayload.data?.document?.content ?? '';
  const rootTitle = extractTitle(rootContent, 'Feishu Wiki');
  const citations = extractCitations(rootContent);

  const rootDoc = {
    id: 'root',
    order: 0,
    title: rootTitle,
    token: sourceUrlArg.match(/\/wiki\/([^/?#]+)/)?.[1] ?? sourceUrlArg,
    fileType: 'wiki',
    documentId: rootPayload.data?.document?.document_id ?? '',
    revisionId: rootPayload.data?.document?.revision_id ?? '',
    fileName: '00-root.md',
    content: rootContent,
  };
  writeFileSync(path.join(DOCS_DIR, rootDoc.fileName), rootContent);

  const children = [];
  const failures = [];
  let order = 1;
  for (const citation of citations) {
    const fileName = `${String(order).padStart(2, '0')}-${slugify(citation.title, citation.token)}-${citation.token.slice(-6)}.md`;
    const child = {
      id: `doc-${String(order).padStart(2, '0')}`,
      order,
      title: citation.title,
      token: citation.token,
      fileType: citation.fileType,
      docId: citation.docId,
      fileName,
      content: '',
      documentId: '',
      revisionId: '',
    };
    try {
      const payload = await runLarkFetch(citation.token);
      child.content = payload.data?.document?.content ?? '';
      child.title = extractTitle(child.content, citation.title);
      child.documentId = payload.data?.document?.document_id ?? '';
      child.revisionId = payload.data?.document?.revision_id ?? '';
      writeFileSync(path.join(DOCS_DIR, fileName), child.content);
      children.push(child);
      console.log(`Fetched ${order}/${citations.length}: ${child.title}`);
    } catch (error) {
      failures.push({ ...citation, error: error.message });
      console.warn(`Failed ${order}/${citations.length}: ${citation.title}: ${error.message}`);
    }
    order += 1;
  }

  const manifest = {
    sourceUrl: sourceUrlArg,
    fetchedAt,
    title: rootDoc.title,
    root: { ...rootDoc, content: undefined },
    childCount: children.length,
    failureCount: failures.length,
    documents: children.map((doc) => ({ ...doc, content: undefined })),
    failures,
  };
  writeFileSync(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const aggregate = [
    `# ${rootDoc.title}`,
    '',
    `- 来源：${sourceUrlArg}`,
    `- 抓取时间：${fetchedAt}`,
    `- 子文档：${children.length}`,
    `- 失败：${failures.length}`,
    '',
    '## 根页面',
    '',
    rootContent,
    '',
    ...children.flatMap((doc) => [
      '',
      `---`,
      '',
      `## ${doc.order}. ${doc.title}`,
      '',
      `- Token：${doc.token}`,
      `- 文件：documents/${doc.fileName}`,
      '',
      doc.content,
    ]),
  ].join('\n');
  writeFileSync(path.join(OUT_ROOT, 'index.md'), aggregate);
  writeFileSync(path.join(OUT_ROOT, 'index.html'), renderHtml({ rootDoc, children, sourceUrl: sourceUrlArg, fetchedAt }));
  console.log(JSON.stringify({ outRoot: OUT_ROOT, childCount: children.length, failureCount: failures.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
