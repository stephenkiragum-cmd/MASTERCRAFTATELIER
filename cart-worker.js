const OWNER_EMAIL = "joycekariuki461@gmail.com";
const CURRENCY = "KSh";
const PRODUCTS = {
  "bag-market-tote": { name: "Market Tote", category: "Bags", price: 8500 },
  "bag-compact-crossbody": { name: "Compact Crossbody", category: "Bags", price: 7200 },
  "bag-workshop-satchel": { name: "Workshop Satchel", category: "Bags", price: 9800 },
  "bag-weekend-holdall": { name: "Weekend Holdall", category: "Bags", price: 14500 },
  "jacket-rider": { name: "Rider Jacket", category: "Jackets", price: 24000 },
  "jacket-city-moto": { name: "City Moto", category: "Jackets", price: 22500 },
  "jacket-clean-cut": { name: "Clean Cut", category: "Jackets", price: 21000 },
  "jacket-heritage-zip": { name: "Heritage Zip", category: "Jackets", price: 26000 },
  "wallet-classic-bifold": { name: "Classic Bifold", category: "Wallets", price: 3800 },
  "wallet-card-sleeve": { name: "Card Sleeve", category: "Wallets", price: 2400 },
  "wallet-zip-around": { name: "Zip Around", category: "Wallets", price: 4500 },
  "wallet-minimal-fold": { name: "Minimal Fold", category: "Wallets", price: 3200 },
  "belt-hand-stitched-classic": { name: "Hand-stitched Classic", category: "Belts", price: 3200 },
  "belt-artisan-braid": { name: "Artisan Braid", category: "Belts", price: 4100 },
  "belt-heritage-ornament": { name: "Heritage Ornament", category: "Belts", price: 4800 },
  "belt-wide-statement": { name: "Wide Statement", category: "Belts", price: 5200 },
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }
  return normalized;
}

function buildOrder(data) {
  const name = requiredText(data.name, "Name", 100);
  const phone = requiredText(data.phone, "Phone number", 30);
  const location = requiredText(data.location, "Location", 160);
  if (!/^[+\d][\d\s().-]{6,29}$/.test(phone)) throw new Error("Enter a valid phone number.");
  if (typeof data.website !== "string" || data.website.trim()) throw new Error("The order could not be verified.");
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 16) {
    throw new Error("Your cart has an invalid number of items.");
  }

  const seen = new Set();
  const items = data.items.map((item) => {
    if (!item || typeof item.id !== "string" || !Object.hasOwn(PRODUCTS, item.id)) {
      throw new Error("Your cart contains an item we could not verify. Refresh the page and try again.");
    }
    if (seen.has(item.id)) throw new Error("Your cart contains a duplicate item. Refresh the page and try again.");
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error("An item has an invalid quantity.");
    }
    seen.add(item.id);
    const product = PRODUCTS[item.id];
    return { ...product, quantity: item.quantity };
  });

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (!Number.isSafeInteger(total)) throw new Error("The order total is invalid.");
  return { name, phone, location, items, total };
}

function emailText(order) {
  const itemLines = order.items.map(
    (item) => `- ${item.name} (${item.category}) x ${item.quantity}: ${CURRENCY} ${(item.price * item.quantity).toLocaleString("en-KE")}`
  );
  return [
    "New order for MasterCraft Leather Atelier",
    "",
    "Customer details:",
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    `Location: ${order.location}`,
    "",
    "Items:",
    ...itemLines,
    "",
    `Order total: ${CURRENCY} ${order.total.toLocaleString("en-KE")}`,
    "",
    "Please contact the customer to confirm availability, delivery, and payment.",
  ].join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/order") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return jsonResponse({ error: "Use POST to submit an order." }, 405);
    if (request.headers.get("Origin") !== url.origin) return jsonResponse({ error: "Request origin not allowed." }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return jsonResponse({ error: "Order must be submitted as JSON." }, 415);
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_384) return jsonResponse({ error: "Order is too large." }, 413);
    if (!env.EMAIL || !env.ORDER_FROM_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ORDER_FROM_EMAIL)) {
      console.error("Order email is not configured: EMAIL binding or ORDER_FROM_EMAIL is missing/invalid.");
      return jsonResponse({ error: "Online ordering is not configured yet. Please contact the atelier by phone or email." }, 503);
    }

    let order;
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > 16_384) return jsonResponse({ error: "Order is too large." }, 413);
      const data = JSON.parse(body);
      order = buildOrder(data);
    } catch (error) {
      if (error instanceof SyntaxError) return jsonResponse({ error: "The order details could not be read." }, 400);
      if (error instanceof Error) return jsonResponse({ error: error.message }, 400);
      console.error("Unexpected order validation failure.", error);
      return jsonResponse({ error: "The order details could not be validated." }, 400);
    }

    try {
      await env.EMAIL.send({
        to: OWNER_EMAIL,
        from: { email: env.ORDER_FROM_EMAIL, name: "MasterCraft Leather Atelier" },
        replyTo: OWNER_EMAIL,
        subject: `Website order from ${order.name}`,
        text: emailText(order),
      });
      return jsonResponse({ ok: true });
    } catch (error) {
      console.error("Order email delivery failed.", error);
      return jsonResponse({ error: "We could not send your order email. Please try again or contact the atelier directly." }, 502);
    }
  },
};

export { buildOrder, emailText, PRODUCTS };
