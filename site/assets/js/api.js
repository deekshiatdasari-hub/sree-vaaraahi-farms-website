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
  constructor(message, status) {
    super(message);
    this.status = status;
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
    if (!res.ok) throw new ApiError(data?.message ?? 'Something went wrong. Please try again.', res.status);
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
