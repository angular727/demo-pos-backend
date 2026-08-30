/**
 * 3 purchase invoices banata hai (har supplier se), jo inventory + purchase
 * record + supplier transaction teeno create karti hain.
 *   npm run seed:purchases
 */
const BASE = process.env.BASE || 'http://localhost:5000/pos';
const USER = 'admin', PASS = 'admin';

const req = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
};

// kaunsa supplier kaunsa product laya, aur kis rate pe
const invoices = [
  {
    invoiceNo: 'PINV-1001',
    supplier: 'Al-Noor Traders',
    paymentMethod: 'Bank Transfer',
    payFull: true,
    items: [
      { product: 'Sugar 1kg',        qty: 120, cost: 135,  sale: 150,  wholesale: 142,  packType: 'Bag',    unitPerpack: 50, unit: 'kg' },
      { product: 'Basmati Rice 5kg', qty: 60,  cost: 1450, sale: 1650, wholesale: 1550, packType: 'Bag',    unitPerpack: 10, unit: 'kg' }
    ]
  },
  {
    invoiceNo: 'PINV-1002',
    supplier: 'Shaheen Distributors',
    paymentMethod: 'Cash',
    partialPay: 100000,
    items: [
      { product: 'Cooking Oil 5 Litre', qty: 40, cost: 2350, sale: 2600, wholesale: 2480, packType: 'Carton', unitPerpack: 4,  unit: 'litre' },
      { product: 'Tea Pack 500g',       qty: 85, cost: 1120, sale: 1290, wholesale: 1200, packType: 'Carton', unitPerpack: 12, unit: 'pack' }
    ]
  },
  {
    invoiceNo: 'PINV-1003',
    supplier: 'Zam Zam Wholesale',
    paymentMethod: 'Credit',
    partialPay: 0,
    items: [
      { product: 'Milk Pack 1 Litre', qty: 150, cost: 245, sale: 280, wholesale: 262, packType: 'Carton', unitPerpack: 12, unit: 'litre' }
    ]
  }
];

(async () => {
  const login = await req('POST', '/users/login', { username: USER, password: PASS });
  if (!login.json?.token) { console.error('Login failed:', login); process.exit(1); }
  const token = login.json.token;

  const asArray = r => Array.isArray(r.json) ? r.json : (r.json.data || []);
  const products  = asArray(await req('GET', '/product', null, token));
  const suppliers = asArray(await req('GET', '/supplier', null, token));
  const findP = n => products.find(p => p.name === n);
  const findS = n => suppliers.find(s => s.name === n);

  const today = new Date().toISOString().split('T')[0];

  for (const inv of invoices) {
    const sup = findS(inv.supplier);
    if (!sup) { console.log('FAIL  supplier nahi mila:', inv.supplier); continue; }

    const itemDetails = [];
    let subTotal = 0;

    for (const it of inv.items) {
      const p = findP(it.product);
      if (!p) { console.log('FAIL  product nahi mila:', it.product); continue; }
      const lineTotal = it.qty * it.cost;
      subTotal += lineTotal;

      itemDetails.push({
        productRef: { _id: p._id, productId: p.productId, name: p.name },
        productName: p.name,
        ProductsNameurdu: p.ProductsNameurdu || '',
        barcode: p.barcode,
        supplierId: sup._id,
        totalUnits: it.qty,
        quantity: it.qty,
        packType: it.packType,
        unitPerpack: it.unitPerpack,
        packQuantity: Math.floor(it.qty / (it.unitPerpack || 1)),
        unit: it.unit,
        unitPrice: it.cost,
        unitPriceAfterDisc: it.cost,
        unitPriceAfterDiliveryCharges: it.cost,
        salePrice: it.sale,
        wholeSalePrice: it.wholesale,
        totalPrice: lineTotal,
        discount: 0,
        description: `${p.name} - ${inv.supplier}`
      });
    }

    const paid = inv.payFull ? subTotal : (inv.partialPay || 0);

    const payload = {
      invoiceNo: inv.invoiceNo,
      supplierRef: { _id: sup._id, name: sup.name },
      purchaseDate: today,
      itemDetails,
      subTotal,
      totalDiscount: 0,
      extraDiscount: 0,
      totalAfterDiscount: subTotal,
      grandTotal: subTotal,
      totalPayable: subTotal,
      totalPrice: subTotal,
      paidAmount: paid,
      receivedAmount: paid,
      remainingAmount: subTotal - paid,
      // paymentMethod ek Payment account ka ObjectId hai; abhi koi account nahi bana,
      // isliye chhod rahe hain. accountType me method ka naam rakh dete hain.
      accountType: inv.paymentMethod,
      deliveryChargesIncluded: false,
      deliveryCharges: 0,
      description: `Purchase from ${inv.supplier}`
    };

    const r = await req('POST', '/purchase', payload, token);
    if (r.status === 200) {
      console.log(
        `OK    ${inv.invoiceNo}  ${inv.supplier.padEnd(22)} ` +
        `${String(itemDetails.length)} items  total ${String(subTotal).padStart(7)}  ` +
        `paid ${String(paid).padStart(7)}  baqaya ${String(subTotal - paid).padStart(7)}  [${inv.paymentMethod}]`
      );
    } else {
      console.log(`FAIL  ${inv.invoiceNo} ->`, JSON.stringify(r.json).slice(0, 300));
    }
  }
})();
