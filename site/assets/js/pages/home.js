import { loadCatalog } from '../api.js';
import { esc, isProductSoldOut } from '../lib.js';
import { productCard, skeletonCards } from '../ui.js';

const categoriesEl = document.getElementById('categories');
const freshEl = document.getElementById('fresh');
freshEl.innerHTML = skeletonCards(6);

/** Up to `limit` in-stock products, taking turns between categories so the row is varied. */
function varied(products, limit) {
  const byCategory = new Map();
  for (const product of products) {
    if (isProductSoldOut(product)) continue;
    if (!byCategory.has(product.categoryId)) byCategory.set(product.categoryId, []);
    byCategory.get(product.categoryId).push(product);
  }
  const queues = [...byCategory.values()];
  const picked = [];
  while (picked.length < limit && queues.some((q) => q.length)) {
    for (const queue of queues) if (queue.length && picked.length < limit) picked.push(queue.shift());
  }
  return picked;
}

function render({ categories, products }) {
  categoriesEl.innerHTML = categories
    .map((c) => {
      const art = c.image?.uri
        ? `<img src="${esc(c.image.uri)}" alt="" loading="lazy" width="480" height="480">`
        : `<span aria-hidden="true">${esc(c.emoji)}</span>`;
      return `<a class="cat-card" href="/shop/?category=${encodeURIComponent(c.id)}"><span class="thumb" style="background:${esc(c.tint)}">${art}</span><strong>${esc(c.name)}</strong></a>`;
    })
    .join('');

  const fresh = varied(products, 12);
  freshEl.innerHTML = fresh.length
    ? fresh.map(productCard).join('')
    : '<p class="muted">This week\'s harvest is being updated. Please check back soon.</p>';
}

loadCatalog(render).catch((error) => {
  categoriesEl.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>${esc(error.message)}</p><button class="btn btn-outline" type="button" id="retry">Try again</button></div>`;
  freshEl.innerHTML = '';
  document.getElementById('retry').addEventListener('click', () => location.reload());
});
