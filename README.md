# Sree Vaaraahi Farms website

www.sreevaaraahifarms.in, in plain HTML, CSS and JavaScript, with no framework and no build step.

WordPress/WooCommerce stays as the back office. The owner manages products, prices, stock and orders there and in the WooCommerce phone app. The website reads the catalog live from the shop server, which also serves the mobile app. That server lives in the app project (`sree-vaaraahi-farms/server`).

## Layout

| Path | What it is |
| --- | --- |
| `site/` | **The website itself.** This folder is what gets published. |
| `site/index.html`, `shop/`, `product/`, `cart/` | Shop pages; their scripts are in `site/assets/js/pages/` |
| `site/how-it-works/`, `faqs/`, `our-team/`, `contact-us/`, `404.html` | Information pages, edited by hand |
| `site/terms-and-conditions/` … `delete-account/` | Policy pages, **generated** from `content/*.txt` |
| `site/knowledge-hub/` | Articles, imported once from the old WordPress site |
| `site/assets/css/site.css` | All styles; colours match the app |
| `site/assets/js/config.js` | Server address, WhatsApp number, delivery rules, checkout mode |
| `site/_redirects`, `sitemap.xml`, `robots.txt` | Generated; old WordPress links redirect to the new pages |
| `content/` | Approved policy texts (also the source for the WordPress paste-in file `ALL-PAGES.txt`) |
| `tools/` | Page builders and the shared head, header and footer (`tools/partials/`) |

## Preview locally

```
npm run preview
```

Then open http://localhost:5500. The preview turns browser caching off, so edits show on a normal reload. The site uses the staging shop server, which accepts requests from `http://localhost:5500`. That setting is `ALLOWED_ORIGINS` in the app project's `server/wrangler.toml`.

## Making changes

- **Header, footer or `<head>`:** edit `tools/partials/*.html`, then run `npm run sync`.
- **Policy text:** edit `content/*.txt`, then run `npm run policies`.
- **New page:** copy an information page and keep its `<!-- partial:… -->` markers. Then run `npm run sync` and `npm run site-files` to update the sitemap.
- **Products and prices:** change them in WooCommerce. The site picks them up within a few minutes.

## Ordering

The cart asks the shop server whether it takes online payments (`/health`):

- **Yes** (`PAYMENTS_MODE = "razorpay"`): **Checkout** opens `/checkout/`, a guest checkout (name, mobile, optional email, address, delivery day). The order is created on the server and paid on `/pay/` with Razorpay Checkout. WhatsApp ordering stays available as a link.
- **No** (catalog-only or unreachable): the cart becomes a pre-filled WhatsApp message to +91 76718 25610.

So the live site switches to online payment by itself once the live server is moved to Razorpay. Local previews and the `pages.dev` address use the test server (Razorpay test keys, no real money); only `www.sreevaaraahifarms.in` uses the live server.

The app pays through the same `/pay/` page, opened in a browser tab.

## Deploy (Cloudflare Pages, from GitHub)

Every push to `main` publishes the site. One-time setup in the Cloudflare dashboard:
**Workers & Pages → Create → Pages → Connect to Git → `sree-vaaraahi-farms-website`**

| Setting | Value |
| --- | --- |
| Project name | `sree-vaaraahi-farms` (address `sree-vaaraahi-farms.pages.dev`) |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `site` |

Each address the site runs on must be listed in `API_BY_HOST` (`site/assets/js/config.js`) and in `ALLOWED_ORIGINS` on that server (the app project's `server/wrangler.toml`). Otherwise the browser blocks the product list.

## Go-live checklist

The domain's DNS is at **BigRock**. WordPress and email run on the hosting server (108.167.146.99). Do the steps in this order, so the shop never goes offline.

**1. Put the new site online (nothing changes for customers yet)**
1. Deploy the live shop server from the app project: `cd server && npx wrangler deploy`. It runs `PAYMENTS_MODE = "off"` (catalog only) until Razorpay is live.
2. Connect this repo to Cloudflare Pages (above), then check `https://sree-vaaraahi-farms.pages.dev`.

**2. Move WordPress to a back-office address**
1. BigRock DNS: add an **A** record `admin` → `108.167.146.99`.
2. Hosting control panel: add `admin.sreevaaraahifarms.in` pointing to the same folder as the current site, with SSL.
3. Take a full backup of the WordPress site.
4. WordPress → **Settings → General**: set both addresses to `https://admin.sreevaaraahifarms.in`.
5. WordPress → **Settings → Reading**: tick "Discourage search engines". WooCommerce → **Settings → Payments**: turn off Cash on Delivery, so nobody orders on the old storefront.
6. Change `WC_URL` to `https://admin.sreevaaraahifarms.in` on both servers and redeploy. Reconnect the WooCommerce phone app with the new address.

**3. Switch the domain**
1. Cloudflare Pages → **Custom domains** → add `www.sreevaaraahifarms.in`.
2. BigRock DNS: change `www` to a **CNAME** → `sree-vaaraahi-farms.pages.dev`. Leave the `mail`, MX and TXT records alone: email runs on the hosting server.
3. Hosting control panel → **Redirects**: `sreevaaraahifarms.in` → `https://www.sreevaaraahifarms.in` (permanent). The bare domain stays on the hosting server while DNS is at BigRock.
4. Once the certificate is active, check the home page, shop, cart, policies, and old links (`/refund_returns/`, `/wild-honey/`).

**4. After launch**
1. Google Search Console: add the domain and submit `https://www.sreevaaraahifarms.in/sitemap.xml`.
2. Play Console: privacy policy `…/privacy-policy/`, account deletion `…/delete-account/`.
3. Finish Razorpay activation. Then switch the live server to `PAYMENTS_MODE = "razorpay"` with the live keys (see the app project's `docs/GO_LIVE.md`).
