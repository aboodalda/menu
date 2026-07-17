const CURRENCY = "₪";
const CATEGORIES = [
  { id:"hot", name:"مشروبات ساخنة" },
  { id:"cold", name:"مشروبات باردة" },
  { id:"mains", name:"وجبات رئيسية" },
  { id:"sweets", name:"حلويات" },
  { id:"argela", name: "أرجيلة" },
  { id:"ieckreem", name:"آيس كريم" },
];
const STATUS_FLOW = { 'جديد':'قيد التحضير', 'قيد التحضير':'جاهز للتسليم', 'جاهز للتسليم':'تم التسليم' };
const STATUS_COLOR = { 'جديد':'var(--brass)', 'قيد التحضير':'var(--amber)', 'جاهز للتسليم':'var(--olive)', 'تم التسليم':'var(--grey)' };

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginError = document.getElementById('loginError');

document.getElementById('loginBtn').onclick = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  loginError.textContent = '';
  try { await auth.signInWithEmailAndPassword(email, pass); }
  catch (e) { loginError.textContent = 'بيانات الدخول غلط، تأكد من الإيميل وكلمة السر'; console.error(e); }
};
document.getElementById('logoutBtn').onclick = () => auth.signOut();

let unsubscribeOrders = null;
let unsubscribeMenu = null;
let currentFilter = 'all';
let allOrders = [];
let allMenuItems = [];
let isFirstOrdersSnapshot = true;
let editingItemId = null;

auth.onAuthStateChanged(user => {
  if (user) {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    populateCategorySelect();
    listenToOrders();
    listenToMenuItems();
  } else {
    loginScreen.style.display = 'block';
    dashboard.style.display = 'none';
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (unsubscribeMenu) { unsubscribeMenu(); unsubscribeMenu = null; }
    isFirstOrdersSnapshot = true;
  }
});

/* ===================== تبديل التبويبات ===================== */
const tabOrdersBtn = document.getElementById('tabOrdersBtn');
const tabMenuBtn = document.getElementById('tabMenuBtn');
const ordersPanel = document.getElementById('ordersPanel');
const menuPanel = document.getElementById('menuPanel');
const panelTitle = document.getElementById('panelTitle');

tabOrdersBtn.onclick = () => {
  tabOrdersBtn.classList.add('active'); tabMenuBtn.classList.remove('active');
  ordersPanel.style.display = 'block'; menuPanel.style.display = 'none';
  panelTitle.textContent = 'الطلبات الواردة';
};
tabMenuBtn.onclick = () => {
  tabMenuBtn.classList.add('active'); tabOrdersBtn.classList.remove('active');
  ordersPanel.style.display = 'none'; menuPanel.style.display = 'block';
  panelTitle.textContent = 'إدارة المنيو';
};

/* ===================== تنبيه صوتي عند وصول طلب جديد ===================== */
function playBeep(){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch (e) { console.error(e); }
}

/* ===================== الطلبات ===================== */
document.getElementById('filterChips').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  currentFilter = btn.dataset.status;
  [...document.getElementById('filterChips').children].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderOrders();
});

function listenToOrders(){
  const listEl = document.getElementById('ordersList');
  unsubscribeOrders = db.collection('orders').orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      if (!isFirstOrdersSnapshot) {
        const added = snapshot.docChanges().filter(c => c.type === 'added');
        if (added.length > 0) playBeep();
      }
      isFirstOrdersSnapshot = false;
      allOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderOrders();
    }, err => {
      listEl.innerHTML = '<div class="empty-state">تعذّر تحميل الطلبات، تأكد من الاتصال</div>';
      console.error(err);
    });
}

function renderOrders(){
  const listEl = document.getElementById('ordersList');
  const orders = currentFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentFilter);
  if (orders.length === 0) {
    listEl.innerHTML = '<div class="empty-state">ما في طلبات هون حاليًا</div>';
    return;
  }
  listEl.innerHTML = orders.map(o => {
    const time = o.createdAt ? o.createdAt.toDate().toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '';
    const next = STATUS_FLOW[o.status];
    return `
    <div class="order-card">
      <div class="order-card-head">
        <div>
          <div class="who">${o.name} — طلب #${o.number}</div>
          <div class="time">${time}</div>
        </div>
        <div style="text-align:left;">
          <div class="table">طاولة ${o.table}</div>
          <div class="status-pill" style="background:${STATUS_COLOR[o.status] || 'var(--grey)'}">${o.status}</div>
        </div>
      </div>
      <div class="order-lines">
        ${o.items.map(it => `<div><span>${it.name} × ${it.qty}</span><span>${it.qty * it.price} ${CURRENCY}</span></div>`).join('')}
      </div>
      ${o.notes ? `<div class="order-notes">📝 ${o.notes}</div>` : ''}
      <div class="order-total">الإجمالي: ${o.total} ${CURRENCY}</div>
      <div class="order-actions">
        ${next ? `<button class="btn-advance" data-id="${o.id}" data-next="${next}">تحويل إلى: ${next}</button>` : ''}
        <button class="btn-delete" data-id="${o.id}">حذف</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.btn-advance').forEach(b => {
    b.onclick = () => db.collection('orders').doc(b.dataset.id).update({ status: b.dataset.next }).catch(console.error);
  });
  listEl.querySelectorAll('.btn-delete').forEach(b => {
    b.onclick = () => db.collection('orders').doc(b.dataset.id).delete().catch(console.error);
  });
}

/* ===================== إدارة المنيو ===================== */
function populateCategorySelect(){
  document.getElementById('itemCategory').innerHTML =
    CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function listenToMenuItems(){
  unsubscribeMenu = db.collection('menu_items').orderBy('sortOrder').onSnapshot(snapshot => {
    allMenuItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminItems();
  }, err => console.error(err));
}

function renderAdminItems(){
  const listEl = document.getElementById('adminItemsList');
  if (allMenuItems.length === 0) {
    listEl.innerHTML = '<div class="empty-state">المنيو فاضي — اضغط "تحميل قائمة تجريبية" أو "إضافة صنف جديد"</div>';
    return;
  }
  listEl.innerHTML = CATEGORIES.map(cat => {
    const items = allMenuItems.filter(i => i.category === cat.id);
    if (items.length === 0) return '';
    return `
      <h3 style="font-family:'Aref Ruqaa',serif; color:var(--wood-deep); margin:16px 0 8px;">${cat.name}</h3>
      ${items.map(it => `
        <div class="admin-item">
          <div class="thumb">${it.img ? `<img src="${it.img}">` : '🍽️'}</div>
          <div class="info">
            <h4>${it.name} ${it.badge ? `<span style="color:var(--amber); font-size:.7rem;">${it.badge}</span>` : ''}</h4>
            <p>${it.oldPrice ? `<span class="old-price">${it.oldPrice}</span> ` : ''}${it.price} ${CURRENCY}${it.available === false ? ' · غير متوفر' : ''}</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" data-id="${it.id}" class="availToggle" ${it.available !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <button class="edit-icon-btn" data-id="${it.id}">تعديل</button>
        </div>
      `).join('')}
    `;
  }).join('');

  listEl.querySelectorAll('.availToggle').forEach(t => {
    t.onchange = () => db.collection('menu_items').doc(t.dataset.id).update({ available: t.checked }).catch(console.error);
  });
  listEl.querySelectorAll('.edit-icon-btn').forEach(b => {
    b.onclick = () => openItemEdit(allMenuItems.find(i => i.id === b.dataset.id));
  });
}

/* ---- نافذة إضافة / تعديل صنف ---- */
const itemEditOverlay = document.getElementById('itemEditOverlay');

document.getElementById('addItemBtn').onclick = () => openItemEdit(null);
document.getElementById('closeItemEdit').onclick = () => itemEditOverlay.classList.remove('show');

function openItemEdit(item){
  editingItemId = item ? item.id : null;
  document.getElementById('itemEditTitle').textContent = item ? 'تعديل الصنف' : 'إضافة صنف جديد';
  document.getElementById('itemName').value = item ? item.name : '';
  document.getElementById('itemCategory').value = item ? item.category : CATEGORIES[0].id;
  document.getElementById('itemPrice').value = item ? item.price : '';
  document.getElementById('itemOldPrice').value = item && item.oldPrice ? item.oldPrice : '';
  document.getElementById('itemImg').value = item && item.img ? item.img : '';
  document.getElementById('itemBadge').value = item && item.badge ? item.badge : '';
  document.getElementById('itemAvailable').checked = item ? item.available !== false : true;
  document.getElementById('itemEditError').textContent = '';
  document.getElementById('deleteItemBtn').style.display = item ? 'block' : 'none';
  itemEditOverlay.classList.add('show');
}

document.getElementById('saveItemBtn').onclick = async () => {
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value;
  const price = parseFloat(document.getElementById('itemPrice').value);
  const oldPriceVal = document.getElementById('itemOldPrice').value;
  const oldPrice = oldPriceVal ? parseFloat(oldPriceVal) : null;
  const img = document.getElementById('itemImg').value.trim();
  const badge = document.getElementById('itemBadge').value.trim();
  const available = document.getElementById('itemAvailable').checked;
  const errEl = document.getElementById('itemEditError');

  if (!name || isNaN(price)) { errEl.textContent = 'عبّي اسم الصنف والسعر على الأقل'; return; }

  const btn = document.getElementById('saveItemBtn');
  btn.disabled = true; btn.textContent = 'جاري الحفظ...';
  try {
    const data = { name, category, price, oldPrice, img, badge, available };
    if (editingItemId) {
      await db.collection('menu_items').doc(editingItemId).update(data);
    } else {
      data.sortOrder = Date.now();
      await db.collection('menu_items').add(data);
    }
    itemEditOverlay.classList.remove('show');
  } catch (e) {
    errEl.textContent = 'صار خطأ بالحفظ، جرّب مرة ثانية';
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = 'حفظ';
  }
};

document.getElementById('deleteItemBtn').onclick = async () => {
  if (!editingItemId) return;
  if (!confirm('متأكد بدك تحذف هالصنف نهائيًا؟')) return;
  try { await db.collection('menu_items').doc(editingItemId).delete(); itemEditOverlay.classList.remove('show'); }
  catch (e) { console.error(e); }
};

/* ---- تحميل قائمة تجريبية (مرة وحدة) ---- */
document.getElementById('seedBtn').onclick = async () => {
  if (allMenuItems.length > 0) {
    if (!confirm('في أصناف موجودة أصلاً بالمنيو — بدك تضيف القائمة التجريبية فوقها؟')) return;
  }
  const defaults = [
    { category:"hot", name:"قهوة عربية", price:8 },
    { category:"hot", name:"كابتشينو", price:14 },
    { category:"hot", name:"لاتيه بالفانيليا", price:15 },
    { category:"hot", name:"شاي بالنعناع", price:7 },
    { category:"cold", name:"عصير برتقال طازج", price:12 },
    { category:"cold", name:"ليموناضة بالنعناع", price:10 },
    { category:"cold", name:"آيس كوفي كراميل", price:16 },
    { category:"mains", name:"مسخن دجاج", price:38, badge:"🔥 الأكثر طلبًا" },
    { category:"mains", name:"مقلوبة باللحم", price:45 },
    { category:"mains", name:"شاورما دجاج", price:28 },
    { category:"mains", name:"برجر لحم مشوي", price:32, oldPrice:38, badge:"عرض خاص" },
    { category:"sweets", name:"كنافة نابلسية", price:20 },
    { category:"sweets", name:"بقلاوة بالفستق", price:18 },
  ];
  const btn = document.getElementById('seedBtn');
  btn.disabled = true; btn.textContent = 'جاري الإضافة...';
  try {
    const batch = db.batch();
    defaults.forEach((item, idx) => {
      const ref = db.collection('menu_items').doc();
      batch.set(ref, { available:true, oldPrice:null, img:"", badge:"", ...item, sortOrder: (idx + 1) * 10 });
    });
    await batch.commit();
  } catch (e) { console.error(e); alert('صار خطأ، جرّب مرة ثانية'); }
  finally { btn.disabled = false; btn.textContent = '📥 تحميل قائمة تجريبية (استخدمها مرة وحدة بس لو المنيو فاضي)'; }
};
