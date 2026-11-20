# Sree Vaaraahi Farms website

www.sreevaaraahifarms.in, in plain HTML, CSS and JavaScript, with no framework and no build step.

WordPress/WooCommerce stays as the back office. The owner manages products, prices, stock and orders there and in the WooCommerce phone app. The website reads the catalog live from the shop server, which also serves the mobile app. That server lives in the app project (`sree-vaaraahi-farms/server`).

## Layout

| Path | What it is |
| --- | --- |
| `site/` | **The website itself.** This folder is what gets published. |
| `cpanel/` | Output of `npm run cpanel`: the upload zip and the `.htaccess` block |
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

So the live site switches to online payment by itself once the live server is moved to Razorpay. Local previews use the test server (Razorpay test keys, no real money); `www.sreevaaraahifarms.in` uses the live server.

The app pays through the same `/pay/` page, opened in a browser tab. With `?env=staging` (added by the test server), the page talks to the test server.

## Publish on cPanel

The site is hosted in the same folder as WordPress: in cPanel File Manager that is **`sreevaaraahifarms.in`** (the domain's own folder, not `public_html`, which belongs to the account's main domain). WordPress keeps running `/wp-admin`, the shop API (`/wp-json`) and the product photos (`/wp-content`), so the WooCommerce app and the shop server keep working unchanged. A block at the top of `.htaccess` does three things: it makes visitors see this website, redirects old WordPress addresses, and shows our 404 page for anything else. No DNS change is needed, so email is untouched.

**Build the package:** run `npm run cpanel`. It writes `cpanel/website-upload.zip` (the site) and `cpanel/htaccess-rules.txt` (the block to paste).

**First time:**
1. In File Manager, open the `sreevaaraahifarms.in` folder and download `.htaccess` as a backup. A full copy (select the folder → **Compress**) is even better.
2. In that same folder, **Upload** `website-upload.zip`. Then select it → **Extract** into that folder, and delete the zip.
3. In File Manager, open **Settings** and tick **Show Hidden Files**. Right-click `.htaccess` in that folder → **Edit**. Paste all of `htaccess-rules.txt` at the **very top**, above `# BEGIN WordPress`, and save.
4. Open `https://www.sreevaaraahifarms.in` and do a hard reload (Ctrl+Shift+R). Check the home page, the shop, a product, the cart, a policy page, and an old link such as `/refund_returns/`. Check that `/wp-admin/` still opens WordPress.

**To undo:** delete the block from `.htaccess` (and `index.html`), and the old WordPress site is back.

**Updates later:** run `npm run cpanel`, then upload and extract the new zip over the old files. Replace the `.htaccess` block only if `htaccess-rules.txt` changed.

Each address the site runs on must be in `API_BY_HOST` (`site/assets/js/config.js`) and in `ALLOWED_ORIGINS` on that server (the app project's `server/wrangler.toml`), or the browser blocks the product list.

## After publishing

1. Google Search Console: add the domain and submit `https://www.sreevaaraahifarms.in/sitemap.xml`.
2. Play Console: privacy policy `https://www.sreevaaraahifarms.in/privacy-policy/`, account deletion `https://www.sreevaaraahifarms.in/delete-account/`.
3. Razorpay activation: give `https://www.sreevaaraahifarms.in` as the website. Once approved, switch the live server to `PAYMENTS_MODE = "razorpay"` with the live keys (see the app project's `docs/GO_LIVE.md`). The website then offers online checkout by itself.
