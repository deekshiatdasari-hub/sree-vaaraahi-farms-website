/**
 * Guest checkout: delivery details, then the order is created on the server and the customer
 * pays on /pay/ (Razorpay). Details are remembered in this browser for next time.
 */

import { api, ApiError, clearCatalogCache, loadCatalog, paymentsOpen } from '../api.js';
import { resolveCart } from '../cart.js';
import { Business, Delivery } from '../config.js';
import { esc, formatDeliveryDate, formatPrice, getDeliveryOptions, isServiceablePincode, withPack } from '../lib.js';

const SAVED_KEY = 'svf.customer.v1';
const params = new URLSearchParams(location.search);
const days = getDeliveryOptions();
const root = document.getElementById('checkout-root');
let products = null;
let online = null;
let chosenDay = days.some((d) => d.date === params.get('day')) ? params.get('day') : days[0]?.date;

function saved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) ?? {};
  } catch {
    return {};
  }
}

function remember(details) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(details));
  } catch {
    // Storage blocked: they'll type their details again next time.
  }
}

/** "+91 98765 43210" → "9876543210". */
const mobileOf = (text) => {
  const digits = String(text).replace(/\D/g, '');
  return (digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits).slice(0, 10);
};

function field({ id, label, value = '', hint = '', attrs = '' }) {
  return `<div class="field">
    <label for="${id}">${label}</label>
    <input id="${id}" name="${id}" value="${esc(value)}" ${attrs}>
    ${hint ? `<span class="hint">${hint}</span>` : ''}
  </div>`;
}

function notice(title, message) {
  root.innerHTML = `<div class="empty" style="padding:56px 16px">
    <div class="big" aria-hidden="true">🧺</div>
    <h2>${esc(title)}</h2>
    <p>${message}</p>
    <a class="btn btn-primary btn-lg" href="/cart/">Back to cart</a>
  </div>`;
}

function render() {
  if (!products || online === null) return;
  const summary = resolveCart(products);
  if (summary.items.length === 0) {
    location.replace('/cart/');
    return;
  }
  if (!online) {
    notice(
      'Online payment opens soon',
      `For now, please send your order on WhatsApp from your cart, or message us at <a href="https://wa.me/${Business.whatsapp}">${Business.phoneDisplay}</a>.`,
    );
    return;
  }
  if (summary.hasProblems) {
    notice('Some items need your attention', 'An item in your cart sold out or has less stock left. Please update your cart.');
    return;
  }

  const me = saved();
  const pin = /^\d{6}$/.test(params.get('pin') ?? '') ? params.get('pin') : (me.pincode ?? '');
  const lines = summary.items
    .map(
      (i) =>
        `<div><span>${esc(withPack(i.product.name, i.variant.label))} × ${i.qty}</span><span>${formatPrice(i.variant.price * i.qty)}</span></div>`,
    )
    .join('');

  root.innerHTML = `<form class="cart-layout" id="checkout-form" novalidate>
    <div class="card">
      <h2 style="font-size:1.3rem">Delivery details</h2>
      <div class="error-box" id="form-error" role="alert" hidden></div>
      <div class="form-grid two">
        ${field({ id: 'name', label: 'Full name', value: me.name, attrs: 'autocomplete="name" required maxlength="100"' })}
        ${field({ id: 'phone', label: 'Mobile number', value: me.phone, hint: 'The rider calls this number.', attrs: 'type="tel" inputmode="numeric" autocomplete="tel-national" required' })}
      </div>
      ${field({ id: 'email', label: 'Email (optional)', value: me.email, hint: 'For your payment receipt.', attrs: 'type="email" autocomplete="email" maxlength="200"' })}
      ${field({ id: 'line1', label: 'Flat / house no., building and street', value: me.line1, attrs: 'autocomplete="address-line1" required maxlength="200"' })}
      <div class="form-grid two">
        ${field({ id: 'line2', label: 'Area / locality', value: me.line2, attrs: 'autocomplete="address-line2" maxlength="200"' })}
        ${field({ id: 'landmark', label: 'Landmark (optional)', value: me.landmark, attrs: 'maxlength="120"' })}
      </div>
      <div class="form-grid two">
        <div class="field">
          <label for="pincode">Pincode</label>
          <input id="pincode" name="pincode" value="${esc(pin)}" inputmode="numeric" maxlength="6" autocomplete="postal-code" required>
          <span id="pincode-msg" aria-live="polite"></span>
        </div>
        ${field({ id: 'city', label: 'City', value: 'Hyderabad', attrs: 'readonly' })}
      </div>
      <fieldset style="border:0;padding:0;margin:4px 0 14px">
        <legend style="font-weight:700;font-size:.9rem;margin-bottom:8px">Delivery day</legend>
        <div class="day-options">${days
          .map(
            (d) =>
              `<label class="day-option"><input type="radio" name="day" value="${d.date}" ${d.date === chosenDay ? 'checked' : ''}><span>${formatDeliveryDate(d.date)}</span></label>`,
          )
          .join('')}</div>
      </fieldset>
      <div class="field">
        <label for="note">Note for us (optional)</label>
        <textarea id="note" name="note" maxlength="500" placeholder="e.g. call before coming, gate code"></textarea>
      </div>
    </div>

    <aside class="card summary" aria-labelledby="summary-title">
      <h2 id="summary-title">Your order</h2>
      <div class="bill">
        ${lines}
        <div class="total"><span>To pay now</span><span>${formatPrice(summary.subtotal)}</span></div>
      </div>
      <p class="note">${
        summary.freeDelivery
          ? '🎉 Free delivery on this order.'
          : `Delivery: you pay the Rapido fare directly to the rider (free above ${formatPrice(Delivery.freeDeliveryMin)}).`
      }</p>
      <button class="btn btn-primary btn-lg btn-block" type="submit" id="pay">Pay ${formatPrice(summary.subtotal)} securely</button>
      <p class="note" style="text-align:center;margin:10px 0 0">UPI, cards, net banking and wallets, by Razorpay. By paying you agree to our <a href="/terms-and-conditions/">Terms</a> and <a href="/refund-policy/">Refund Policy</a>.</p>
    </aside>
  </form>`;

  updatePincodeMessage();
}

function updatePincodeMessage() {
  const input = document.getElementById('pincode');
  const message = document.getElementById('pincode-msg');
  if (!input || !message) return;
  const value = input.value;
  message.innerHTML =
    value.length < 6
      ? ''
      : isServiceablePincode(value)
        ? '<span class="hint" style="color:var(--green);font-weight:700">✓ We deliver here</span>'
        : `<span class="error">We don't deliver to ${esc(value)} yet. <a href="https://wa.me/${Business.whatsapp}">Ask us</a>.</span>`;
}

function showError(message, focusId) {
  const box = document.getElementById('form-error');
  box.innerHTML = message;
  box.hidden = false;
  (focusId ? document.getElementById(focusId) : box)?.focus();
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function submit(event) {
  event.preventDefault();
  const form = event.target;
  const value = (id) => form.elements[id]?.value.trim() ?? '';
  const details = {
    name: value('name'),
    phone: mobileOf(value('phone')),
    email: value('email'),
    line1: value('line1'),
    line2: value('line2'),
    landmark: value('landmark'),
    pincode: value('pincode'),
    note: value('note'),
  };

  if (details.name.length < 2) return showError('Please enter your full name.', 'name');
  if (!/^[6-9]\d{9}$/.test(details.phone)) return showError('Please enter a valid 10-digit mobile number.', 'phone');
  if (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(details.email)) {
    return showError('Please check your email address, or leave it empty.', 'email');
  }
  if (details.line1.length < 3) return showError('Please enter your flat or house number and street.', 'line1');
  if (!isServiceablePincode(details.pincode)) {
    return showError('Please enter a Hyderabad pincode we deliver to.', 'pincode');
  }

  const summary = resolveCart(products);
  const lines = summary.items
    .filter((i) => !i.soldOut)
    .map((i) => ({ productId: i.productId, variantId: i.variantId, qty: Math.min(i.qty, i.available) }));

  const button = document.getElementById('pay');
  button.disabled = true;
  button.textContent = 'Opening secure payment…';
  try {
    const checkout = await api.request('/checkouts/guest', {
      method: 'POST',
      body: {
        lines,
        address: {
          id: 'web',
          label: 'Home',
          name: details.name,
          phone: details.phone,
          line1: details.line1,
          line2: details.line2 || undefined,
          landmark: details.landmark || undefined,
          pincode: details.pincode,
          city: 'Hyderabad',
        },
        deliveryDate: chosenDay,
        note: details.note || undefined,
        email: details.email || undefined,
      },
      timeoutMs: 30000,
    });
    const { note: _note, ...contact } = details;
    remember(contact);
    // Pay on this site's own payment page (same order, same server).
    location.href = `/pay/${new URL(checkout.paymentUrl).search}`;
  } catch (error) {
    button.disabled = false;
    button.textContent = `Pay ${formatPrice(summary.subtotal)} securely`;
    if (error instanceof ApiError && error.status === 409 && error.data?.items) {
      clearCatalogCache();
      const items = error.data.items
        .map((i) => esc(i.available > 0 ? `${i.name} (only ${i.available} left)` : i.name))
        .join(', ');
      showError(`Some items just sold out: ${items}. <a href="/cart/">Update your cart</a> and try again.`);
    } else {
      showError(esc(error.message));
    }
  }
}

root.addEventListener('submit', submit);
root.addEventListener('input', (event) => {
  if (event.target.id === 'pincode') {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
    updatePincodeMessage();
  }
});
root.addEventListener('change', (event) => {
  if (event.target.name === 'day') chosenDay = event.target.value;
});

paymentsOpen().then((open) => {
  online = open;
  render();
});

loadCatalog((catalog) => {
  // Re-rendering would wipe what the customer is typing, so only the first catalog draws the form.
  if (products) return;
  products = catalog.products;
  render();
}).catch((error) => {
  notice("Couldn't load your cart", esc(error.message));
});
