# MasterCraft Leather Atelier

The static pages are in `site/`. The Cloudflare Worker in `cart-worker.js` serves the site and sends submitted orders using the Email Service binding. Product prices are validated and calculated by the Worker, not trusted from browser form data.

## Enable order email

1. Install the project dependencies with `npm install`.
2. Use a domain you control that is on Cloudflare DNS, and onboard it for Cloudflare Email Sending. The sender must be an address on that onboarded domain. Sending to the atelier's Gmail address requires a Workers Paid plan.
3. Start local development with `npm run dev`.
4. Deploy with `npm run deploy`.

The Worker sends orders to `joycekariuki461@gmail.com`. Set the sender address in the Cloudflare dashboard as the Worker variable `ORDER_FROM_EMAIL`, using an address on the onboarded domain (for example, `orders@your-domain.example`). The email binding is declared in `wrangler.jsonc`.

Until Email Sending is enabled and `ORDER_FROM_EMAIL` is set, checkout intentionally reports that online ordering is not configured; it does not claim that an email was sent. The customer can still contact the atelier at 0743260152 or joycekariuki461@gmail.com.

Displayed prices are sample estimates in KSh. Update the prices in both the product cards in `site/` and the authoritative `PRODUCTS` map in `cart-worker.js` before accepting real orders.
