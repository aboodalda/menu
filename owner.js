const CURRENCY = "₪";
const CATEGORIES = [
  { id:"hot", name:"مشروبات ساخنة" },
  { id:"cold", name:"مشروبات باردة" },
  { id:"mains", name:"وجبات رئيسية" },
  { id:"sweets", name:"حلويات" },
  { id:"argela", name:"أرجيلة" },
  { id:"ieckreem", name:"آيس كريم" },
  { id:"fish", name:"أسماك" },
  { id:"saltat", name:"سلطات" },
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
const tabLedgerBtn = document.getElementById('tabLedgerBtn');
const ordersPanel = document.getElementById('ordersPanel');
const menuPanel = document.getElementById('menuPanel');
const ledgerPanel = document.getElementById('ledgerPanel');
const panelTitle = document.getElementById('panelTitle');

function activateTab(activeBtn, activePanel, title){
  [tabOrdersBtn, tabMenuBtn, tabLedgerBtn].forEach(b => b.classList.remove('active'));
  [ordersPanel, menuPanel, ledgerPanel].forEach(p => p.style.display = 'none');
  activeBtn.classList.add('active');
  activePanel.style.display = 'block';
  panelTitle.textContent = title;
}

tabOrdersBtn.onclick = () => activateTab(tabOrdersBtn, ordersPanel, 'الطلبات الواردة');
tabMenuBtn.onclick = () => activateTab(tabMenuBtn, menuPanel, 'إدارة المنيو');
tabLedgerBtn.onclick = () => { activateTab(tabLedgerBtn, ledgerPanel, 'سجل الطلبات'); renderLedger(); };

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
      if (ledgerPanel.style.display !== 'none') renderLedger();
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
        <a class="btn-print" href="invoice.html?id=${o.id}" target="_blank">🖨️ الفاتورة</a>
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

  const knownIds = CATEGORIES.map(c => c.id);
  const orphans = allMenuItems.filter(i => !knownIds.includes(i.category));

  let html = '';

  if (orphans.length > 0) {
    html += `
      <div style="background:#fff4e0; border:1px solid var(--amber); border-radius:12px; padding:12px 14px; margin-bottom:14px;">
        <b style="color:var(--amber);">⚠️ أصناف غير مصنّفة (${orphans.length})</b>
        <p style="font-size:.78rem; color:var(--wood-deep); margin-top:4px;">هاي أصناف قسمها مش موجود حاليًا بقائمة الأقسام — لسا محفوظة، بس ما بتظهر بالمنيو. لاحظ اسم القسم (category) المكتوب تحت كل صنف وأخبر المطوّر فيه عشان يضيفه.</p>
      </div>
      ${orphans.map(it => `
        <div class="admin-item">
          <div class="thumb">${it.img ? `<img src="${it.img}">` : '🍽️'}</div>
          <div class="info">
            <h4>${it.name}</h4>
            <p>${it.price} ${CURRENCY} · category: <code>${it.category || '(فاضي)'}</code></p>
          </div>
          <button class="edit-icon-btn" data-id="${it.id}">تعديل</button>
        </div>
      `).join('')}
    `;
  }

  html += CATEGORIES.map(cat => {
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

  listEl.innerHTML = html;

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
  document.getElementById('itemImageFile').value = '';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('uploadStatus').className = 'upload-status';
  updateImagePreview(item && item.img ? item.img : '');
  itemEditOverlay.classList.add('show');
}

function updateImagePreview(url){
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = url ? `<img src="${url}">` : '<span>🍽️</span>';
}

document.getElementById('itemImg').addEventListener('input', (e) => {
  updateImagePreview(e.target.value.trim());
});

/* ---------- اختيار صورة من المعرض وضغطها محليًا (بدون أي خدمة خارجية) ---------- */
function compressImageToDataURL(file, maxWidth, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('تعذّر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

async function getCompressedImage(file){
  const MAX_BYTES = 700 * 1024; // هامش أمان تحت حد الـ 1 ميجا لكل مستند بـ Firestore
  let width = 800, quality = 0.72;
  let dataUrl = await compressImageToDataURL(file, width, quality);
  while (dataUrl.length > MAX_BYTES && quality > 0.35) {
    quality -= 0.12;
    dataUrl = await compressImageToDataURL(file, width, quality);
  }
  if (dataUrl.length > MAX_BYTES) {
    width = 500; quality = 0.5;
    dataUrl = await compressImageToDataURL(file, width, quality);
  }
  if (dataUrl.length > MAX_BYTES) {
    width = 360; quality = 0.45;
    dataUrl = await compressImageToDataURL(file, width, quality);
  }
  return dataUrl;
}

document.getElementById('itemImageFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('uploadStatus');

  if (!file.type.startsWith('image/')) {
    statusEl.textContent = 'اختر ملف صورة صحيح';
    statusEl.className = 'upload-status error';
    return;
  }

  statusEl.textContent = 'جاري ضغط الصورة...';
  statusEl.className = 'upload-status uploading';

  try {
    const dataUrl = await getCompressedImage(file);
    if (dataUrl.length > 900 * 1024) {
      statusEl.textContent = 'الصورة كبيرة جدًا حتى بعد الضغط — جرّب صورة أبسط أو مصدر تاني';
      statusEl.className = 'upload-status error';
      return;
    }
    document.getElementById('itemImg').value = dataUrl;
    updateImagePreview(dataUrl);
    statusEl.textContent = `✅ جاهزة (${Math.round(dataUrl.length/1024)} كيلوبايت تقريبًا)`;
    statusEl.className = 'upload-status success';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'صار خطأ، جرّب صورة ثانية';
    statusEl.className = 'upload-status error';
  }
});

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

/* ===================== السجل (كشف الطلبات) ===================== */
let ledgerMode = 'today';

document.getElementById('ledgerModeChips').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  ledgerMode = btn.dataset.mode;
  [...document.getElementById('ledgerModeChips').children].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ledgerTodayView').style.display = ledgerMode === 'today' ? 'block' : 'none';
  document.getElementById('ledgerHistoryView').style.display = ledgerMode === 'history' ? 'block' : 'none';
  renderLedger();
});

function dateKey(jsDate){
  // مفتاح يوم محلي ثابت (سنة-شهر-يوم) بعيدًا عن مشاكل فرق التوقيت
  const y = jsDate.getFullYear(), m = String(jsDate.getMonth()+1).padStart(2,'0'), d = String(jsDate.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function dateLabel(jsDate){
  return jsDate.toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long' });
}

function renderLedger(){
  if (ledgerMode === 'today') renderLedgerToday();
  else renderLedgerHistory();
}

function renderLedgerToday(){
  const body = document.getElementById('ledgerBody');
  const grandTotalEl = document.getElementById('ledgerGrandTotal');
  const todayKey = dateKey(new Date());

  const todaysOrders = allOrders.filter(o => o.createdAt && dateKey(o.createdAt.toDate()) === todayKey);

  if (todaysOrders.length === 0) {
    body.innerHTML = '<tr><td colspan="4">لسه ما في طلبات اليوم</td></tr>';
    grandTotalEl.textContent = `0 ${CURRENCY}`;
    return;
  }

  const sorted = [...todaysOrders].sort((a, b) => (a.number || 0) - (b.number || 0));

  body.innerHTML = sorted.map((o, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${o.name}</td>
      <td>${o.table}</td>
      <td>
        <input type="number" class="ledger-price-input" data-id="${o.id}" value="${o.total}" step="0.5">
        <span class="ledger-save-note" id="saveNote-${o.id}">✓ تم الحفظ</span>
      </td>
    </tr>
  `).join('');

  recalcGrandTotal();

  body.querySelectorAll('.ledger-price-input').forEach(input => {
    input.addEventListener('input', recalcGrandTotal);
    input.addEventListener('change', async () => {
      const newTotal = parseFloat(input.value);
      if (isNaN(newTotal) || newTotal < 0) { input.value = 0; return; }
      recalcGrandTotal();
      try {
        await db.collection('orders').doc(input.dataset.id).update({ total: newTotal });
        const note = document.getElementById(`saveNote-${input.dataset.id}`);
        note.classList.add('show');
        setTimeout(() => note.classList.remove('show'), 1500);
      } catch (e) { console.error(e); alert('تعذّر حفظ التعديل، جرّب مرة ثانية'); }
    });
  });
}

function recalcGrandTotal(){
  const grandTotalEl = document.getElementById('ledgerGrandTotal');
  let sum = 0;
  document.querySelectorAll('#ledgerBody .ledger-price-input').forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) sum += v;
  });
  grandTotalEl.textContent = `${sum} ${CURRENCY}`;
}

function renderLedgerHistory(){
  const body = document.getElementById('ledgerHistoryBody');

  const withDates = allOrders.filter(o => o.createdAt);
  if (withDates.length === 0) {
    body.innerHTML = '<tr><td colspan="3">ما في بيانات كافية لسه</td></tr>';
    return;
  }

  // تجميع الطلبات حسب اليوم
  const groups = {};
  withDates.forEach(o => {
    const jsDate = o.createdAt.toDate();
    const key = dateKey(jsDate);
    if (!groups[key]) groups[key] = { label: dateLabel(jsDate), count:0, total:0, sortKey:key };
    groups[key].count += 1;
    groups[key].total += (o.total || 0);
  });

  const rows = Object.values(groups).sort((a,b) => b.sortKey.localeCompare(a.sortKey));

  body.innerHTML = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td>${r.count}</td>
      <td>${r.total.toFixed(2)} ${CURRENCY}</td>
    </tr>
  `).join('');
}
