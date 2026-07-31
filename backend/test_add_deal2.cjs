async function run() {
  const login = await fetch('http://localhost:5000/api/v1/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password', pinCode: '1234' })
  });
  const loginData = await login.json();
  const token = loginData.data?.token || loginData.token;

  const deals = await fetch('http://localhost:5000/api/v1/catalog/deals', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const dealsData = await deals.json();
  const dealId = dealsData.data[0].id;

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
  console.log(addData);
}
run();
