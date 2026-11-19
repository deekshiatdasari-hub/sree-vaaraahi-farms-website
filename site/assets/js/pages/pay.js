/**
 * The payment page. The app opens it in a browser tab with a Razorpay order id:
 *   /pay/?order=order_XXXX[&env=staging][&return=sreevaaraahifarms://payment-result]
 * It runs Razorpay Checkout, sends the result to the shop server to verify, and offers a way back
 * to the app. The server checks every payment with Razorpay; this page never decides on its own.
 */

import { cart } from '../cart.js';
import { API_URL, Business, STAGING_API } from '../config.js';
import { esc, formatPrice } from '../lib.js';

const params = new URLSearchParams(location.search);
const orderId = params.get('order') ?? '';
const api = params.get('env') === 'staging' ? STAGING_API : API_URL;
/** Only the app's own addresses are accepted as a way back, so this page can't send people elsewhere. */
const APP_SCHEMES = ['sreevaaraahifarms://', 'exp+sree-vaaraahi-farms://'];
const back = params.get('return');
const returnUrl = back && APP_SCHEMES.some((scheme) => back.startsWith(scheme)) ? back : null;

const stateEl = document.getElementById('pay-state');
let details = null;

function backLink(status) {
  // Website checkout (no app to return to).
  if (!returnUrl) {
    return status === 'paid'
      ? '<a class="btn btn-primary btn-lg btn-block" href="/shop/">Continue shopping</a>'
      : '<a class="btn btn-outline btn-lg btn-block" href="/cart/">Back to cart</a>';
  }
  const sep = returnUrl.includes('?') ? '&' : '?';
  const href = `${returnUrl}${sep}status=${status}${details ? `&order=${encodeURIComponent(details.orderNumber)}` : ''}`;
  return `<a class="btn btn-primary btn-lg btn-block" href="${esc(href)}" id="back">Back to the app</a>`;
}

function show(html) {
  stateEl.innerHTML = html;
}

function showPaid(orderNumber) {
  // Paid from the website's own checkout: the basket in this browser is done with.
  if (!returnUrl) cart.clear();
  show(`<div class="pay-icon ok" aria-hidden="true">✓</div>
    <h1>Payment received</h1>
    <p class="muted">Order #${esc(orderNumber)} is confirmed. We'll deliver it on your chosen day.</p>
    ${backLink('paid')}`);
  // Try to return on its own; browsers that need a tap still have the button.
  if (returnUrl) setTimeout(() => document.getElementById('back')?.click(), 1200);
}

function showPending(message) {
  show(`<div class="pay-icon" aria-hidden="true">⏳</div>
    <h1>Confirming your payment</h1>
    <p class="muted">${esc(message)}</p>
    ${backLink('paid')}`);
}

function showCancelled() {
  show(`<div class="pay-icon" aria-hidden="true">🧺</div>
    <h1>Payment not completed</h1>
    <p class="muted">You haven't been charged. You can try again, or go back and your cart will still be there.</p>
    <button class="btn btn-gold btn-lg btn-block" type="button" id="retry">Try again</button>
    <div style="height:10px"></div>
    ${backLink('cancelled')}`);
  document.getElementById('retry').addEventListener('click', openCheckout);
}

function showProblem(message) {
  show(`<div class="pay-icon bad" aria-hidden="true">!</div>
    <h1>We couldn't open the payment</h1>
    <p class="muted">${esc(message)}</p>
    <p class="muted">Need help? WhatsApp us at <a href="https://wa.me/${Business.whatsapp}">${Business.phoneDisplay}</a>.</p>
    ${backLink('cancelled')}`);
}

function showReady() {
  show(`<h1>Order #${esc(details.orderNumber)}</h1>
    <p class="pay-amount">${formatPrice(details.amount / 100)}</p>
    <button class="btn btn-primary btn-lg btn-block" type="button" id="pay">Pay ${formatPrice(details.amount / 100)}</button>`);
  document.getElementById('pay').addEventListener('click', openCheckout);
}

async function call(path, body) {
  const res = await fetch(`${api}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.message ?? 'Something went wrong. Please try again.');
    error.status = res.status;
    throw error;
  }
  return data;
}

async function verify(response) {
  show('<h1>Confirming your payment…</h1><div class="skeleton" style="height:52px"></div>');
  try {
    const result = await call(`/payments/${encodeURIComponent(orderId)}/verify`, {
      paymentId: response.razorpay_payment_id,
      signature: response.razorpay_signature,
    });
    showPaid(result.orderNumber);
  } catch (error) {
    // 402: paid, but Razorpay hasn't confirmed yet. The server's webhook will finish it.
    if (error.status === 402) showPending(error.message);
    else showProblem(error.message);
  }
}

function openCheckout() {
  if (!window.Razorpay) {
    showProblem('The payment window could not load. Check your internet connection and try again.');
    return;
  }
  const checkout = new window.Razorpay({
    key: details.keyId,
    order_id: details.razorpayOrderId,
    amount: details.amount,
    currency: 'INR',
    name: Business.name,
    description: `Order #${details.orderNumber}`,
    image: `${location.origin}/assets/img/apple-touch-icon.png`,
    prefill: details.prefill,
    theme: { color: '#1B5E3F' },
    handler: verify,
    modal: { ondismiss: showCancelled, confirm_close: true },
  });
  showReady();
  checkout.open();
}

async function start() {
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId)) {
    showProblem('This payment link is incomplete. Please start the payment again from the app.');
    return;
  }
  try {
    details = await call(`/payments/${encodeURIComponent(orderId)}`);
  } catch (error) {
    showProblem(error.message);
    return;
  }
  if (details.status === 'paid') {
    showPaid(details.orderNumber);
    return;
  }
  // checkout.js is loaded with "defer", so it's ready once the page has finished loading.
  if (document.readyState === 'complete') openCheckout();
  else window.addEventListener('load', openCheckout, { once: true });
}

start();
