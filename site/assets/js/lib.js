/** Small helpers shared by every page. Ported from the app's src/lib so both behave the same. */

import { Delivery } from './config.js';

export function formatPrice(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text from the shop before it goes into HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/* ---------- Products ---------- */

export function isVariantInStock(variant) {
  return variant.stock === null || variant.stock > 0;
}

export function isProductSoldOut(product) {
  return !product.variants.some(isVariantInStock);
}

/** The variant to show first: the first one in stock, else the first one. */
export function defaultVariant(product) {
  return product.variants.find(isVariantInStock) ?? product.variants[0];
}

export function lowStockLabel(variant) {
  if (variant.stock === null || variant.stock <= 0) return null;
  return variant.stock <= Delivery.lowStockThreshold ? `Only ${variant.stock} left` : null;
}

/** "Carrot (500 g)", or just "Amla" when the shop gives no pack size. */
export function withPack(name, pack) {
  return pack ? `${name} (${pack})` : name;
}

/** In-stock products first, keeping the shop's order within each group. */
export function inStockFirst(products) {
  return [...products].sort((a, b) => Number(isProductSoldOut(a)) - Number(isProductSoldOut(b)));
}

/* ---------- Delivery days (India time, whatever the visitor's time zone) ---------- */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Delivery days the customer may choose, in order. Same rules as the app:
 * no cutoff time, never the same day, and only days within the next `windowDays`.
 */
export function getDeliveryOptions(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const todayUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const options = [];
  for (let offset = 1; offset <= Delivery.windowDays; offset++) {
    const day = new Date(todayUtc + offset * DAY_MS);
    if (Delivery.weekdays.includes(day.getUTCDay())) {
      options.push({ date: day.toISOString().slice(0, 10), weekday: day.getUTCDay() });
    }
  }
  return options;
}

/** "Wed, 25 Nov" (or "Wednesday, 25 Nov") for a YYYY-MM-DD date. */
export function formatDeliveryDate(date, long = false) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${(long ? WEEKDAYS_LONG : WEEKDAYS)[weekday]}, ${d} ${MONTHS[m - 1]}`;
}

/* ---------- Delivery area ---------- */

/** Hyderabad 500xxx plus a few outskirts on 501/502. Same list as the app. */
const EXTRA_PINCODES = new Set(['501401', '501504', '501505', '501510', '501511', '502032', '502319', '502325']);

export function isValidPincode(pincode) {
  return /^[1-9]\d{5}$/.test(pincode);
}

export function isServiceablePincode(pincode) {
  return isValidPincode(pincode) && (pincode.startsWith('500') || EXTRA_PINCODES.has(pincode));
}
