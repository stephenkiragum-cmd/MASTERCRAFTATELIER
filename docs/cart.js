const CART_KEY = "mastercraft-leather-cart";
const CURRENCY = "KSh";

function formatPrice(amount) {
  return `${CURRENCY} ${Number(amount).toLocaleString("en-KE")}`;
}

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(saved)) throw new TypeError("Saved cart must be a list.");
    return saved.filter((item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Number.isSafeInteger(item.price) &&
      item.price > 0 &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity > 0
    );
  } catch (error) {
    console.error("Could not read the saved cart.", error);
    return [];
  }
}

let cart = readCart();

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    return true;
  } catch (error) {
    console.error("Could not save the cart.", error);
    const status = document.getElementById("cart-status");
    if (status) status.textContent = "Your browser could not save the cart. Please enable local storage and try again.";
    return false;
  }
}

function updateCartCount() {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = String(count);
  });
}

function addToCart(product) {
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  if (saveCart()) {
    updateCartCount();
    const status = document.getElementById("cart-status");
    if (status) status.textContent = `${product.name} added to your cart.`;
  }
}

document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
  button.addEventListener("click", () => {
    const product = {
      id: button.dataset.productId,
      name: button.dataset.productName,
      price: Number(button.dataset.productPrice),
      category: button.dataset.productCategory,
    };
    if (!product.id || !product.name || !product.category || !Number.isSafeInteger(product.price) || product.price <= 0) {
      console.error("The product has invalid cart details.", product);
      const status = document.getElementById("cart-status");
      if (status) status.textContent = "This item cannot be added right now. Please contact the atelier.";
      return;
    }
    addToCart(product);
  });
});

function renderCart() {
  const container = document.getElementById("cart-items");
  if (!container) return;

  container.replaceChildren();
  const empty = document.getElementById("cart-empty");
  const summary = document.getElementById("cart-summary");
  const totalElement = document.getElementById("cart-total");
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  empty.hidden = cart.length > 0;
  summary.hidden = cart.length === 0;
  totalElement.textContent = formatPrice(total);

  cart.forEach((item) => {
    const row = document.createElement("article");
    row.className = "cart-item";

    const details = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = item.name;
    const category = document.createElement("p");
    category.textContent = item.category;
    const price = document.createElement("p");
    price.textContent = `${formatPrice(item.price)} each`;
    details.append(title, category, price);

    const controls = document.createElement("div");
    controls.className = "cart-controls";
    const quantity = document.createElement("label");
    quantity.textContent = "Qty";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "99";
    input.step = "1";
    input.value = String(item.quantity);
    input.setAttribute("aria-label", `Quantity of ${item.name}`);
    quantity.append(input);
    input.addEventListener("change", () => {
      const nextQuantity = Number(input.value);
      if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 1 || nextQuantity > 99) {
        input.value = String(item.quantity);
        return;
      }
      item.quantity = nextQuantity;
      if (saveCart()) {
        updateCartCount();
        renderCart();
      }
    });

    const subtotal = document.createElement("strong");
    subtotal.textContent = formatPrice(item.price * item.quantity);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      cart = cart.filter((entry) => entry.id !== item.id);
      if (saveCart()) {
        updateCartCount();
        renderCart();
      }
    });
    controls.append(quantity, subtotal, remove);
    row.append(details, controls);
    container.append(row);
  });
}

function prepareOrderEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || cart.length === 0) return;

  const customer = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.getElementById("cart-status");
  submitButton.disabled = true;
  submitButton.textContent = "Sending order...";
  status.textContent = "Sending your order to the atelier...";

  fetch("/api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: customer.get("name"),
      phone: customer.get("phone"),
      location: customer.get("location"),
      website: customer.get("website"),
      items: cart.map(({ id, quantity }) => ({ id, quantity })),
    }),
  })
    .then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "The order could not be sent. Please try again.");
      }
      return result;
    })
    .then(() => {
      cart = [];
      if (!saveCart()) {
        status.textContent = "The order was sent, but this browser could not clear the saved cart.";
        return;
      }
      updateCartCount();
      renderCart();
      status.textContent = "Order sent successfully. The atelier will contact you to confirm the details.";
    })
    .catch((error) => {
      console.error("Order submission failed.", error);
      status.textContent = error.message || "Could not send your order. Check your connection and try again.";
    })
    .finally(() => {
      submitButton.disabled = false;
      submitButton.textContent = "Send order";
    });
}

const orderForm = document.getElementById("order-form");
if (orderForm) orderForm.addEventListener("submit", prepareOrderEmail);

updateCartCount();
renderCart();
