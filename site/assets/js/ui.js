/**
 * Shared page behaviour: header menu, cart count, floating cart bar, toasts,
 * and the product cards with their Add / quantity buttons.
 */

import { cachedCatalog } from './api.js';
import { cart, resolveCart } from './cart.js';
import {
  defaultVariant,
  esc,
  formatPrice,
  isProductSoldOut,
  isVariantInStock,
  lowStockLabel,
} from './lib.js';

/* ---------- Header ---------- */

function initHeader() {
  const page = document.body.dataset.nav;
  if (page) {
    for (const link of document.querySelectorAll(`[data-nav="${page}"]`)) {
      if (link !== document.body) link.setAttribute('aria-current', 'page');
    }
  }

  const menu = document.getElementById('mobile-nav');
  const toggle = document.querySelector('.menu-toggle');
  if (!menu || !toggle) return;
  const open = (state) => {
    menu.classList.toggle('open', state);
    toggle.setAttribute('aria-expanded', String(state));
    document.body.style.overflow = state ? 'hidden' : '';
    if (state) menu.querySelector('a, button')?.focus();
    else toggle.focus();
  };
  toggle.addEventListener('click', () => open(true));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) open(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('open')) open(false);
  });
}

/* ---------- Cart count & floating cart bar ---------- */

function updateCartIndicators() {
  const products = cachedCatalog()?.products;
  // With a catalog, count only items the shop still has (as the cart page does).
  const count = products ? resolveCart(products).items.reduce((n, i) => n + i.qty, 0) : cart.count();
  for (const badge of document.querySelectorAll('.cart-count')) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
  for (const link of document.querySelectorAll('.cart-link')) {
    link.setAttribute('aria-label', count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart');
  }

  const bar = document.querySelector('.cart-bar');
  if (!bar) return;
  const show = count > 0 && Boolean(products) && !document.body.hasAttribute('data-no-cart-bar');
  bar.classList.toggle('show', show);
  document.body.classList.toggle('has-cart-bar', show);
  if (show) {
    const { subtotal } = resolveCart(products);
    bar.querySelector('[data-count]').textContent = `${count} item${count === 1 ? '' : 's'}`;
    bar.querySelector('[data-total]').textContent = formatPrice(subtotal);
  }
}

/* ---------- Toasts ---------- */

export function toast(message, { error = false } = {}) {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const item = document.createElement('div');
  item.className = `toast${error ? ' error' : ''}`;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 3200);
}

/* ---------- Product cards ---------- */

/** Products shown on this page, so the buttons know names and stock limits. */
const shown = new Map();

export function productUrl(product) {
  return `/product/?id=${encodeURIComponent(product.id)}`;
}

export function productImage(product, { eager = false } = {}) {
  if (product.image?.uri) {
    return `<img src="${esc(product.image.uri)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="480" height="480">`;
  }
  return `<span class="emoji" style="background:${esc(product.tint)}" aria-hidden="true">${esc(product.emoji)}</span>`;
}

function maxQty(variant) {
  return variant.stock === null ? 99 : Math.max(0, variant.stock);
}

/** The Add button, or − qty + once the item is in the cart. */
export function buyControl(product, variant, { large = false } = {}) {
  shown.set(product.id, product);
  const attrs = `data-p="${esc(product.id)}" data-v="${esc(variant.id)}"`;
  if (!isVariantInStock(variant)) {
    return `<div class="buy-control" ${attrs}><button class="add-btn" type="button" disabled>Sold out</button></div>`;
  }
  const qty = cart.qty(product.id, variant.id);
  if (qty === 0) {
    return `<div class="buy-control" ${attrs}><button class="add-btn${large ? ' btn-lg' : ''}" type="button" data-add aria-label="Add ${esc(product.name)} to cart">Add</button></div>`;
  }
  return `<div class="buy-control" ${attrs}>
    <div class="stepper${large ? ' lg' : ''}" role="group" aria-label="Quantity of ${esc(product.name)}">
      <button type="button" data-dec aria-label="Remove one">−</button>
      <output aria-live="polite">${qty}</output>
      <button type="button" data-inc aria-label="Add one" ${qty >= maxQty(variant) ? 'disabled' : ''}>+</button>
    </div></div>`;
}

export function productCard(product) {
  const variant = defaultVariant(product);
  const soldOut = isProductSoldOut(product);
  const low = lowStockLabel(variant);
  const tag = soldOut
    ? '<span class="badge badge-danger tag">Sold out</span>'
    : low
      ? `<span class="badge badge-gold tag">${esc(low)}</span>`
      : '';
  const mrp = variant.mrp && variant.mrp > variant.price ? `<s>${formatPrice(variant.mrp)}</s>` : '';
  return `<article class="product-card${soldOut ? ' sold-out' : ''}">
    <a class="thumb" href="${productUrl(product)}" tabindex="-1" aria-hidden="true">${productImage(product)}${tag}</a>
    <div class="body">
      <a class="name" href="${productUrl(product)}">${esc(product.name)}</a>
      <div class="pack">${esc(variant.label)}</div>
      <div class="buy">
        <span class="price">${formatPrice(variant.price)}${mrp}</span>
        ${buyControl(product, variant)}
      </div>
    </div>
  </article>`;
}

export function skeletonCards(count) {
  return Array.from({ length: count }, () => '<div class="skeleton skeleton-card" aria-hidden="true"></div>').join('');
}

function refreshBuyControls() {
  const active = document.activeElement;
  for (const el of document.querySelectorAll('.buy-control')) {
    const product = shown.get(el.dataset.p);
    const variant = product?.variants.find((v) => v.id === el.dataset.v);
    if (!variant) continue;
    const large = el.querySelector('.lg, .btn-lg') !== null;
    // Keep keyboard focus on the matching button when Add turns into − / + and back.
    const focused = el.contains(active) ? (active.matches('[data-dec]') ? 'dec' : 'inc') : null;
    const template = document.createElement('template');
    template.innerHTML = buyControl(product, variant, { large }).trim();
    const fresh = template.content.firstElementChild;
    el.replaceWith(fresh);
    if (focused) {
      (
        fresh.querySelector(`[data-${focused}]:not([disabled])`) ??
        fresh.querySelector('button:not([disabled])')
      )?.focus();
    }
  }
}

function onBuyClick(event) {
  const button = event.target.closest('.buy-control button');
  if (!button || button.disabled) return;
  const control = button.closest('.buy-control');
  const product = shown.get(control.dataset.p);
  const variant = product?.variants.find((v) => v.id === control.dataset.v);
  if (!variant) return;
  const qty = cart.qty(product.id, variant.id);
  if (button.matches('[data-add]')) {
    cart.set(product.id, variant.id, 1, maxQty(variant));
  } else if (button.matches('[data-inc]')) {
    cart.set(product.id, variant.id, qty + 1, maxQty(variant));
  } else if (button.matches('[data-dec]')) {
    cart.set(product.id, variant.id, qty - 1, maxQty(variant));
  }
}

/* ---------- Start ---------- */

initHeader();
updateCartIndicators();
document.addEventListener('click', onBuyClick);
document.addEventListener('cart:change', () => {
  refreshBuyControls();
  updateCartIndicators();
});
// A fresh catalog from the server: forget cart lines for products the shop no longer has.
document.addEventListener('catalog:loaded', () => {
  cart.prune(cachedCatalog()?.products);
  updateCartIndicators();
});
