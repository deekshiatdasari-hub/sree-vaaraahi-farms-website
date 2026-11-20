/**
 * The cart, kept in this browser. Lines are { productId, variantId, qty }, like the app.
 * Every change fires a "cart:change" event so the header, cart bar and buttons update.
 */

import { Delivery } from './config.js';
import { isVariantInStock } from './lib.js';

const KEY = 'svf.cart.v1';

function read() {
  try {
    const lines = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(lines) ? lines.filter((l) => l && l.productId && l.variantId && l.qty > 0) : [];
  } catch {
    return [];
  }
}

let lines = read();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked (private mode on some browsers): the cart lasts for this page only.
  }
  document.dispatchEvent(new CustomEvent('cart:change'));
}

// Keep tabs in sync.
window.addEventListener('storage', (event) => {
  if (event.key === KEY) {
    lines = read();
    document.dispatchEvent(new CustomEvent('cart:change'));
  }
});

export const cart = {
  lines: () => lines.map((l) => ({ ...l })),

  qty(productId, variantId) {
    return lines.find((l) => l.productId === productId && l.variantId === variantId)?.qty ?? 0;
  },

  count: () => lines.reduce((sum, l) => sum + l.qty, 0),

  /** Sets a line's quantity; 0 removes it. `max` caps it at the stock left. */
  set(productId, variantId, qty, max = Infinity) {
    const next = Math.max(0, Math.min(qty, max));
    const existing = lines.find((l) => l.productId === productId && l.variantId === variantId);
    if (existing && next === 0) lines = lines.filter((l) => l !== existing);
    else if (existing) existing.qty = next;
    else if (next > 0) lines.push({ productId, variantId, qty: next });
    save();
  },

  clear() {
    lines = [];
    save();
  },

  /**
   * Drops lines for products or pack sizes the shop no longer has (deleted or unpublished in
   * WooCommerce), which would otherwise count in the header and cart bar while the cart page
   * can't show them. Sold-out items stay: the catalog still lists them. Call it with a fresh
   * catalog from the server only.
   */
  prune(products) {
    // An empty catalog means the shop didn't answer properly, not that everything was deleted.
    if (!products?.length) return;
    const byId = new Map(products.map((p) => [p.id, p]));
    const kept = lines.filter((l) => byId.get(l.productId)?.variants.some((v) => v.id === l.variantId));
    if (kept.length === lines.length) return;
    lines = kept;
    save();
  },
};

/**
 * Joins cart lines with the current catalog. Lines whose product has disappeared are
 * dropped; sold-out or over-stock lines are kept but flagged so the customer can fix them.
 */
export function resolveCart(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) continue;
    const available = variant.stock === null ? Infinity : Math.max(0, variant.stock);
    items.push({
      ...line,
      product,
      variant,
      soldOut: !isVariantInStock(variant),
      overStock: line.qty > available,
      available,
      lineTotal: variant.price * line.qty,
    });
  }
  const orderable = items.filter((i) => !i.soldOut);
  const subtotal = orderable.reduce((sum, i) => sum + i.variant.price * Math.min(i.qty, i.available), 0);
  const freeDelivery = subtotal >= Delivery.freeDeliveryMin;
  return {
    items,
    subtotal,
    freeDelivery,
    toFreeDelivery: Math.max(0, Delivery.freeDeliveryMin - subtotal),
    hasProblems: items.some((i) => i.soldOut || i.overStock),
  };
}
