/**
 * Builds the policy pages from the approved texts in content/.
 * Edit the .txt files (or the Claude Doc they came from), then run:
 *   npm run policies
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { markdownToHtml, renderPage } from './page.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const pages = [
  {
    file: '1-terms-and-conditions.txt',
    slug: 'terms-and-conditions',
    title: 'Terms & Conditions',
    description: 'The terms for browsing and ordering from Sree Vaaraahi Farms on our website and app.',
  },
  {
    file: '2-privacy-policy.txt',
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    description: 'What personal information Sree Vaaraahi Farms collects, why, and your choices.',
  },
  {
    file: '3-refund-policy.txt',
    slug: 'refund-policy',
    title: 'Cancellation & Refund Policy',
    description: 'How to cancel an order, report a problem, and when refunds are paid.',
  },
  {
    file: '4-shipping-policy.txt',
    slug: 'shipping-policy',
    title: 'Shipping & Delivery Policy',
    description: 'Where and when we deliver in Hyderabad, and what delivery costs.',
  },
  {
    file: '6-delete-account.txt',
    slug: 'delete-account',
    title: 'Delete your account',
    description: 'How to delete your Sree Vaaraahi Farms account, and what we delete and keep.',
  },
];

for (const page of pages) {
  const text = readFileSync(join(root, 'content', page.file), 'utf8');
  const html = renderPage({
    title: page.title,
    description: page.description,
    path: `/${page.slug}/`,
    body: `  <div class="page-head">
    <div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Policies</nav>
      <h1>${page.title.replace('&', '&amp;')}</h1>
    </div>
  </div>
  <div class="container">
    <article class="prose">
${markdownToHtml(text)}
    </article>
  </div>`,
  });
  const dir = join(root, 'site', page.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  console.log('built', `/${page.slug}/`);
}
