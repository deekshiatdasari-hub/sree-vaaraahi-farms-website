/**
 * Website settings. Business rules match the app (src/constants/config.ts) and the server.
 */

/** The live shop server (catalog only until Razorpay is live). */
const PRODUCTION_API = 'https://sree-vaaraahi-farms-api.sree-vaaraahi-farms-server.workers.dev';
/** The test server: used by local previews (localhost) and any other address. */
export const STAGING_API = 'https://sree-vaaraahi-farms-api-staging.sree-vaaraahi-farms-server.workers.dev';

/** Which server each address uses. Each of these must be in ALLOWED_ORIGINS on that server. */
const API_BY_HOST = {
  'www.sreevaaraahifarms.in': PRODUCTION_API,
  'sreevaaraahifarms.in': PRODUCTION_API,
  'sree-vaaraahi-farms.pages.dev': PRODUCTION_API,
  'sree-vaaraahi-farms-website.pages.dev': PRODUCTION_API,
};

export const API_URL = API_BY_HOST[location.hostname] ?? STAGING_API;

/**
 * How the cart is finished:
 * - 'whatsapp': the cart becomes a WhatsApp message to the shop (until online payment is live).
 * - 'online':   login, address and Razorpay payment on /checkout/.
 */
export const CHECKOUT_MODE = 'whatsapp';

export const Business = {
  name: 'Sree Vaaraahi Farms',
  /** Runs the store and receives payments (her Razorpay account). Also the Grievance Officer. */
  seller: 'Bhavani',
  /** Owns the brand and publishes the app on Google Play. */
  brandOwner: 'Sree Vaaraahi Farms LLP (LLPIN ACJ-9064)',
  phone: '+917671825610',
  phoneDisplay: '+91 76718 25610',
  whatsapp: '917671825610',
  email: 'hello@sreevaaraahifarms.in',
};

export const Delivery = {
  /** Days of the week we deliver on (0 = Sunday … 6 = Saturday). */
  weekdays: [3, 6],
  /** Only delivery days within this many days after today are offered. */
  windowDays: 6,
  /** Orders at or above this subtotal (₹) get free delivery. */
  freeDeliveryMin: 1000,
  /** "Only 3 left" at or below this stock. */
  lowStockThreshold: 5,
};
