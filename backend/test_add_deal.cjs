const fetch = require('node-fetch');

async function run() {
  // get session ID
  const login = await fetch('http://localhost:5000/api/v1/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password' })
  });
  const loginData = await login.json();
  const token = loginData.data.token;

  // get a deal id
  const deals = await fetch('http://localhost:5000/api/v1/catalog/deals', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const dealsData = await deals.json();
  const dealId = dealsData.data[0].id;

  console.log('Deal ID:', dealId);

  // add to cart
  const add = await fetch('http://localhost:5000/api/v1/orders/draft/items', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product_id: dealId,
      quantity: 1
    })
  });
  const addData = await add.json();
  console.log('Add response:', addData);
}

run();
