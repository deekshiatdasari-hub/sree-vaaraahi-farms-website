/**
 * Helpers for the page-generating tools: a page template (the shared head, header and
 * footer are filled in by sync-partials.mjs) and a small Markdown converter for the
 * policy texts in content/.
 */

export const SITE = 'https://www.sreevaaraahifarms.in';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => ESCAPES[ch]);

/** A full page. `path` is the page's address, e.g. "/privacy-policy/". */
export function renderPage({ title, description, path, nav = '', head = '', body, noindex = false }) {
  return `<!doctype html>
<html lang="en">
<head>
<!-- partial:head --><!-- /partial:head -->
<title>${esc(title)} · Sree Vaaraahi Farms</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)} · Sree Vaaraahi Farms">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}${head}</head>
<body${nav ? ` data-nav="${nav}"` : ''}>
<!-- partial:header --><!-- /partial:header -->

<main id="main">
${body}
</main>

<!-- partial:footer --><!-- /partial:footer -->
</body>
</html>
`;
}

/** Links to the live site become site-relative, so they also work on preview addresses. */
const localLink = (url) => url.replace(/^https?:\/\/(www\.)?sreevaaraahifarms\.in/, '') || '/';

function inline(text) {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a href="${esc(localLink(url))}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

/**
 * Converts the subset of Markdown used in content/*.txt:
 * ### headings, paragraphs, - and 1. lists, | tables |, **bold**, *italic* and [links](url).
 * The first "*Effective from …*" line becomes a styled note.
 */
export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length === 2 ? 2 : heading[1].length === 3 ? 2 : 3;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (row) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push(
        `<table>\n<thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>\n<tbody>\n${body
          .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('\n')}\n</tbody>\n</table>`,
      );
      continue;
    }
    if (/^-\s/.test(line) || /^\d+\.\s/.test(line)) {
      const ordered = /^\d+\.\s/.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\.\s/ : /^-\s/).test(lines[i])) {
        items.push(lines[i++].replace(ordered ? /^\d+\.\s+/ : /^-\s+/, ''));
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>\n${items.map((item) => `<li>${inline(item)}</li>`).join('\n')}\n</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\||-\s|\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
    const text = para.join(' ');
    const effective = /^\*Effective from ([^*]+)\*$/.exec(text.trim());
    out.push(effective ? `<p class="effective">Effective from ${esc(effective[1])}</p>` : `<p>${inline(text)}</p>`);
  }
  return out.join('\n');
}
