/**
 * 5 demo products + unki inventory (stock/price) add karta hai.
 * Chalane se pehle backend server (port 5000) chal raha ho.
 *   node seedProducts.js
 */
const BASE = process.env.BASE || 'http://localhost:5000/pos';
const USER = 'admin', PASS = 'admin';

const products = [
  { name: 'Sugar 1kg',            ProductsNameurdu: 'چینی',      brand: 'Al-Noor',  categoryName: 'Grocery',   unit: 'kg',     packType: 'Bag',   unitPerpack: 50, qty: 120, cost: 135, sale: 150, wholesale: 142 },
  { name: 'Cooking Oil 5 Litre',  ProductsNameurdu: 'کوکنگ آئل', brand: 'Dalda',    categoryName: 'Grocery',   unit: 'litre',  packType: 'Carton',unitPerpack: 4,  qty: 40,  cost: 2350, sale: 2600, wholesale: 2480 },
  { name: 'Basmati Rice 5kg',     ProductsNameurdu: 'باسمتی چاول', brand: 'Guard', categoryName: 'Grocery',   unit: 'kg',     packType: 'Bag',   unitPerpack: 10, qty: 60,  cost: 1450, sale: 1650, wholesale: 1550 },
  { name: 'Tea Pack 500g',        ProductsNameurdu: 'چائے',      brand: 'Tapal',    categoryName: 'Beverages', unit: 'pack',   packType: 'Carton',unitPerpack: 12, qty: 85,  cost: 1120, sale: 1290, wholesale: 1200 },
  { name: 'Milk Pack 1 Litre',    ProductsNameurdu: 'دودھ',      brand: 'Olpers',   categoryName: 'Dairy',     unit: 'litre',  packType: 'Carton',unitPerpack: 12, qty: 150, cost: 245,  sale: 280,  wholesale: 262 },
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

  for (const p of products) {
    const pr = await post('/product', {
      name: p.name,
      ProductsNameurdu: p.ProductsNameurdu,
      brand: p.brand,
      categoryName: p.categoryName,
      unit: p.unit,
      packType: p.packType,
      unitPerpack: p.unitPerpack,
      status: 'active',
      description: `${p.brand} - ${p.name}`
    }, token);

    if (pr.status !== 200) {
      console.log(`FAIL  ${p.name} ->`, JSON.stringify(pr.json).slice(0, 160));
      continue;
    }
    const prod = pr.json;

    const inv = await post('/inventory', {
      productRef: { _id: prod._id },
      productId: prod.productId,
      productName: prod.name,
      ProductsNameurdu: prod.ProductsNameurdu,
      barcode: prod.barcode,
      packType: p.packType,
      unitPerpack: p.unitPerpack,
      packQuantity: Math.floor(p.qty / (p.unitPerpack || 1)),
      totalInventory: p.qty,
      totalUnits: p.qty,
      unitPrice: p.cost,
      unitPriceAfterDiliveryCharges: p.cost,
      salePrice: p.sale,
      wholeSalePrice: p.wholesale,
      totalPrice: p.cost * p.qty,
      directAdd: true
    }, token);

    console.log(
      `OK    #${prod.productId}  ${prod.barcode.padEnd(7)}  ${p.name.padEnd(24)}  qty ${String(p.qty).padStart(4)}  cost ${String(p.cost).padStart(5)}  sale ${String(p.sale).padStart(5)}  ` +
      (inv.status === 200 ? `inv#${inv.json.inventoryNo}` : `INVENTORY FAIL: ${JSON.stringify(inv.json).slice(0,120)}`)
    );
  }
})();
