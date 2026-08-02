async function testCart() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    const userId = loginData.data.user.id;
    const sessionId = loginData.data.cashierSessionId || 'sess-test-123';
    
    // Get all products
    const prodRes = await fetch('http://localhost:5000/api/v1/catalog/products/search', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const prodData = await prodRes.json();
    const products = prodData.data;
    
    // Find one with variants and one without
    const withVariants = products.find(p => p.variants && p.variants.length > 0);
    const withoutVariants = products.find(p => !p.variants || p.variants.length === 0);
    
    if (withoutVariants) {
      console.log(`Adding ${withoutVariants.name} (No Variants)...`);
      const res = await fetch('http://localhost:5000/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-user-id': userId, 'x-cashier-session-id': sessionId },
        body: JSON.stringify({ product_id: withoutVariants.id, quantity: 1 })
      });
      console.log('Without Variants Result:', await res.json());
    }
    
    if (withVariants) {
      console.log(`Adding ${withVariants.name} (WITH Variants) but missing variant_id...`);
      const res1 = await fetch('http://localhost:5000/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-user-id': userId, 'x-cashier-session-id': sessionId },
        body: JSON.stringify({ product_id: withVariants.id, quantity: 1 })
      });
      console.log('Missing variant_id Result:', await res1.json());
      
      console.log(`Adding ${withVariants.name} (WITH Variants) WITH variant_id...`);
      const res2 = await fetch('http://localhost:5000/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-user-id': userId, 'x-cashier-session-id': sessionId },
        body: JSON.stringify({ product_id: withVariants.id, variant_id: withVariants.variants[0].id, quantity: 1 })
      });
      console.log('With variant_id Result:', await res2.json());
    }
    
  } catch (err) {
    console.error(err);
  }
}
testCart();
