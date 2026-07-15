/* ================= بيانات المنيو (عدّل هنا أسماء الأصناف والأسعار) ================= */
const CURRENCY = "₪";
const MENU = [
  { id:"hot", name:"مشروبات ساخنة", items:[
    { name:"قهوة عربية", price:8 },
    { name:"كابتشينو", price:14 },
    { name:"لاتيه بالفانيليا", price:15 },
    { name:"شاي بالنعناع", price:7 },
  ]},
  { id:"cold", name:"مشروبات باردة", items:[
    { name:"عصير برتقال طازج", price:12 },
    { name:"ليموناضة بالنعناع", price:10 },
    { name:"آيس كوفي كراميل", price:16 },
  ]},
  { id:"mains", name:"وجبات رئيسية", items:[
    { name:"مسخن دجاج", price:38 },
    { name:"مقلوبة باللحم", price:45 },
    { name:"شاورما دجاج", price:28 },
    { name:"برجر لحم مشوي", price:32 },
  ]},
  { id:"sweets", name:"حلويات", items:[
    { name:"كنافة نابلسية", price:20 },
    { name:"بقلاوة بالفستق", price:18 },
  ]},
];
/* ===================================================================== */

let cart = {}; // key: "catId|itemName" -> {qty, price, name}

const tabsEl = document.getElementById('tabs');
const menuEl = document.getElementById('menu');

MENU.forEach((cat, i) => {
  const btn = document.createElement('button');
  btn.textContent = cat.name;
  btn.className = i === 0 ? 'active' : '';
  btn.onclick = () => {
    document.getElementById(cat.id).scrollIntoView({behavior:'smooth'});
    [...tabsEl.children].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
  tabsEl.appendChild(btn);

  const section = document.createElement('section');
  section.className = 'category';
  section.id = cat.id;
  section.innerHTML = `
    <div class="cat-head"><h2>${cat.name}</h2></div>
    <div class="items">
      ${cat.items.map(it => {
        const key = `${cat.id}|${it.name}`;
        return `
        <div class="item-card">
          <div class="item-top">
            <div class="item-info"><h3>${it.name}</h3></div>
            <div class="price-tag">${it.price} ${CURRENCY}</div>
          </div>
          <div class="stepper" data-key="${key}">
            <button class="minus">−</button>
            <span class="qty">0</span>
            <button class="plus">+</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  menuEl.appendChild(section);
});

menuEl.querySelectorAll('.stepper').forEach(stepper => {
  const key = stepper.dataset.key;
  const [catId, name] = key.split('|');
  const item = MENU.find(c => c.id === catId).items.find(i => i.name === name);
  const qtyEl = stepper.querySelector('.qty');
  stepper.querySelector('.plus').onclick = () => {
    cart[key] = cart[key] || { qty:0, price:item.price, name:item.name };
    cart[key].qty++;
    qtyEl.textContent = cart[key].qty;
    updateCartBar();
  };
  stepper.querySelector('.minus').onclick = () => {
    if (!cart[key] || cart[key].qty <= 0) return;
    cart[key].qty--;
    qtyEl.textContent = cart[key].qty;
    if (cart[key].qty === 0) delete cart[key];
    updateCartBar();
  };
});

function cartCountTotal(){
  let count = 0, total = 0;
  Object.values(cart).forEach(c => { count += c.qty; total += c.qty * c.price; });
  return { count, total };
}
function updateCartBar(){
  const { count, total } = cartCountTotal();
  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotal').textContent = total;
  document.getElementById('cartBar').classList.toggle('show', count > 0);
}

const checkoutOverlay = document.getElementById('checkoutOverlay');
document.getElementById('openCheckout').onclick = () => {
  const lines = document.getElementById('cartLines');
  lines.innerHTML = Object.values(cart).map(c => `
    <div class="sheet-item">
      <span class="name">${c.name} × ${c.qty}</span>
      <span>${c.qty * c.price} ${CURRENCY}</span>
    </div>
  `).join('');
  const { total } = cartCountTotal();
  document.getElementById('sheetTotal').textContent = `${total} ${CURRENCY}`;
  document.getElementById('checkoutError').textContent = '';
  checkoutOverlay.classList.add('show');
};
document.getElementById('closeCheckout').onclick = () => checkoutOverlay.classList.remove('show');

/* ---------- رقم تسلسلي للطلب عبر معاملة آمنة (Transaction) ---------- */
async function nextOrderNumber(){
  const counterRef = db.collection('meta').doc('orderCounter');
  return db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    const current = doc.exists ? doc.data().value : 0;
    const next = current + 1;
    t.set(counterRef, { value: next });
    return next;
  });
}

document.getElementById('submitOrderBtn').onclick = async () => {
  const name = document.getElementById('custName').value.trim();
  const table = document.getElementById('custTable').value.trim();
  const errEl = document.getElementById('checkoutError');
  const { count, total } = cartCountTotal();
  if (count === 0) { errEl.textContent = 'السلة فارغة، ضيف أصناف الأول'; return; }
  if (!name || !table) { errEl.textContent = 'عبّي اسمك ورقم الطاولة'; return; }

  const btn = document.getElementById('submitOrderBtn');
  btn.disabled = true; btn.textContent = 'جاري الإرسال...'; errEl.textContent = '';

  try {
    const orderNumber = await nextOrderNumber();
    await db.collection('orders').add({
      number: orderNumber,
      name, table,
      items: Object.values(cart).map(c => ({ name:c.name, qty:c.qty, price:c.price })),
      total,
      status: 'جديد',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    checkoutOverlay.classList.remove('show');
    document.getElementById('orderNumberDisplay').textContent = `#${orderNumber}`;
    document.getElementById('confirmOverlay').classList.add('show');
    cart = {};
    updateCartBar();
    menuEl.querySelectorAll('.qty').forEach(q => q.textContent = '0');
  } catch (e) {
    errEl.textContent = 'صار خطأ بإرسال الطلب، تأكد من اتصال الإنترنت وجرّب مرة ثانية';
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = 'إرسال الطلب للمطبخ';
  }
};
document.getElementById('newOrderBtn').onclick = () => {
  document.getElementById('confirmOverlay').classList.remove('show');
};
