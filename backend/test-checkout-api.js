(async () => {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1111' })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      console.log("Login failed:", loginData);
      return;
    }
    const token = loginData.token;
    console.log("Logged in");

    const sessionRes = await fetch('http://localhost:5000/api/v1/auth/session/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device_info: 'test' })
    });
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.session?.id;

    // Get products
    const prodRes = await fetch('http://localhost:5000/api/v1/catalog/products', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const prodData = await prodRes.json();
    const product = prodData.products[0];
    console.log("Adding product:", product.name);

    await fetch('http://localhost:5000/api/v1/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ product_id: product.id, quantity: 1 })
    });

    const checkoutRes = await fetch('http://localhost:5000/api/v1/cart/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        order_type: 'DINE_IN',
        customer_id: null,
        branch_id: 'DEFAULT_BRANCH',
        business_date: '2026-08-11',
        service_charge: 50
      })
    });
    const checkoutData = await checkoutRes.json();
    console.log("Checkout:", checkoutRes.status, checkoutData);
  } catch (e) {
    console.log("Error:", e.message);
  }
})();
