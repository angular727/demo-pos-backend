/**
 * 2 demo customers add karta hai.
 *   npm run seed:customers
 */
const BASE = process.env.BASE || 'http://localhost:5000/pos';
const USER = 'admin', PASS = 'admin';

const customers = [
  {
    name: 'Imran Khalid',
    businessName: 'Khalid Kiryana Store',
    ownerName: 'Imran Khalid',
    phone: '0301-4455667',
    whatsapp: '0301-4455667',
    email: 'khalid.kiryana@gmail.com',
    address: 'Shop 8, Iqbal Market',
    address1: 'Near Bus Stand',
    city: 'Multan',
    type: 'Retailer',
    openingBalance: '0',
    balanceType: '',
    amountPayable: 0
  },
  {
    name: 'Usman Tariq',
    businessName: 'Usman General Store',
    ownerName: 'Usman Tariq',
    phone: '0345-7788990',
    whatsapp: '0345-7788990',
    email: 'usman.store@gmail.com',
    address: 'House 22, Street 4',
    address1: 'Model Town',
    city: 'Bahawalpur',
    type: 'Walk-in',
    openingBalance: '12500',
    balanceType: 'receivable',
    amountPayable: 12500
  }
];

const post = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
};

(async () => {
  const login = await post('/users/login', { username: USER, password: PASS });
  if (!login.json?.token) { console.error('Login failed:', login); process.exit(1); }
  const token = login.json.token;

  for (const c of customers) {
    const r = await post('/customer', c, token);
    if (r.status === 200) {
      console.log(
        `OK    #${String(r.json.readableId).padEnd(2)} ${r.json.name.padEnd(16)} ` +
        `${(r.json.businessName || '').padEnd(22)} ${(r.json.city || '').padEnd(12)} ` +
        `${(r.json.phone || '').padEnd(14)} balance ${r.json.amountPayable}`
      );
    } else {
      console.log(`FAIL  ${c.name} ->`, JSON.stringify(r.json).slice(0, 200));
    }
  }
})();
