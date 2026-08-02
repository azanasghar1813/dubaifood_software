async function testCart() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.error('Login Failed:', loginData);
      return;
    }
    
    const token = loginData.data.token;
    const userId = loginData.data.user.id;
    const sessionId = loginData.data.cashierSessionId || 'sess-test-123';
    
    console.log('Logged in. Token:', token.substring(0,10) + '...');
    
    // 2. Fetch products to get a valid product ID
    const prodRes = await fetch('http://localhost:5000/api/v1/catalog/products/search', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const prodData = await prodRes.json();
    const products = prodData.data;
    
    if (!products || products.length === 0) {
      console.log('No products found in DB.');
      return;
    }
    
    const product = products[0];
    console.log(`Adding product ${product.id} to cart...`);
    
    // 3. Add to cart
    const cartRes = await fetch('http://localhost:5000/api/v1/cart/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-user-id': userId,
        'x-cashier-session-id': sessionId
      },
      body: JSON.stringify({
        product_id: product.id,
        quantity: 1,
        modifiers: []
      })
    });
    
    const cartData = await cartRes.json();
    console.log('Cart Response:', cartData);
    
  } catch (err) {
    console.error(err);
  }
}

testCart();
