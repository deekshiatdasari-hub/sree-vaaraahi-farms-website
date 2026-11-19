/**
 * One-time move of the Knowledge Hub articles from the WordPress site into plain pages.
 * Reads each article through the WordPress REST API, strips the Divi page-builder codes,
 * keeps the text, headings, lists and links, and saves the lead image locally.
 *   node tools/import-articles.mjs && npm run sync
 * Needs Python with Pillow for the image step (already used for the site's other images).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { esc, renderPage } from './page.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const WP = 'https://www.sreevaaraahifarms.in/wp-json/wp/v2/pages';
/** The article pages, newest first, as listed on the old Knowledge Hub. */
const ARTICLE_IDS = [1407, 173, 215, 225, 235, 242, 250];

/** The old host sometimes drops a connection; try a few times before giving up. */
async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

const KEEP = 'h1|h2|h3|h4|h5|h6|p|ul|ol|li|strong|b|em|i|a|br|blockquote';
const localLink = (url) => url.replace(/^https?:\/\/(www\.)?sreevaaraahifarms\.in/, '') || '/';
const text = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#8217;|&#8216;/g, '’')
    .replace(/&#8211;/g, '–')
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();

function clean(rendered) {
  const lead = /et_pb_image src=(?:&#8221;|")(https?:[^&"]+?\.(?:png|jpe?g|webp))/.exec(rendered)?.[1];
  let html = rendered.replace(/\[\/?et_pb_[^\]]*\]/g, '');
  html = html.replace(new RegExp(`<(\\/?)(${KEEP})\\b([^>]*)>`, 'gi'), (_, close, tag, attrs) => {
    tag = tag.toLowerCase();
    if (tag === 'a' && !close) {
      const href = /href="([^"]+)"/.exec(attrs)?.[1];
      return href ? `<a href="${esc(localLink(href))}">` : '<a>';
    }
    return `<${close}${tag}>`;
  });
  html = html.replace(new RegExp(`<(?!\\/?(?:${KEEP})\\b)[^>]*>`, 'gi'), '');
  // Drop the old site's "Get Your First Order Today… join our Telegram group" block and its link list.
  html = html.split(/<h[1-6]>\s*Get Your First Order Today/i)[0];
  html = html
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/<\/ol>\s*<ol>/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  // The first small heading is a label ("organic lemons"); the first big one is the headline.
  let eyebrow = '';
  let headline = '';
  html = html.replace(/^<h[4-6]>([\s\S]*?)<\/h[4-6]>/, (_, label) => {
    eyebrow = text(label);
    return '';
  });
  html = html.trim().replace(/^<h[1-3]>([\s\S]*?)<\/h[1-3]>/, (_, title) => {
    headline = text(title);
    return '';
  });
  // Page headings: the article's own h1/h2 become h2, smaller ones h3.
  html = html.replace(/<(\/?)h[12]>/g, '<$1h2>').replace(/<(\/?)h[3-6]>/g, '<$1h3>');
  return { lead, eyebrow, headline, html: html.trim() };
}

async function saveImage(url, slug) {
  const dir = join(root, 'site', 'assets', 'img', 'articles');
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `${slug}.webp`);
  const res = await get(encodeURI(url));
  const download = join(tmpdir(), `svf-article-${slug}`);
  writeFileSync(download, Buffer.from(await res.arrayBuffer()));
  const script = [
    'import sys',
    'from PIL import Image',
    'im = Image.open(sys.argv[1]).convert("RGB")',
    'im.thumbnail((1200, 1200))',
    'im.save(sys.argv[2], quality=80, method=6)',
    'print(im.size[0], im.size[1])',
  ].join('\n');
  const [w, h] = execFileSync('python', ['-I', '-c', script, download, target], { encoding: 'utf8' })
    .trim()
    .split(' ')
    .map(Number);
  rmSync(download);
  return { src: `/assets/img/articles/${slug}.webp`, width: w, height: h };
}

const articles = [];
for (const id of ARTICLE_IDS) {
  const res = await get(`${WP}/${id}?_fields=slug,title,content,date`);
  const page = await res.json();
  const { lead, eyebrow, headline, html } = clean(page.content.rendered);
  const title = headline || text(page.title.rendered);
  const firstPara = text(/<p>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '');
  const description = (firstPara || title).slice(0, 155);
  const image = lead ? await saveImage(lead, page.slug) : null;
  const date = new Date(page.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = `  <div class="page-head">
    <div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/knowledge-hub/">Knowledge hub</a></nav>
      ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}
      <h1>${esc(title)}</h1>
      <p>By Sree Vaaraahi Farms · ${date}</p>
    </div>
  </div>
  <div class="container">
    <article class="prose">
      ${image ? `<img src="${image.src}" alt="" width="${image.width}" height="${image.height}" style="border-radius:var(--radius-lg);margin-bottom:24px" fetchpriority="high">` : ''}
${html}
      <div class="cta-band" style="margin-top:40px">
        <div><h2 style="margin:0 0 6px">Taste the difference</h2><p>Fresh produce delivered every Wednesday and Saturday.</p></div>
        <div class="actions"><a class="btn btn-primary" href="/shop/">Shop now</a></div>
      </div>
    </article>
  </div>`;

  const dir = join(root, 'site', 'knowledge-hub', page.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'index.html'),
    renderPage({ title, description, path: `/knowledge-hub/${page.slug}/`, nav: 'knowledge', body }),
  );
  articles.push({ slug: page.slug, title, description, image, date, oldPath: `/${page.slug}/` });
  console.log('imported', page.slug);
}

// The hub page listing every article.
const cards = articles
  .map(
    (a) => `      <a class="cat-card article-card" href="/knowledge-hub/${a.slug}/">
        ${a.image ? `<span class="thumb"><img src="${a.image.src}" alt="" loading="lazy" width="${a.image.width}" height="${a.image.height}"></span>` : ''}
        <span class="article-body"><strong>${esc(a.title)}</strong><span class="muted">${esc(a.description)}…</span></span>
      </a>`,
  )
  .join('\n');
mkdirSync(join(root, 'site', 'knowledge-hub'), { recursive: true });
writeFileSync(
  join(root, 'site', 'knowledge-hub', 'index.html'),
  renderPage({
    title: 'Knowledge hub',
    description: 'Tips and insights about fruits, vegetables and healthy eating from Sree Vaaraahi Farms.',
    path: '/knowledge-hub/',
    nav: 'knowledge',
    body: `  <div class="page-head">
    <div class="container">
      <h1>Knowledge hub</h1>
      <p>Curious about your food? Tips and insights about your favourite fruits, vegetables and more, to help you make the most of every harvest.</p>
    </div>
  </div>
  <div class="container">
    <div class="article-grid">
${cards}
    </div>
  </div>`,
  }),
);
console.log('built /knowledge-hub/');

// Old article addresses → new ones, for the redirects file.
writeFileSync(
  join(fileURLToPath(new URL('.', import.meta.url)), 'article-redirects.json'),
  JSON.stringify(articles.map((a) => [a.oldPath, `/knowledge-hub/${a.slug}/`]), null, 2),
);
