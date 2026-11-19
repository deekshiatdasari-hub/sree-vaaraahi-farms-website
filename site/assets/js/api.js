/**
 * Talks to the shop server (the same one the app uses). The catalog is cached in the
 * browser so repeat visits show products instantly while a fresh copy loads.
 */

import { API_URL } from './config.js';

const CACHE_KEY = 'svf.catalog.v1';
/** A cached catalog younger than this is used without asking the server again. */
const FRESH_MS = 2 * 60 * 1000;
/** If the server can't be reached, a cached catalog up to this old is still shown. */
const STALE_LIMIT_MS = 24 * 60 * 60 * 1000;

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    /** The server's full reply, e.g. { error: "stock", items: [...] } for sold-out items. */
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, headers = {}, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.message ?? 'Something went wrong. Please try again.', res.status, data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Could not reach the shop. Check your internet connection and try again.', 0);
  } finally {
    clearTimeout(timer);
  }
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    return cached && Array.isArray(cached.products) ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(catalog) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(catalog));
  } catch {
    // Storage full or blocked: the site still works, just without the cache.
  }
}

const PAYMENTS_KEY = 'svf.payments.v1';

/**
 * True when the server takes online payments (Razorpay), so the cart offers checkout;
 * false means WhatsApp ordering. Remembered for a few minutes per browser tab.
 */
export async function paymentsOpen() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PAYMENTS_KEY));
    if (saved && Date.now() - saved.at < 5 * 60 * 1000) return saved.open;
  } catch {
    // No saved answer; ask the server.
  }
  try {
    const health = await request('/health', { timeoutMs: 6000 });
    const open = health?.payments === 'razorpay';
    try {
      sessionStorage.setItem(PAYMENTS_KEY, JSON.stringify({ at: Date.now(), open }));
    } catch {
      // Storage blocked: ask again next time.
    }
    return open;
  } catch {
    return false;
  }
}

/** Forgets the cached catalog, e.g. after the server reports that items sold out. */
export function clearCatalogCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing cached.
  }
}

/** The last catalog this browser saw, for quick totals (e.g. the cart bar); may be null. */
export function cachedCatalog() {
  return readCache();
}

async function fetchCatalog() {
  const [categories, products] = await Promise.all([request('/categories'), request('/products')]);
  const catalog = { at: Date.now(), categories, products };
  writeCache(catalog);
  document.dispatchEvent(new CustomEvent('catalog:loaded'));
  return catalog;
}

/**
 * Calls `render(catalog)` as soon as products are available: right away from the cache
 * if there is one, and again when a fresher copy arrives. Rejects only when there is
 * nothing at all to show.
 */
export async function loadCatalog(render) {
  const cached = readCache();
  const age = cached ? Date.now() - cached.at : Infinity;
  if (cached && age < STALE_LIMIT_MS) render(cached);
  if (cached && age < FRESH_MS) return;
  try {
    render(await fetchCatalog());
  } catch (error) {
    if (!cached || age >= STALE_LIMIT_MS) throw error;
  }
}

export const api = { request };
