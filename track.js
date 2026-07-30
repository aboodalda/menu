const CURRENCY = "₪";
const STAGES = ["جديد", "قيد التحضير", "جاهز للتسليم", "تم التسليم"];
const STAGE_ICONS = ["📝", "🍳", "✅", "🎉"];

const wrap = document.getElementById('trackWrap');

const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');

if (!orderId) {
  wrap.innerHTML = '<div class="empty-state">رابط غير صحيح — تأكد إنك فتحت الرابط اللي وصلك بعد تأكيد الطلب.</div>';
} else {
  db.collection('orders').doc(orderId).onSnapshot(doc => {
    if (!doc.exists) {
      wrap.innerHTML = '<div class="empty-state">ما لقينا هذا الطلب. ممكن يكون الرابط قديم أو غير صحيح.</div>';
      return;
    }
    renderOrder(doc.data());
  }, err => {
    wrap.innerHTML = '<div class="empty-state">تعذّر تحميل حالة الطلب، تأكد من اتصال الإنترنت.</div>';
    console.error(err);
  });
}

function renderOrder(o){
  const stageIndex = Math.max(0, STAGES.indexOf(o.status));
  const time = o.createdAt ? o.createdAt.toDate().toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '';

  wrap.innerHTML = `
    <div class="track-card">
      <div class="track-head">
        <div>
          <div class="track-order-num">طلب #${o.number}</div>
          <div class="track-time">${time} · طاولة ${o.table}</div>
        </div>
        <div class="track-current-icon">${STAGE_ICONS[stageIndex]}</div>
      </div>

      <div class="track-flow">
        ${STAGES.map((label, i) => `
          <div class="track-step ${i < stageIndex ? 'done' : ''} ${i === stageIndex ? 'current' : ''}">
            <div class="track-dot">${i < stageIndex ? '✓' : i + 1}</div>
            <div class="track-label">${label}</div>
          </div>
          ${i < STAGES.length - 1 ? `<div class="track-line ${i < stageIndex ? 'done' : ''}"></div>` : ''}
        `).join('')}
      </div>

      <div class="track-msg">${trackMessage(o.status)}</div>

      <div class="order-lines" style="margin-top:18px;">
        ${o.items.map(it => `<div><span>${it.name} × ${it.qty}</span><span>${it.qty * it.price} ${CURRENCY}</span></div>`).join('')}
      </div>
      <div class="order-total">الإجمالي: ${o.total} ${CURRENCY}</div>
      ${o.notes ? `<div class="order-notes">📝 ${o.notes}</div>` : ''}
    </div>
  `;
}

function trackMessage(status){
  switch(status){
    case 'جديد': return 'وصل طلبك للمطبخ، وبيبلشوا فيه قريبًا 👨‍🍳';
    case 'قيد التحضير': return 'طلبك قيد التحضير هلق 🔥';
    case 'جاهز للتسليم': return 'طلبك جاهز! النادل جاي يوصّلك ياه 🎉';
    case 'تم التسليم': return 'اتفضّل بالهنا والشفا ☕ — شكرًا لطلبك من كافتيريا الزيتونة';
    default: return '';
  }
}
