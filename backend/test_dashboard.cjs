async function testApi() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }) 
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    const dashRes = await fetch('http://localhost:5000/api/v1/dashboard/summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Dash Status:', dashRes.status);
    console.log('Dash Response:', await dashRes.text());
  } catch (err) {
    console.error(err);
  }
}
testApi();
