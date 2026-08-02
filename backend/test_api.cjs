async function testApi() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }) 
    });
    
    if (!loginRes.ok) {
      console.log('Login failed', loginRes.status, await loginRes.text());
      return;
    }
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    const userId = loginData.data.user.id;
    const cashierSessionId = loginData.data.cashierSessionId || 'dev-session-id';
    console.log('Login success! userId:', userId, 'token:', token.substring(0, 20) + '...');

    // 2. Fetch products
    const productsRes = await fetch('http://localhost:5000/api/v1/catalog/products/search', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const productsData = await productsRes.json();
    const product = productsData.data[0];
    console.log('Got product:', product.name, product.id);

    // 3. Add to cart
    const cartRes = await fetch('http://localhost:5000/api/v1/cart/items', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-cashier-session-id': cashierSessionId
      },
      body: JSON.stringify({
        product_id: product.id,
        quantity: 1,
        modifiers: []
      })
    });
    console.log('Cart Status:', cartRes.status);
    console.log('Cart Response:', await cartRes.text());

  } catch (err) {
    console.error(err);
  }
}
testApi();
