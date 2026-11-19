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

Then open http://localhost:5500. The site uses the staging shop server, which accepts requests from `http://localhost:5500`. That setting is `ALLOWED_ORIGINS` in the app project's `server/wrangler.toml`.

## Making changes

- **Header, footer or `<head>`:** edit `tools/partials/*.html`, then run `npm run sync`.
- **Policy text:** edit `content/*.txt`, then run `npm run policies`.
- **New page:** copy an information page and keep its `<!-- partial:… -->` markers. Then run `npm run sync` and `npm run site-files` to update the sitemap.
- **Products and prices:** change them in WooCommerce. The site picks them up within a few minutes.

## Ordering today

`CHECKOUT_MODE = 'whatsapp'` in `site/assets/js/config.js`. The cart becomes a pre-filled WhatsApp message to +91 76718 25610 with the delivery day and pincode. Once Cashfree is approved, the plan is a `/checkout/` page with Firebase login and Cashfree payment, then switching to `'online'` (and removing the `/checkout/*` redirect).

## Deploy (Cloudflare Pages)

```
npm run deploy
```

The first deploy creates the project and a `*.pages.dev` address. Add that address to `ALLOWED_ORIGINS` on the shop server before testing there.

## Go-live checklist

1. Move WordPress to a back-office address, for example `admin.sreevaaraahifarms.in`: create the subdomain at GoDaddy and update **Settings → General** (WordPress and Site Address). Then reconnect the WooCommerce phone app and change `WC_URL` on the shop server.
2. Deploy the production shop server with Cashfree (in the app project: `cd server && npx wrangler deploy`), with `ALLOWED_ORIGINS` set to the live website address. Then point `API_BY_HOST` in `site/assets/js/config.js` at it.
3. In Cloudflare Pages → Custom domains, add `www.sreevaaraahifarms.in` and `sreevaaraahifarms.in`, and update DNS as Cloudflare instructs.
4. Check the old addresses redirect, for example `/refund_returns/` and `/wild-honey/`.
5. Submit `https://www.sreevaaraahifarms.in/sitemap.xml` in Google Search Console.
