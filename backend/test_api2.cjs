async function testApi() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }) 
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    const userId = loginData.data.user.id;
    const cashierSessionId = loginData.data.cashierSessionId;

    const productsRes = await fetch('http://localhost:5000/api/v1/catalog/products/search', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const productsData = await productsRes.json();
    // Find a product with variants
    const productWithVariants = productsData.data.find(p => p.variants && p.variants.length > 0);
    
    if (!productWithVariants) {
      console.log('No variants found');
      return;
    }
    console.log('Got product with variants:', productWithVariants.name, productWithVariants.id);
    const variantId = productWithVariants.variants[0].id;
    console.log('Using variant:', variantId);

    const cartRes = await fetch('http://localhost:5000/api/v1/cart/items', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-cashier-session-id': cashierSessionId || 'dev-session-id'
      },
      body: JSON.stringify({
        product_id: productWithVariants.id,
        variant_id: variantId,
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
