import { cart } from '../cart.js';
import { Delivery } from '../config.js';
import { loadCatalog } from '../api.js';
import {
  defaultVariant,
  esc,
  formatDeliveryDate,
  formatPrice,
  getDeliveryOptions,
  isProductSoldOut,
  isVariantInStock,
  lowStockLabel,
} from '../lib.js';
import { buyControl, productCard, productImage } from '../ui.js';

const id = new URLSearchParams(location.search).get('id');
const pdpEl = document.getElementById('pdp');
let product = null;
let category = null;
let variantId = null;

const icon = {
  truck:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12 12 20 4 12V4h8l8 8Z"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
};

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.append(tag);
  }
  tag.content = content;
}

/** Product details for search engines (Google reads this even when added by script). */
function structuredData(variant) {
  let tag = document.getElementById('product-ld');
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'product-ld';
    document.head.append(tag);
  }
  tag.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: product.image?.uri,
    brand: { '@type': 'Brand', name: 'Sree Vaaraahi Farms' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: variant.price,
      availability: isVariantInStock(variant) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: location.href,
    },
  });
}

const selectedVariant = () => product.variants.find((v) => v.id === variantId) ?? defaultVariant(product);

/** Shows "Go to cart" once this pack is in the cart. The − / + buttons update themselves (ui.js). */
function renderGoToCart() {
  const variant = selectedVariant();
  document.getElementById('go-cart').innerHTML =
    cart.qty(product.id, variant.id) > 0 ? '<a class="btn btn-outline btn-lg" href="/cart/">Go to cart</a>' : '';
}

function renderBuyArea() {
  const variant = selectedVariant();
  const low = lowStockLabel(variant);
  document.getElementById('price').innerHTML =
    `${formatPrice(variant.price)}${variant.mrp && variant.mrp > variant.price ? ` <s class="muted" style="font-size:1rem;font-weight:500">${formatPrice(variant.mrp)}</s>` : ''}`;
  document.getElementById('pack').textContent = variant.label || '';
  document.getElementById('stock').innerHTML = !isVariantInStock(variant)
    ? '<span class="badge badge-danger">Sold out</span> <span class="muted">Back soon. Check again before the next delivery day.</span>'
    : low
      ? `<span class="badge badge-gold">${esc(low)}</span>`
      : '';
  document.getElementById('buy').innerHTML = `${buyControl(product, variant, { large: true })}<span id="go-cart"></span>`;
  renderGoToCart();
  structuredData(variant);
}

function render({ categories, products }) {
  product = products.find((p) => p.id === id);
  if (!product) {
    document.title = 'Product not found · Sree Vaaraahi Farms';
    pdpEl.outerHTML = `<div class="empty" style="padding:72px 16px"><div class="big" aria-hidden="true">🔍</div><h1 style="font-size:1.8rem">We couldn't find that product</h1><p>It may have been removed. Have a look at what's in stock.</p><a class="btn btn-primary" href="/shop/">Go to the shop</a></div>`;
    return;
  }
  category = categories.find((c) => c.id === product.categoryId);
  variantId = variantId ?? defaultVariant(product).id;

  document.title = `${product.name} · Sree Vaaraahi Farms`;
  setMeta('description', (product.description || `${product.name}, delivered across Hyderabad every Wednesday and Saturday.`).slice(0, 160));

  const days = getDeliveryOptions()
    .map((d) => formatDeliveryDate(d.date))
    .join(' or ');
  const variants =
    product.variants.length > 1
      ? `<div class="variant-list" role="group" aria-label="Pack size">${product.variants
          .map(
            (v) =>
              `<button class="chip" type="button" data-variant="${esc(v.id)}" aria-pressed="${v.id === variantId}">${esc(v.label || 'Standard')} · ${formatPrice(v.price)}</button>`,
          )
          .join('')}</div>`
      : '';

  pdpEl.innerHTML = `
    <div class="pdp-media" style="background:${esc(product.tint)}">${productImage(product, { eager: true })}</div>
    <div class="pdp-info">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> / <a href="/shop/">Shop</a>${category ? ` / <a href="/shop/?category=${encodeURIComponent(category.id)}">${esc(category.name)}</a>` : ''}
      </nav>
      <h1>${esc(product.name)}</h1>
      <div class="muted" id="pack"></div>
      <div class="pdp-price" id="price"></div>
      <div id="stock"></div>
      ${variants}
      <div class="pdp-buy" id="buy"></div>
      <ul class="info-list">
        <li>${icon.truck}<span><strong>Next delivery:</strong> ${esc(days)}. We deliver across Hyderabad every Wednesday and Saturday.</span></li>
        <li>${icon.tag}<span><strong>Free delivery</strong> on orders of ${formatPrice(Delivery.freeDeliveryMin)} or more. Below that, pay the Rapido fare to the rider.</span></li>
        <li>${icon.shield}<span><strong>Freshness promise:</strong> if anything arrives damaged, send us a photo within 4 hours and we'll refund or replace it.</span></li>
      </ul>
      ${product.description ? `<h2 style="font-size:1.2rem;font-family:var(--font-body)">About this product</h2><p class="muted">${esc(product.description)}</p>` : ''}
    </div>`;
  renderBuyArea();

  const related = products
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id && !isProductSoldOut(p))
    .slice(0, 10);
  const section = document.getElementById('related-section');
  section.hidden = related.length === 0;
  document.getElementById('related').innerHTML = related.map(productCard).join('');
  if (category) document.getElementById('related-link').href = `/shop/?category=${encodeURIComponent(category.id)}`;
}

pdpEl.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-variant]');
  if (!chip) return;
  variantId = chip.dataset.variant;
  for (const el of pdpEl.querySelectorAll('[data-variant]')) el.setAttribute('aria-pressed', String(el === chip));
  renderBuyArea();
});

document.addEventListener('cart:change', () => {
  if (product) renderGoToCart();
});

if (!id) {
  location.replace('/shop/');
} else {
  loadCatalog(render).catch((error) => {
    pdpEl.innerHTML = `<div class="empty" style="grid-column:1/-1"><h1 style="font-size:1.6rem">Couldn't load this product</h1><p>${esc(error.message)}</p><button class="btn btn-outline" type="button" id="retry">Try again</button></div>`;
    document.getElementById('retry').addEventListener('click', () => location.reload());
  });
}
