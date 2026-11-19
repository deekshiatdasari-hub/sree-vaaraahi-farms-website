import { loadCatalog, paymentsOpen } from '../api.js';
import { cart, resolveCart } from '../cart.js';
import { Business, Delivery } from '../config.js';
import {
  esc,
  formatDeliveryDate,
  formatPrice,
  getDeliveryOptions,
  isServiceablePincode,
  isValidPincode,
  withPack,
} from '../lib.js';
import { buyControl, productImage, productUrl } from '../ui.js';

const root = document.getElementById('cart-root');
const days = getDeliveryOptions();
let products = null;
let chosenDay = days[0]?.date ?? '';
let pincode = '';
/** null while asking the server; then true (online checkout) or false (WhatsApp). */
let online = null;

const checkoutHref = () =>
  `/checkout/?day=${encodeURIComponent(chosenDay)}${pincode.length === 6 ? `&pin=${pincode}` : ''}`;

function pincodeMessage() {
  if (!pincode) return '';
  if (!isValidPincode(pincode)) return '<span class="error">Please enter a 6-digit pincode.</span>';
  return isServiceablePincode(pincode)
    ? '<span class="hint" style="color:var(--green);font-weight:700">✓ We deliver to this pincode.</span>'
    : `<span class="error">We don't deliver to ${esc(pincode)} yet. <a href="https://wa.me/${Business.whatsapp}">Ask us on WhatsApp</a>.</span>`;
}

function whatsappLink(summary) {
  const lines = summary.items
    .filter((i) => !i.soldOut)
    .map((i, n) => {
      const qty = Math.min(i.qty, i.available);
      return `${n + 1}. ${withPack(i.product.name, i.variant.label)} × ${qty} = ${formatPrice(i.variant.price * qty)}`;
    });
  const text = [
    `Hello ${Business.name}! I'd like to order for ${chosenDay ? formatDeliveryDate(chosenDay, true) : 'the next delivery day'}:`,
    '',
    ...lines,
    '',
    `Items total: ${formatPrice(summary.subtotal)}`,
    `Delivery: ${summary.freeDelivery ? 'Free' : "Rapido fare, I'll pay the rider"}`,
    ...(pincode && isValidPincode(pincode) ? [`Pincode: ${pincode}`] : []),
    '',
    'My name and delivery address:',
  ].join('\n');
  return `https://wa.me/${Business.whatsapp}?text=${encodeURIComponent(text)}`;
}

function lineHtml(item) {
  const { product, variant } = item;
  const warn = item.soldOut
    ? '<div class="warn">Sold out. Please remove it.</div>'
    : item.overStock
      ? `<div class="warn">Only ${item.available} left</div>`
      : '';
  return `<div class="cart-line">
    <a class="thumb" href="${productUrl(product)}" tabindex="-1" aria-hidden="true">${productImage(product)}</a>
    <div>
      <a class="name" href="${productUrl(product)}">${esc(product.name)}</a>
      <div class="meta">${esc(variant.label || '')}${variant.label ? ' · ' : ''}${formatPrice(variant.price)} each</div>
      ${warn}
    </div>
    <div class="side">
      <strong>${formatPrice(item.lineTotal)}</strong>
      ${item.soldOut ? `<button class="add-btn" type="button" data-remove="${esc(product.id)}|${esc(variant.id)}">Remove</button>` : buyControl(product, variant)}
    </div>
  </div>`;
}

function render() {
  const summary = resolveCart(products);
  if (summary.items.length === 0) {
    document.getElementById('cart-sub').textContent = 'Your cart is empty.';
    root.innerHTML = `<div class="empty" style="padding:64px 16px">
      <div class="big" aria-hidden="true">🧺</div>
      <h2>Your cart is empty</h2>
      <p>Fresh fruits, vegetables, oils and groceries are waiting for you.</p>
      <a class="btn btn-primary btn-lg" href="/shop/">Start shopping</a>
    </div>`;
    return;
  }

  const count = summary.items.reduce((n, i) => n + i.qty, 0);
  document.getElementById('cart-sub').textContent = `${count} item${count === 1 ? '' : 's'} in your cart`;
  const progress = Math.min(100, Math.round((summary.subtotal / Delivery.freeDeliveryMin) * 100));
  const delivery = summary.freeDelivery
    ? '<span style="color:var(--green);font-weight:700">Free</span>'
    : '<span>Rapido fare, paid to the rider</span>';
  const blocked = summary.hasProblems || summary.subtotal === 0;

  const off = blocked ? 'aria-disabled="true" tabindex="-1" style="pointer-events:none;opacity:.5"' : '';
  const whatsappHref = blocked ? '#' : esc(whatsappLink(summary));
  const action =
    online === null
      ? '<div class="skeleton" style="height:52px;border-radius:999px" aria-hidden="true"></div>'
      : online
        ? `<a class="btn btn-primary btn-lg btn-block" id="checkout" href="${blocked ? '#' : esc(checkoutHref())}" ${off}>Checkout · ${formatPrice(summary.subtotal)}</a>
          <p class="note" style="margin:10px 0 0;text-align:center">Pay securely by UPI, card or net banking. <a id="send" href="${whatsappHref}" target="_blank" rel="noopener">Or order on WhatsApp</a></p>`
        : `<a class="btn btn-whatsapp btn-lg btn-block" id="send" href="${whatsappHref}" target="_blank" rel="noopener" ${off}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>
          Send order on WhatsApp</a>
        <p class="note" style="margin:10px 0 0">WhatsApp opens with your order filled in. Add your name and address, then send. We'll confirm your order and share payment details.</p>`;

  root.innerHTML = `<div class="cart-layout">
    <div>
      <div class="card cart-lines">${summary.items.map(lineHtml).join('')}</div>
      <p style="margin-top:14px"><a href="/shop/">← Continue shopping</a></p>
    </div>
    <aside class="card summary" aria-labelledby="summary-title">
      <h2 id="summary-title">Order summary</h2>
      <div class="free-delivery">
        ${summary.freeDelivery ? '🎉 Your order gets free delivery!' : `Add <strong>${formatPrice(summary.toFreeDelivery)}</strong> more for free delivery`}
        <div class="progress" role="progressbar" aria-label="Progress to free delivery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>
      </div>
      <div class="bill">
        <div><span>Items total</span><span>${formatPrice(summary.subtotal)}</span></div>
        <div><span>Delivery</span>${delivery}</div>
        <div class="total"><span>To pay</span><span>${formatPrice(summary.subtotal)}</span></div>
      </div>
      ${summary.freeDelivery ? '' : `<p class="note">Below ${formatPrice(Delivery.freeDeliveryMin)}, you pay the Rapido delivery fare directly to the rider when your order arrives.</p>`}
      <fieldset style="border:0;padding:0;margin:18px 0 0">
        <legend style="font-weight:700;font-size:.9rem;margin-bottom:8px">Delivery day</legend>
        <div class="day-options">${days
          .map(
            (d) =>
              `<label class="day-option"><input type="radio" name="day" value="${d.date}" ${d.date === chosenDay ? 'checked' : ''}><span>${formatDeliveryDate(d.date)}</span></label>`,
          )
          .join('')}</div>
      </fieldset>
      <div class="field" style="margin-top:16px">
        <label for="pincode">Delivery pincode</label>
        <input id="pincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="e.g. 500081" value="${esc(pincode)}">
        <div id="pincode-msg" aria-live="polite">${pincodeMessage()}</div>
      </div>
      ${summary.hasProblems ? '<p class="warn" style="color:var(--danger);font-weight:700">Some items are sold out or low on stock. Please update them to continue.</p>' : ''}
      ${action}
    </aside>
  </div>`;
}

root.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    const [productId, variantId] = remove.dataset.remove.split('|');
    cart.set(productId, variantId, 0);
  }
});

root.addEventListener('change', (event) => {
  if (event.target.name === 'day') {
    chosenDay = event.target.value;
    render();
    root.querySelector(`input[name="day"][value="${chosenDay}"]`)?.focus();
  }
});

root.addEventListener('input', (event) => {
  if (event.target.id !== 'pincode') return;
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
  pincode = event.target.value;
  document.getElementById('pincode-msg').innerHTML = pincode.length === 6 ? pincodeMessage() : '';
  const send = document.getElementById('send');
  const checkout = document.getElementById('checkout');
  const summary = resolveCart(products);
  if (send && !summary.hasProblems) send.href = whatsappLink(summary);
  if (checkout && !summary.hasProblems) checkout.href = checkoutHref();
});

// Quantities change through the shared − / + buttons; redraw totals afterwards.
document.addEventListener('cart:change', () => {
  if (!products) return;
  const focusedId = document.activeElement?.closest('.buy-control')?.dataset.p;
  const which = document.activeElement?.matches('[data-dec]') ? 'dec' : 'inc';
  render();
  if (focusedId) {
    const control = root.querySelector(`.buy-control[data-p="${CSS.escape(focusedId)}"]`);
    (control?.querySelector(`[data-${which}]:not([disabled])`) ?? control?.querySelector('button'))?.focus();
  }
});

paymentsOpen().then((open) => {
  online = open;
  if (products) render();
});

loadCatalog((catalog) => {
  products = catalog.products;
  render();
}).catch((error) => {
  root.innerHTML = `<div class="empty"><h2>Couldn't load your cart</h2><p>${esc(error.message)}</p><button class="btn btn-outline" type="button" id="retry">Try again</button></div>`;
  document.getElementById('retry').addEventListener('click', () => location.reload());
});
