const CURRENCY = "₪";
const STATUS_FLOW = { 'جديد':'قيد التحضير', 'قيد التحضير':'جاهز للتسليم', 'جاهز للتسليم':'تم التسليم' };
const STATUS_COLOR = { 'جديد':'var(--brass)', 'قيد التحضير':'var(--amber)', 'جاهز للتسليم':'var(--olive)', 'تم التسليم':'var(--grey)' };

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginError = document.getElementById('loginError');

document.getElementById('loginBtn').onclick = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  loginError.textContent = '';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    loginError.textContent = 'بيانات الدخول غلط، تأكد من الإيميل وكلمة السر';
    console.error(e);
  }
};
document.getElementById('logoutBtn').onclick = () => auth.signOut();

let unsubscribe = null;

auth.onAuthStateChanged(user => {
  if (user) {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    listenToOrders();
  } else {
    loginScreen.style.display = 'block';
    dashboard.style.display = 'none';
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  }
});

function listenToOrders(){
  const listEl = document.getElementById('ordersList');
  unsubscribe = db.collection('orders').orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        listEl.innerHTML = '<div class="empty-state">ما في طلبات لسه — أول طلب رح يظهر هون مباشرة</div>';
        return;
      }
      const orders = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
      renderOrders(orders);
    }, err => {
      listEl.innerHTML = '<div class="empty-state">تعذّر تحميل الطلبات، تأكد من الاتصال</div>';
      console.error(err);
    });
}

function renderOrders(orders){
  const listEl = document.getElementById('ordersList');
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
