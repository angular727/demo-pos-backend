/**
 * 3 demo suppliers add karta hai.
 * Backend server (port 5000) chal raha ho.
 *   npm run seed:suppliers
 */
const BASE = process.env.BASE || 'http://localhost:5000/pos';
const USER = 'admin', PASS = 'admin';

const suppliers = [
  {
    name: 'Al-Noor Traders',
    businessName: 'Al-Noor Traders (Pvt) Ltd',
    ownerName: 'Muhammad Aslam',
    phone: '0300-4567890',
    whatsapp: '0300-4567890',
    email: 'info@alnoortraders.pk',
    address: 'Shop 14, Akbari Mandi',
    address1: 'Near Grain Market',
    city: 'Lahore',
    type: 'Distributor',
    paymentMethod: 'Bank Transfer',
    accountTitle: 'Al-Noor Traders',
    accountNo: 'PK36MEZN0001234567890123',
    openingBalance: '150000',
    balanceType: 'payable',
    amountPayable: 150000
  },
  {
    name: 'Shaheen Distributors',
    businessName: 'Shaheen Distributors',
    ownerName: 'Kashif Mehmood',
    phone: '0321-8765432',
    whatsapp: '0321-8765432',
    email: 'sales@shaheendist.pk',
    address: 'Plot 27-B, Industrial Area',
    address1: 'Block 5, SITE',
    city: 'Karachi',
    type: 'Wholesaler',
    paymentMethod: 'Cash',
    accountTitle: 'Shaheen Distributors',
    accountNo: 'PK22HABB0009876543210987',
    openingBalance: '0',
    balanceType: '',
    amountPayable: 0
  },
  {
    name: 'Zam Zam Wholesale',
    businessName: 'Zam Zam Wholesale Store',
    ownerName: 'Bilal Ahmed',
    phone: '0333-2223344',
    whatsapp: '0333-2223344',
    email: 'zamzam.wholesale@gmail.com',
    address: 'Main Bazaar, Saddar',
    address1: 'Opposite Jamia Masjid',
    city: 'Rawalpindi',
    type: 'Supplier',
    paymentMethod: 'Easypaisa',
    accountTitle: 'Bilal Ahmed',
    accountNo: '03332223344',
    openingBalance: '48500',
    balanceType: 'payable',
    amountPayable: 48500
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
  console.log('Logged in as', USER, '\n');

  for (const s of suppliers) {
    const r = await post('/supplier', s, token);
    if (r.status === 200) {
      console.log(
        `OK    #${String(r.json.supplierNumber).padEnd(2)} ${r.json.name.padEnd(22)} ` +
        `${(r.json.ownerName || '').padEnd(18)} ${(r.json.city || '').padEnd(11)} ` +
        `${(r.json.phone || '').padEnd(14)} payable ${r.json.amountPayable}`
      );
    } else {
      console.log(`FAIL  ${s.name} ->`, JSON.stringify(r.json).slice(0, 180));
    }
  }
})();
