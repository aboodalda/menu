/* ================= الإعدادات الثابتة (الأقسام فقط — الأصناف تُدار من لوحة التحكم) ================= */
const CURRENCY = "₪";
const CATEGORIES = [
  { id:"hot", name:"مشروبات ساخنة" },
  { id:"cold", name:"مشروبات باردة" },
  { id:"mains", name:"وجبات رئيسية" },
  { id:"sweets", name:"حلويات" },
  { id:"argela", name:"أرجيلة" },
  { id:"ieckreem", name:"آيس كريم" },
];
/* ===================================================================== */

let cart = {}; // key: itemId -> {qty, price, name}
let allItems = [];
let searchTerm = "";

/* ---------- تأثير الكتابة التدريجية لجملة التعريف ---------- */
function typewriterTagline(){
  const el = document.getElementById('tagline');
  if (!el) return;
  const text = el.dataset.text || '';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { el.textContent = text; return; }

  el.textContent = '';
  el.classList.add('typing');
  let i = 0;
  const speed = 42;
  (function step(){
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(step, speed);
    } else {
      el.classList.remove('typing');
    }
  })();
}
typewriterTagline();

const tabsEl = document.getElementById('tabs');
const menuEl = document.getElementById('menu');
const searchInput = document.getElementById('searchInput');

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderMenu();
});

db.collection('menu_items').orderBy('sortOrder').onSnapshot(snapshot => {
  allItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMenu();
}, err => {
  menuEl.innerHTML = '<div class="empty-state">تعذّر تحميل المنيو، تأكد من الاتصال بالإنترنت</div>';
  console.error(err);
});

function renderMenu(){
  tabsEl.innerHTML = '';
  menuEl.innerHTML = '';

  if (allItems.length === 0) {
    menuEl.innerHTML = '<div class="empty-state">المنيو لسه فاضي — بانتظار صاحب الكافتيريا يضيف الأصناف</div>';
    return;
  }

  CATEGORIES.forEach(cat => {
    let items = allItems.filter(it => it.category === cat.id);
    if (searchTerm) items = items.filter(it => it.name.toLowerCase().includes(searchTerm));
    if (items.length === 0) return;

    const btn = document.createElement('button');
    btn.textContent = cat.name;
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
      <div class="items">${items.map(renderItemCard).join('')}</div>
    `;
    menuEl.appendChild(section);
  });

  if (tabsEl.firstChild) tabsEl.firstChild.classList.add('active');
  if (menuEl.children.length === 0) {
    menuEl.innerHTML = '<div class="empty-state">ما في أصناف مطابقة لبحثك</div>';
  }
  attachStepperEvents();
  observeCardReveal();
}

/* ---------- حركة الظهور التصاعدية للبطاقات ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

function observeCardReveal(){
  document.querySelectorAll('.item-card').forEach((card, idx) => {
    card.style.transitionDelay = `${(idx % 6) * 0.07}s`;
    revealObserver.observe(card);
  });
}

function renderItemCard(it){
  const unavailable = it.available === false;
  const media = it.img
    ? `<img src="${it.img}" alt="${it.name}" loading="lazy">`
    : `<span class="placeholder-icon">🍽️</span>`;
  return `
    <div class="item-card ${unavailable ? 'unavailable' : ''}">
      ${it.badge ? `<div class="item-badge">${it.badge}</div>` : ''}
      <div class="item-media">${media}${unavailable ? `<div class="unavailable-tag">غير متوفر حاليًا</div>` : ''}</div>
      <div class="item-top">
        <div class="item-info"><h3>${it.name}</h3></div>
        <div class="price-tag">
          ${it.oldPrice ? `<span class="old-price">${it.oldPrice} ${CURRENCY}</span>` : ''}${it.price} ${CURRENCY}
        </div>
      </div>
      <div class="stepper" data-key="${it.id}">
        <button class="minus" ${unavailable ? 'disabled' : ''}>−</button>
        <span class="qty">0</span>
        <button class="plus" ${unavailable ? 'disabled' : ''}>+</button>
      </div>
    </div>
  `;
}

function attachStepperEvents(){
  menuEl.querySelectorAll('.stepper').forEach(stepper => {
    const key = stepper.dataset.key;
    const item = allItems.find(i => i.id === key);
    if (!item) return;
    const qtyEl = stepper.querySelector('.qty');
    qtyEl.textContent = cart[key] ? cart[key].qty : 0;
    const plusBtn = stepper.querySelector('.plus');
    const minusBtn = stepper.querySelector('.minus');
    if (plusBtn.disabled) return;
    plusBtn.onclick = () => {
      cart[key] = cart[key] || { qty:0, price:item.price, name:item.name };
      cart[key].qty++;
      qtyEl.textContent = cart[key].qty;
      updateCartBar();
    };
    minusBtn.onclick = () => {
      if (!cart[key] || cart[key].qty <= 0) return;
      cart[key].qty--;
      qtyEl.textContent = cart[key].qty;
      if (cart[key].qty === 0) delete cart[key];
      updateCartBar();
    };
  });
}

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
    <div class="sheet-item"><span class="name">${c.name} × ${c.qty}</span><span>${c.qty * c.price} ${CURRENCY}</span></div>
  `).join('');
  const { total } = cartCountTotal();
  document.getElementById('sheetTotal').textContent = `${total} ${CURRENCY}`;
  document.getElementById('checkoutError').textContent = '';
  checkoutOverlay.classList.add('show');
};
document.getElementById('closeCheckout').onclick = () => checkoutOverlay.classList.remove('show');

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
  const notes = document.getElementById('custNotes').value.trim();
  const errEl = document.getElementById('checkoutError');
  const { count, total } = cartCountTotal();
  if (count === 0) { errEl.textContent = 'السلة فارغة، ضيف أصناف الأول'; return; }
  if (!name || !table) { errEl.textContent = 'عبّي اسمك ورقم الطاولة'; return; }

  const btn = document.getElementById('submitOrderBtn');
  btn.disabled = true; btn.textContent = 'جاري الإرسال...'; errEl.textContent = '';

  try {
    const orderNumber = await nextOrderNumber();
    const orderData = {
      number: orderNumber,
      name, table,
      items: Object.values(cart).map(c => ({ name:c.name, qty:c.qty, price:c.price })),
      total,
      status: 'جديد',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (notes) orderData.notes = notes;
    await db.collection('orders').add(orderData);

    checkoutOverlay.classList.remove('show');
    document.getElementById('orderNumberDisplay').textContent = `#${orderNumber}`;
    document.getElementById('confirmOverlay').classList.add('show');
    cart = {};
    updateCartBar();
    document.getElementById('custNotes').value = '';
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
