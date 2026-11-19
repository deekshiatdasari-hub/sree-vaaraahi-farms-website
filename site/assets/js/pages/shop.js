import { loadCatalog } from '../api.js';
import { esc, inStockFirst, isProductSoldOut } from '../lib.js';
import { productCard, skeletonCards } from '../ui.js';

const params = new URLSearchParams(location.search);
const state = {
  category: params.get('category') ?? '',
  query: params.get('q') ?? '',
  inStockOnly: params.get('instock') === '1',
};

const titleEl = document.getElementById('shop-title');
const searchEl = document.getElementById('search');
const chipsEl = document.getElementById('categories');
const gridEl = document.getElementById('products');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');
const inStockEl = document.getElementById('in-stock');

searchEl.value = state.query;
inStockEl.checked = state.inStockOnly;
gridEl.innerHTML = skeletonCards(10);
if (location.hash === '#search') searchEl.focus();

let catalog = null;

/** Lower-case words, so "Toor dal" finds "Pigeon peas / Kandulu / Toor Dal". */
const words = (text) => text.toLowerCase().split(/[^a-z0-9ఀ-౿]+/).filter(Boolean);

function matches(product, query) {
  if (!query) return true;
  const haystack = `${product.name} ${product.variants.map((v) => v.label).join(' ')}`.toLowerCase();
  return words(query).every((word) => haystack.includes(word));
}

function syncUrl() {
  const next = new URLSearchParams();
  if (state.category) next.set('category', state.category);
  if (state.query) next.set('q', state.query);
  if (state.inStockOnly) next.set('instock', '1');
  const qs = next.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function renderChips() {
  const chip = (id, name) =>
    `<button class="chip" type="button" data-category="${esc(id)}" aria-pressed="${state.category === id}">${esc(name)}</button>`;
  chipsEl.innerHTML = chip('', 'All') + catalog.categories.map((c) => chip(c.id, c.name)).join('');
}

function renderProducts() {
  const category = catalog.categories.find((c) => c.id === state.category);
  titleEl.textContent = category ? category.name : 'Shop';
  document.title = `${category ? category.name : 'Shop'} · Sree Vaaraahi Farms`;

  const list = inStockFirst(
    catalog.products.filter(
      (p) =>
        (!state.category || p.categoryId === state.category) &&
        (!state.inStockOnly || !isProductSoldOut(p)) &&
        matches(p, state.query),
    ),
  );
  gridEl.innerHTML = list.map(productCard).join('');
  emptyEl.hidden = list.length > 0;
  const inStock = list.filter((p) => !isProductSoldOut(p)).length;
  countEl.textContent = list.length
    ? `${list.length} product${list.length === 1 ? '' : 's'} · ${inStock} in stock`
    : '';
}

function render(next) {
  catalog = next;
  renderChips();
  renderProducts();
}

chipsEl.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-category]');
  if (!chip || !catalog) return;
  state.category = chip.dataset.category;
  for (const el of chipsEl.children) el.setAttribute('aria-pressed', String(el === chip));
  syncUrl();
  renderProducts();
});

let searchTimer;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = searchEl.value.trim();
    syncUrl();
    if (catalog) renderProducts();
  }, 150);
});

inStockEl.addEventListener('change', () => {
  state.inStockOnly = inStockEl.checked;
  syncUrl();
  if (catalog) renderProducts();
});

loadCatalog(render).catch((error) => {
  gridEl.innerHTML = '';
  emptyEl.hidden = false;
  emptyEl.innerHTML = `<div class="big" aria-hidden="true">📡</div><h2>Couldn't load products</h2><p>${esc(error.message)}</p><button class="btn btn-outline" type="button" id="retry">Try again</button>`;
  document.getElementById('retry').addEventListener('click', () => location.reload());
});
