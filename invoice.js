const CURRENCY = "₪";
const CAFE_NAME = "كافتيريا الزيتونة";

const wrap = document.getElementById('invoiceWrap');
const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');

document.getElementById('printBtn').onclick = () => window.print();

if (!orderId) {
  wrap.innerHTML = '<div class="empty-state">رابط غير صحيح — ما في رقم طلب مرفق بالرابط.</div>';
} else {
  db.collection('orders').doc(orderId).get().then(doc => {
    if (!doc.exists) {
      wrap.innerHTML = '<div class="empty-state">ما لقينا هذا الطلب.</div>';
      return;
    }
    renderInvoice(doc.data(), doc.id);
  }).catch(err => {
    wrap.innerHTML = '<div class="empty-state">تعذّر تحميل الفاتورة، تأكد من الاتصال بالإنترنت.</div>';
    console.error(err);
  });
}

function renderInvoice(o, id){
  const dt = o.createdAt ? o.createdAt.toDate() : new Date();
  const dateStr = dt.toLocaleDateString('ar-EG');
  const timeStr = dt.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' });
  const shortId = id.slice(-6).toUpperCase();

  wrap.innerHTML = `
    <div class="invoice-card">
      <div class="invoice-head">
        <div class="invoice-cafe-name">${CAFE_NAME}</div>
        <div class="invoice-sub">فاتورة طلب</div>
      </div>

      <div class="invoice-meta">
        <div><span>رقم الطلب</span><b>#${o.number}</b></div>
        <div><span>معرّف الفاتورة</span><b>${shortId}</b></div>
        <div><span>التاريخ</span><b>${dateStr}</b></div>
        <div><span>الوقت</span><b>${timeStr}</b></div>
      </div>

      <div class="invoice-divider"></div>

      <div class="invoice-meta">
        <div><span>اسم الزبون</span><b>${o.name || '—'}</b></div>
        <div><span>رقم الجوال</span><b>${o.phone || '—'}</b></div>
        <div><span>رقم الطاولة</span><b>${o.table || '—'}</b></div>
        <div><span>حالة الطلب</span><b>${o.status || '—'}</b></div>
      </div>

      <div class="invoice-divider"></div>

      <table class="invoice-table">
        <thead>
          <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr>
        </thead>
        <tbody>
          ${o.items.map(it => `
            <tr>
              <td>${it.name}</td>
              <td>${it.qty}</td>
              <td>${it.price} ${CURRENCY}</td>
              <td>${(it.qty * it.price).toFixed(2)} ${CURRENCY}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="3">الإجمالي الكلي</td><td>${o.total} ${CURRENCY}</td></tr>
        </tfoot>
      </table>

      ${o.notes ? `<div class="order-notes" style="margin-top:14px;">📝 ${o.notes}</div>` : ''}

      <div class="invoice-footer">
        شكرًا لطلبك من ${CAFE_NAME} ☕<br>
        نتمنى لك تجربة شهية
      </div>
    </div>
  `;
}
