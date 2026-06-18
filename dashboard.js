// 🎯 حل أزمة الكراش العالمي: تعريف دالة escapeHtml جوه الداشبورد لحماية كل الجداول من الانهيار
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
// ================================================
//  Firebase Configuration
// ================================================
const firebaseConfig = {
  apiKey: "AIzaSyBBM0PFOBK2tFJ2YliwEGsC1po_5HzcM7I",
  authDomain: "al-sabagh.firebaseapp.com",
  projectId: "al-sabagh",
  storageBucket: "al-sabagh.firebasestorage.app",
  messagingSenderId: "66677156721",
  appId: "1:66677156721:web:30700b98289f904c5424d0",
  measurementId: "G-SS0XVJC5XB"
};

// 🎯 السحر هنا: تشغيل الفايربيز بنسخة مخصصة للمسؤولين فقط لمنع تداخل الجلسات نهائياً!
const adminApp = firebase.initializeApp(firebaseConfig, "PharmaCareAdminInstance");
const db       = adminApp.firestore();
const auth     = adminApp.auth();

let productDocsCache = [];
let orderDocsCache = [];

// ================================================
//  مراقبة حالة تسجيل الدخول والأمان (النسخة الآمنة من الطرد التلقائي) 🔒
// ================================================
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
          document.getElementById('loginGate').classList.add('hidden');
          document.getElementById('dashboardApp').classList.remove('hidden');
          loadDashboardData();
          initModalsAndActions(); 
        } else {
          // 🎯 التعديل السحري هنا: بنقفل اللوحة بس بنمنع الـ signOut التلقائي عشان ميبوظش تبويب العميل
          document.getElementById('loginGate').classList.remove('hidden');
          document.getElementById('dashboardApp').classList.add('hidden');
          document.getElementById('loginGateError').innerHTML = `
            ❌ تنبيه: الحساب الحالي (${escapeHtml(user.email)}) لا يملك صلاحيات المسؤول.<br/>
            <button class="btn btn-sm btn-outline" style="margin-top:10px; padding:4px 12px; font-size:12px; cursor:pointer;" onclick="auth.signOut().then(() => window.location.reload())">🚪 خروج للحساب الحالي فقط</button>
          `;
        }
      } catch (e) {
        document.getElementById('loginGate').classList.remove('hidden');
        document.getElementById('dashboardApp').classList.add('hidden');
        document.getElementById('loginGateError').textContent = "❌ حدث خطأ أثناء التحقق من الصلاحيات.";
      }
    } else {
      document.getElementById('loginGate').classList.remove('hidden');
      document.getElementById('dashboardApp').classList.add('hidden');
    }
  });
});

// ================================================
//  تفعيل زرار الدخول للمسؤولين
// ================================================
document.getElementById('adminLoginBtn').addEventListener('click', async () => {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('loginGateError');
  errorEl.textContent = "";

  if (!email || !password) {
    errorEl.textContent = "⚠️ برجاء إدخال البريد الإلكتروني وكلمة المرور";
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    errorEl.textContent = "❌ بيانات الدخول غير صحيحة";
  }
});

// زرار الخروج
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => {
    window.location.reload();
  });
});

// ================================================
//  Navigation (التنقل بين الصفحات)
// ================================================
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');

function switchPage(pageId) {
  pages.forEach(p => p.classList.add('hidden'));
  navItems.forEach(item => item.classList.remove('active'));

  const activePage = document.getElementById(`page-${pageId}`);
  const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);

  if (activePage) activePage.classList.remove('hidden');
  if (activeNav) activeNav.classList.add('active');
  
  const titles = {
    overview: 'الرئيسية',
    products: 'المنتجات',
    orders: 'الطلبات',
    prescriptions: 'طلبات الروشتة',
    messages: 'الرسائل',
    newsletter: 'المشتركين',
    offers: 'العروض' 
  };
  if(titles[pageId]) pageTitle.textContent = titles[pageId];
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    switchPage(item.dataset.page);
  });
});

// ================================================
//  البحث والفلترة 🔍
// ================================================
const productSearch = document.getElementById('productSearch');
const productCatFilter = document.getElementById('productCatFilter');
const orderSearch = document.getElementById('orderSearch');
const orderStatusFilter = document.getElementById('orderStatusFilter');

if(productSearch) productSearch.addEventListener('keyup', filterProductsTable);
if(productCatFilter) productCatFilter.addEventListener('change', filterProductsTable);
if(orderSearch) orderSearch.addEventListener('keyup', filterOrdersTable);
if(orderStatusFilter) orderStatusFilter.addEventListener('change', filterOrdersTable);

function filterProductsTable() {
  const query = (productSearch?.value || '').toLowerCase();
  const catFilter = productCatFilter ? productCatFilter.value : 'all';
  let filtered = productDocsCache;
  if(catFilter !== 'all') filtered = filtered.filter(d => d.data().category === catFilter);
  if(query) filtered = filtered.filter(d => String(d.data().name || '').toLowerCase().includes(query));
  renderProductsTable(filtered);
}

function filterOrdersTable() {
  const query = (orderSearch?.value || '').toLowerCase();
  const statusFilter = orderStatusFilter ? orderStatusFilter.value : 'all';
  let filtered = orderDocsCache;
  
  // تطهير وتوحيد الفلتر العلوي ليتطابق مع مصفوفة الحالات الجديدة
  if(statusFilter !== 'all') {
    filtered = filtered.filter(d => {
      const s = d.data().status || 'pending';
      if (statusFilter === 'confirmed') {
        return ['confirmed', 'processing', 'shipped', 'delivered'].includes(s);
      }
      if (statusFilter === 'cancelled') {
        return s === 'cancelled';
      }
      return s === 'pending';
    });
  }
  
  if(query) {
    filtered = filtered.filter(d => {
      const userEmail = d.data().userEmail || '';
      const userName = d.data().shippingInfo?.name || '';
      return userEmail.toLowerCase().includes(query) || userName.toLowerCase().includes(query);
    });
  }
  renderOrdersTable(filtered);
}

// ================================================
//  Live data loading
// ================================================
function loadDashboardData() {
  // 1. الأعداد الإجمالية للمنتجات
  db.collection("products").onSnapshot(snap => {
    productDocsCache = snap.docs;
    document.getElementById('stat-products').textContent = snap.size;
    filterProductsTable();
  });

  // 2. الطلبات (نسخة مطورة ومحمية من الثقل والتعليق) ⚡
  db.collection("orders").onSnapshot(snap => {
    orderDocsCache = snap.docs;
    if(document.getElementById('stat-orders')) document.getElementById('stat-orders').textContent = snap.size;
    
    const pendingCount = snap.docs.filter(doc => (doc.data().status || 'pending') === 'pending').length;
    if(document.getElementById('stat-pending')) document.getElementById('stat-pending').textContent = pendingCount;
    if(document.getElementById('pendingBadge')) document.getElementById('pendingBadge').textContent = pendingCount;
    
    // حساب إجمالي الإيرادات
    let revenue = 0; 
    snap.docs.forEach(doc => { 
      if(['confirmed', 'processing', 'shipped', 'delivered'].includes(doc.data().status)) {
        revenue += (doc.data().total || 0); 
      }
    });
    if(document.getElementById('stat-revenue')) document.getElementById('stat-revenue').textContent = revenue + " ج.م";

    // 🎯 الحماية السحرية: لو التغيير محلي وناتج عن ضغطتك على الـ Dropdown حالاً،
    // اخرج فوراً وما تعيدش بناء الجدول بالكامل عشان تمنع تجميد الشاشة والـ Lag!
    if (snap.metadata.hasPendingWrites) {
      return; 
    }

    filterOrdersTable();
  });
  // 3. طلبات الروشتة
  db.collection("prescriptionOrders").onSnapshot(snap => {
    document.getElementById('stat-prescriptions').textContent = snap.size;
    renderPrescriptionsTable(snap.docs);
  });

  // 4. رسائل التواصل
  db.collection("contactMessages").onSnapshot(snap => {
    document.getElementById('stat-messages').textContent = snap.size;
    renderMessagesGrid(snap.docs);
  });
  // 5. المشتركين في النيوزليتر
  db.collection("newsletter").onSnapshot(snap => {
    document.getElementById('subCount').textContent = snap.size + " مشترك";
    renderNewsletterTable(snap.docs);
  });
  
 // جلب وتعبئة بيانات العرض الحالية تلقائياً (نسخة مطورة)
  db.collection("offers").doc("flashOffer").onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      if(document.getElementById('offerLabel')) document.getElementById('offerLabel').value = data.label || '';
      if(document.getElementById('offerTitle')) document.getElementById('offerTitle').value = data.title || '';
      if(document.getElementById('offerCode')) document.getElementById('offerCode').value = data.code || '';
      if(document.getElementById('offerHours')) document.getElementById('offerHours').value = data.hours || 6;
    } else {
      // لو العرض ممسوح من السيرفر، فرّغ الخانات فوراً في الداشبورد
      if(document.getElementById('offerLabel')) document.getElementById('offerLabel').value = '';
      if(document.getElementById('offerTitle')) document.getElementById('offerTitle').value = '';
      if(document.getElementById('offerCode')) document.getElementById('offerCode').value = '';
      if(document.getElementById('offerHours')) document.getElementById('offerHours').value = '';
    }
  });
}

// ================================================
//  دوال الـ Rendering لعرض البيانات جوه جداول الـ HTML
// ================================================
function renderOrdersTable(docs) {
  // 🎯 التعديل 1: حفظ مستندات الطلبات في كاش عالمي فوراً في أول الدالة عشان المودال يقرأ منها
  window.orderDocsCache = docs;

  const recentBody = document.getElementById('recentOrdersBody');
  const mainBody = document.getElementById('ordersTableBody');
  
  let recentHtml = '';
  let mainHtml = '';

  if (!docs || docs.length === 0) {
    const emptyRow = `<tr><td colspan="7" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>`;
    if(recentBody) recentBody.innerHTML = emptyRow;
    if(mainBody) mainBody.innerHTML = emptyRow;
    return;
  }

  // 1️⃣ حل تداخل السطور: أخذ نسخة مأمنة من المصفوفة لتفادي تلف داتا السيرفر
  const sortedDocs = [...docs].sort((a,b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));

  sortedDocs.forEach((doc, index) => {
    const data = doc.data();
    const id = doc.id.substring(0, 6).toUpperCase();
    const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '—';
    
    // 2️⃣ حل ربط البادج بالـ Dropdown: توحيد وتطهير الحالات تماماً برمجياً
    const rawStatus = data.status || 'pending';
    let currentStatus = 'pending';
    let badgeClass = 'status-pending'; // اللون الأصفر لغير المؤكد

    if (['confirmed', 'processing', 'shipped', 'delivered'].includes(rawStatus)) {
      currentStatus = 'confirmed';
      badgeClass = 'status-delivered'; // استغلال كلاس التوصيل الأخضر الشيك ليلون كلمة "مؤكد" دايماً
    } else if (rawStatus === 'cancelled') {
      currentStatus = 'cancelled';
      badgeClass = 'status-cancelled'; // اللون الأحمر للملغي
    }

    const rowHtml = `
      <tr>
        <td>#${id}</td>
        <td style="cursor: pointer; color: var(--teal); font-weight: 600; text-decoration: underline;" 
            onclick="viewCustomerDetails('${data.userId}', '${doc.id}')" 
            title="اضغط لعرض ملف العميل والعنوان المحدد لهذا الطلب">
            ${data.shippingInfo ? `${data.shippingInfo.name} (${data.shippingInfo.phone})` : data.userEmail || 'عميل مجهول'}
        </td>
        <td>${data.items ? data.items.map(i => `${i.name} (${i.qty})`).join('، ') : '—'}</td>
        <td style="font-weight:bold; color:var(--teal);">${data.total || 0} ج.م</td>
        
        <td><span class="status-badge ${badgeClass}">${getStatusLabel(rawStatus)}</span></td>
        
        <td>${date}</td>
        <td>
          <select class="status-select" onchange="updateOrderStatus('${doc.id}', this.value)">
            <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>غير مؤكد</option>
            <option value="confirmed" ${currentStatus === 'confirmed' ? 'selected' : ''}>مؤكد</option>
            <option value="cancelled" ${currentStatus === 'cancelled' ? 'selected' : ''}>ملغي</option>
          </select>
        </td>
      </tr>`;
    
    mainHtml += rowHtml;
    if(index < 5) recentHtml += rowHtml;
  });

  if(recentBody) recentBody.innerHTML = recentHtml;
  if(mainBody) mainBody.innerHTML = mainHtml;
}

// دالة جلب المسميات الصحيحة للحالات
function getStatusLabel(status) {
  const map = { 
    pending: 'غير مؤكد', 
    confirmed: 'مؤكد', 
    processing: 'مؤكد', 
    shipped: 'مؤكد',    
    delivered: 'مؤكد',  
    cancelled: 'ملغي' 
  }; 
  return map[status] || 'غير مؤكد';
}

// دالة التحديث الفوري اللحظي بالسيرفر والـ DOM معاً 🚀
window.updateOrderStatus = function(id, newStatus) {
  // 1️⃣ الـ Optimistic UI: تحديث شكل السطر والبادج في الـ DOM فوراً وبدون انتظار
  const selectEl = document.querySelector(`select[onchange*="${id}"]`);
  if (selectEl) {
    const row = selectEl.closest('tr');
    const badge = row?.querySelector('.status-badge');
    if (badge) {
      if (newStatus === 'confirmed') {
        badge.textContent = 'مؤكد';
        badge.className = 'status-badge status-delivered'; // كلاس الأخضر
      } else if (newStatus === 'cancelled') {
        badge.textContent = 'ملغي';
        badge.className = 'status-badge status-cancelled'; // كلاس الأحمر
      } else {
        badge.textContent = 'غير مؤكد';
        badge.className = 'status-badge status-pending';   // كلاس الأصفر
      }
    }
  }

  // 2️⃣ تحديث قاعدة البيانات في الخلفية بهدوء
  db.collection("orders").doc(id).update({ status: newStatus })
    .then(() => {
      showToast("✅ تم تحديث حالة الطلب بنجاح");
    })
    .catch(() => {
      showToast("❌ فشل تحديث حالة الطلب", "error");
    });
};

// [تعديل 1 المطور]: دالة رندرة جدول المنتجات الآمنة والمقاومة للكراش 📦
// 1️⃣ دالة الفلترة والبحث المؤمنة والمضادة للاختفاء العشوائي 🔍
function filterProductsTable() {
  const query = (productSearch?.value || '').toLowerCase().trim();
  let catFilter = (productCatFilter?.value || 'all').trim();

  let filtered = productDocsCache;

  // 🎯 الحماية الذكية: لو الفلتر قيمته "all" أو فارغ "" أو مكتوب "كل الفئات"، يعرض كل المنتجات بدون حظرها
  if (catFilter !== 'all' && catFilter !== '' && catFilter !== 'كل الفئات') {
    filtered = filtered.filter(d => {
      const productCat = (d.data().category || '').toLowerCase().trim();
      return productCat === catFilter.toLowerCase();
    });
  }

  if (query) {
    filtered = filtered.filter(d => String(d.data().name || '').toLowerCase().includes(query));
  }

  renderProductsTable(filtered);
}

// 2️⃣ دالة رندرة جدول المنتجات الآمنة والمقاومة للكراش 📦
function renderProductsTable(docs) {
  const body = document.getElementById('productsTableBody');
  let html = '';
  
  if (!docs || docs.length === 0) {
    if(body) body.innerHTML = `<tr><td colspan="7" style="text-align:center;">📦 لا توجد منتجات معروضة تلتزم بالفلاتر الحالية</td></tr>`;
    return;
  }

  docs.forEach(doc => {
    const p = doc.data();
    
    const isImage = p.emoji && (p.emoji.startsWith('http://') || p.emoji.startsWith('https://'));
    const displayMedia = isImage 
      ? `<img src="${p.emoji}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px;" onerror="this.src='💊'"/>` 
      : p.emoji || '💊';

    html += `
      <tr>
        <td style="text-align: center; vertical-align: middle;">${displayMedia}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${p.category || '—'}</td>
        <td style="color:var(--teal); font-weight:700;">${p.price} ج.م</td>
        <td style="text-decoration:line-through; color:var(--muted);">${p.oldPrice || '—'} ج.م</td>
        <td><span style="color:var(--red); font-weight:600;">${p.badge || '—'}</span></td>
        <td>
          <div class="action-btns">
            <button class="act-btn edit" onclick="openEditProductModal('${doc.id}')">✏️ تعديل</button>
            <button class="act-btn del" onclick="deleteProduct('${doc.id}')">🗑️ حذف</button>
          </div>
        </td>
      </tr>`;
  });
  
  if(body) body.innerHTML = html;
}

// 3️⃣ دالة فتح الـ Modal وسحب البيانات المأمنة من كاش مصفوفة الداشبورد الذكية 🧠
window.openEditProductModal = function(docId) {
  // البحث عن المنتج داخل مصفوفة الكاش المحفوظة في الداشبورد تلقائياً لمنع أي أخطاء قراءة بسبب الرموز
  const doc = productDocsCache.find(d => d.id === docId);
  if (!doc) {
    showToast("❌ خطأ: لم يتم العثور على بيانات هذا المنتج في الذاكرة", "error");
    return;
  }
  
  const productData = doc.data();

  document.getElementById('productModalTitle').textContent = "تعديل بيانات المنتج";
  document.getElementById('saveProductBtn').textContent = "💾 تحديث المنتج";
  document.getElementById('editProductId').value = docId; // تعبئة حقل الـ ID المخفي

  // تعبئة البيانات الشخصية الصافية والمحمية داخل خانات الفورم
  document.getElementById('pName').value = productData.name || '';
  document.getElementById('pCategory').value = productData.category || '';
  document.getElementById('pEmoji').value = productData.emoji || '';
  document.getElementById('pPrice').value = productData.price || '';
  document.getElementById('pOldPrice').value = productData.oldPrice || '';
  document.getElementById('pBadge').value = productData.badge || '';
  document.getElementById('pDesc').value = productData.desc || '';

  document.getElementById('productModalOverlay').classList.remove('hidden');
};
// حذف منتج
window.deleteProduct = function(id) {
  if(confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) {
    db.collection("products").doc(id).delete()
      .then(() => showToast("🗑️ تم حذف المنتج بنجاح"))
      .catch(() => showToast("❌ فشل الحذف", "error"));
  }
};

// رندر طلبات الروشتة
function renderPrescriptionsTable(docs) {
  const body = document.getElementById('prescriptionsBody');
  let html = '';
  docs.forEach(doc => {
    const d = doc.data();
    const date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '—';
    html += `
      <tr>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td>${escapeHtml(d.phone)}</td>
        <td>${escapeHtml(d.address)}</td>
        <td>${d.notes || 'لا يوجد ملاحظات'}</td>
        <td><span class="status-badge status-pending">طلب سريع</span></td>
        <td>${date}</td>
        <td>
          <button class="act-btn del" onclick="deleteDocument('prescriptionOrders', '${doc.id}')">حذف</button>
        </td>
      </tr>`;
  });
  if(body) body.innerHTML = html || `<tr><td colspan="7" style="text-align:center;">📋 لا توجد طلبات روشتة حالياً</td></tr>`;
}

// رندر رسائل التواصل
function renderMessagesGrid(docs) {
  const grid = document.getElementById('messagesGrid');
  let html = '';
  docs.forEach(doc => {
    const m = doc.data();
    html += `
      <div class="message-card">
        <div class="msg-header">
          <span class="msg-name">👤 ${m.name}</span>
        </div>
        <div class="msg-contact">
          <span>📧 ${m.email || 'لا يوجد'}</span>
          <span>📞 ${m.phone || 'لا يوجد'}</span>
        </div>
        <div class="msg-subject">الموضوع: ${m.subject || 'بدون عنوان'}</div>
        <p class="msg-body">${escapeHtml(m.message)}</p>
        <button class="act-btn del msg-del" onclick="deleteDocument('contactMessages', '${doc.id}')">🗑️ حذف</button>
      </div>`;
  });
  if(grid) grid.innerHTML = html || `<div class="loading-cell">💬 لا توجد رسائل تواصل واردة حالياً</div>`;
}

// 📧 دالة رندرة جدول المشتركين (النسخة الفائقة ومضادة للأعطال مع كاشف ذكي)
function renderNewsletterTable(docs) {
  // البحث عن عنصر الجدول بكافة أسمائه المحتملة لتأمين العرض دايماً
  const body = document.getElementById('newsletterBody') || document.getElementById('newsletterTableBody');
  if (!body) return;

  try {
    let html = '';
    
    // التحقق الآمن من وجود المصفوفة ونوعها قبل بدء اللوب
    if (!docs || !Array.isArray(docs) || docs.length === 0) {
      html = '<tr><td colspan="3" style="text-align:center;">📭 لا توجد اشتراكات حالياً</td></tr>';
    } else {
      docs.forEach((doc, index) => {
        try {
          // حماية مزدوجة: فحص هل المستند سليم ويحتوي على دالة data
          if (!doc || typeof doc.data !== 'function') return;
          
          const data = doc.data() || {};
          const email = data.email || '—';

          // 📍 قراءة ومعالجة التاريخ محلياً وبأمان فائق ومستقل
          let date = '—';
          const timestamp = data.createdAt || data.subscribedAt;
          
          if (timestamp && timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000).toLocaleDateString('ar-EG');
          } else if (timestamp) {
            date = String(timestamp);
          }

          // فحص أمان دالة الـ escapeHtml قبل تشغيلها لمنع انهيار السطر
          const cleanEmail = typeof escapeHtml === 'function' ? escapeHtml(email) : email;

          // بناء السطر
          html += `<tr>
            <td>${index + 1}</td>
            <td><strong>${cleanEmail}</strong></td>
            <td>${date}</td>
          </tr>`;
          
        } catch (innerErr) {
          // لو سطر واحد فيه مشكلة، اطبعه في الـ Console وتخطاه بأمان لتكملة باقي الجدول
          console.error("خطأ عابر في قراءة سطر مشترك:", innerErr);
        }
      });
    }

    // حقن الداتا بالكامل جوه الـ HTML
    body.innerHTML = html || '<tr><td colspan="3" style="text-align:center;">📭 لا توجد اشتراكات حالياً</td></tr>';

  } catch (error) {
    console.error("Newsletter Rendering Error:", error);
    // 🎯 كاشف الأعطال: هيطبع لك الكود المسبب للمشكلة حياً على الشاشة بدل الرسالة المبهمة!
    body.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--red); font-weight:600;">❌ عطل نظام: ${escapeHtml(error.message || error)}</td></tr>`;
  }
}

window.deleteDocument = function(collectionName, id) {
  if(confirm("هل أنت متأكد من الحذف؟")) {
    db.collection(collectionName).doc(id).delete()
      .then(() => showToast("✅ تم الحذف بنجاح"))
      .catch(() => showToast("❌ فشل عملية الحذف", "error"));
  }
};

// ================================================
//  تفعيل الأزرار والـ Modals (إضافة وتعديل منتج) ⚙️
// ================================================
function initModalsAndActions() {
  const productModalOverlay = document.getElementById('productModalOverlay');
  const addProductBtn = document.getElementById('addProductBtn');
  const closeProductModal = document.getElementById('closeProductModal');
  const cancelProductModal = document.getElementById('cancelProductModal');
  const saveProductBtn = document.getElementById('saveProductBtn');

  // فتح الـ Modal عند الضغط على زرار + إضافة منتج (تصفير للحالة)
  if(addProductBtn) {
    addProductBtn.onclick = () => {
      document.getElementById('editProductId').value = ''; // تصفير الـ ID المخفي
      document.getElementById('productModalTitle').textContent = "إضافة منتج جديد";
      document.getElementById('saveProductBtn').textContent = "💾 حفظ المنتج";
      
      ['pName', 'pCategory', 'pEmoji', 'pPrice', 'pOldPrice', 'pBadge', 'pDesc'].forEach(id => {
        document.getElementById(id).value = '';
      });
      productModalOverlay.classList.remove('hidden');
    };
  }

  const closeModal = () => productModalOverlay.classList.add('hidden');
  if(closeProductModal) closeProductModal.onclick = closeModal;
  if(cancelProductModal) cancelProductModal.onclick = closeModal;

  // [تعديل 3]: فحص هل العملية Add أم Update عند الضغط على حفظ
  if(saveProductBtn) {
    saveProductBtn.onclick = async () => {
      const editProductId = document.getElementById('editProductId').value; // جلب الـ ID المخفي
      const name = document.getElementById('pName').value.trim();
      const category = document.getElementById('pCategory').value;
      const emoji = document.getElementById('pEmoji').value.trim() || '💊';
      const price = parseFloat(document.getElementById('pPrice').value);
      const oldPrice = parseFloat(document.getElementById('pOldPrice').value) || null;
      const badge = document.getElementById('pBadge').value.trim() || null;
      const desc = document.getElementById('pDesc').value.trim();
      const errorEl = document.getElementById('productFormError');

      if (!name || !category || isNaN(price)) {
        errorEl.textContent = "⚠️ برجاء ملء الحقول الإلزامية (*) المتمثلة في اسم المنتج، الفئة والسعر الحالي";
        return;
      }

      try {
        saveProductBtn.disabled = true;
        saveProductBtn.textContent = "جاري الحفظ...";
        
        const productData = {
          name, category, emoji, price, oldPrice, badge, desc,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editProductId) {
          // تحديث مستند المنتج الحالي بالـ ID الخاص به
          await db.collection("products").doc(editProductId).update(productData);
          showToast("📦 تم تحديث بيانات المنتج بنجاح!");
        } else {
          // إضافة منتج جديد تماماً
          productData.id = "p_" + Date.now();
          productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection("products").add(productData);
          showToast("📦 تم إضافة المنتج الجديد بنجاح!");
        }

        closeModal();
        
        // إعادة تهيئة
        document.getElementById('editProductId').value = '';
        ['pName', 'pCategory', 'pEmoji', 'pPrice', 'pOldPrice', 'pBadge', 'pDesc'].forEach(id => {
          document.getElementById(id).value = '';
        });
      } catch (e) {
        errorEl.textContent = "❌ حدث خطأ أثناء الحفظ، حاول مجدداً.";
      } finally {
        saveProductBtn.disabled = false;
        saveProductBtn.textContent = editProductId ? "💾 تحديث المنتج" : "💾 حفظ المنتج";
      }
    };
  }
  // زرار حفظ وتحديث بنر العروض الحية
  const saveOfferBtn = document.getElementById('saveOfferBtn');
  if (saveOfferBtn) {
    saveOfferBtn.onclick = async () => {
      const label = document.getElementById('offerLabel').value.trim();
      const title = document.getElementById('offerTitle').value.trim();
      const code = document.getElementById('offerCode').value.trim();
      const hours = parseInt(document.getElementById('offerHours').value) || 6;
      const errorEl = document.getElementById('offerFormError');

      if (!title) {
        errorEl.textContent = "⚠️ العنوان الرئيسي للعرض مطلوب!";
        return;
      }

      try {
        saveOfferBtn.disabled = true;
        saveOfferBtn.textContent = "جاري التحديث...";
        
        await db.collection("offers").doc("flashOffer").set({
          label, title, code, hours,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          endAt: Date.now() + (hours * 3600000) // حساب وقت نهاية التايمر من لحظة الحفظ
        });

        showToast("🔥 تم تحديث بنر العروض الحية وتشغيل التايمر بنجاح!");
        if(errorEl) errorEl.textContent = "";
      } catch (e) {
        errorEl.textContent = "❌ حدث خطأ أثناء تحديث العرض.";
      } finally {
        saveOfferBtn.disabled = false;
        saveOfferBtn.textContent = "💾 حفظ وتحديث العرض فوراً";
      }
    };
  }
// ================================================
  //  فيتشر الرفع الجماعي الذكية والمطورة من ملف إكسيل 📥
  // ================================================
  const excelInput = document.getElementById('excelFileInput');
  if (excelInput) {
    excelInput.addEventListener('change', function(e) {
      const file = e.target.files[0]; 
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(evt) {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // 🎯 التعديل العبقري: استخدام { header: 1 } لتحويل الشيت لمصفوفة صفوف وأعمدة نقية (Matrix Mode)
          // التعديل ده بيتخطى تماماً أي مشاكل أو عيوب في تشفير عناوين السيستم الإداري
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (!rows || rows.length <= 1) {
            showToast("⚠️ لم يتم العثور على أي بيانات داخل ملف الإكسيل!", "error");
            return;
          }

          showToast("⏳ جاري قراءة ورفع المنتجات إلى السيرفر، برجاء الانتظار...");
          let successCount = 0;

          // 1️⃣ قراءة السطر الأول (العناوين) وتطهيرها لتحديد أماكن الأعمدة ديناميكياً لو الترتيب اختلف
          const headers = rows[0].map(h => String(h || '').toLowerCase().replace(/[^\w\u0600-\u06FF]/g, '').trim());
          
          // تعيين قيم افتراضية بناءً على شيت الصيدلية الحالي (A=0, B=1, C=2, D=3)
          let nameIdx = 0;
          let priceIdx = 1;
          let imageIdx = 2;
          let catIdx = 3;
          let oldPriceIdx = -1;
          let badgeIdx = -1;
          let descIdx = -1;

          // فحص ديناميكي سريع للتأكيد بنسبة 100% من مكان كل عمود
          headers.forEach((header, idx) => {
            if (header.includes('name') || header.includes('الاسم')) nameIdx = idx;
            if (header.includes('price') || header.includes('السعر')) priceIdx = idx;
            if (header.includes('image') || header.includes('url') || header.includes('الصورة') || header.includes('emoji')) imageIdx = idx;
            if (header.includes('category') || header.includes('الفئة')) catIdx = idx;
            if (header.includes('oldprice') || header.includes('القديم')) oldPriceIdx = idx;
            if (header.includes('badge') || header.includes('الشارة')) badgeIdx = idx;
            if (header.includes('desc') || header.includes('الوصف')) descIdx = idx;
          });

          // 2️⃣ بدء اللوب من السطر الثاني (Index 1) لتخطي صف العناوين والرفع للـ Firebase
          for (let i = 1; i < rows.length; i++) {
            const currentRow = rows[i];
            // تخطي السطور الفاضية تماماً في الشيت
            if (!currentRow || currentRow.length === 0) continue;

            const name     = currentRow[nameIdx];
            const priceRaw = currentRow[priceIdx];
            let category   = currentRow[catIdx];
            const emoji    = currentRow[imageIdx] || '💊';
            const oldPrice = oldPriceIdx !== -1 ? parseFloat(currentRow[oldPriceIdx]) : null;
            const badge    = badgeIdx !== -1 ? currentRow[badgeIdx] : null;
            const desc     = descIdx !== -1 ? currentRow[descIdx] : '';

            const price = parseFloat(priceRaw);

            // توحيد الفئة لحروف صغيرة لتطابق عدادات الداشبورد وموقع الزبائن
            if (category) {
              category = String(category).trim().toLowerCase();
            }

            // الفحص والرفع الآمن والمنسق للفايرستور
            if (name && category && !isNaN(price)) {
              await db.collection("products").add({
                id: "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                name: String(name).trim(),
                category: category,
                emoji: String(emoji).trim(),
                price: price,
                oldPrice: isNaN(oldPrice) ? null : oldPrice,
                badge: badge ? String(badge).trim() : null,
                desc: desc ? String(desc).trim() : '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              successCount++;
            }
          }

          showToast(`🎉 بنجاح! تم قراءة ورفع ${successCount} منتج من شيت الإكسيل.`);
          excelInput.value = ''; // تصفير الحقل ليعمل مجدداً بمرونة
        } catch (err) {
          console.error("Excel Error:", err);
          showToast("❌ حدث خطأ أثناء معالجة أو رفع ملف الإكسيل", "error");
        }
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  // تفعيل زرار حذف العرض الحالي نهائياً من الموقع
  const deleteOfferBtn = document.getElementById('deleteOfferBtn');
  if (deleteOfferBtn) {
    deleteOfferBtn.onclick = async () => {
      if (confirm("⚠️ هل أنت متأكد من حذف العرض الحالي وإزالته نهائياً من الموقع؟")) {
        try {
          deleteOfferBtn.disabled = true;
          // حذف المستند تماماً من الفايرستور
          await db.collection("offers").doc("flashOffer").delete();
          showToast("🗑️ تم حذف العرض وإزالته من واجهة الموقع بنجاح!");
        } catch (e) {
          showToast("❌ حدث خطأ أثناء محاولة حذف العرض", "error");
        } finally {
          deleteOfferBtn.disabled = false;
        }
      }
    };
  }

  // تفعيل زرار تفريغ الحقول لعمل عرض جديد
  const clearOfferFieldsBtn = document.getElementById('clearOfferFieldsBtn');
  if (clearOfferFieldsBtn) {
    clearOfferFieldsBtn.onclick = () => {
      ['offerLabel', 'offerTitle', 'offerCode'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = '';
      });
      if(document.getElementById('offerHours')) document.getElementById('offerHours').value = 6;
      if(document.getElementById('offerFormError')) document.getElementById('offerFormError').textContent = '';
      showToast("✨ تم تفريغ الحقول بنجاح، يمكنك الآن كتابة العرض الجديد!");
    };
  }
  // تفعيل إغلاق شاشة بيانات العميل الجديدة
  const userDetailOverlay = document.getElementById('userDetailOverlay');
  const closeUserDetail = document.getElementById('closeUserDetail');
  const closeUserDetailBtn = document.getElementById('closeUserDetailBtn');
  
  const closeUserModal = () => { if(userDetailOverlay) userDetailOverlay.classList.add('hidden'); };
  
  if (closeUserDetail) closeUserDetail.onclick = closeUserModal;
  if (closeUserDetailBtn) closeUserDetailBtn.onclick = closeUserModal;
  if (userDetailOverlay) {
    userDetailOverlay.onclick = (e) => { if (e.target === userDetailOverlay) closeUserModal(); };
  }
}

// ================================================
//  تصدير الرسائل البريدية كـ CSV
// ================================================
// 🎯 تفعيل زرار تصدير المشتركين كـ CSV بشكل آمن ومقاوم للأعطال والرموز التالفة 📊
const exportEmailsBtn = document.getElementById('exportEmailsBtn');
if(exportEmailsBtn) {
  exportEmailsBtn.addEventListener('click', async () => {
    try {
      showToast("⏳ جاري سحب وتجهيز قائمة المشتركين للتصدير...");
      const snap = await db.collection("newsletter").get();
      
      if (snap.empty) {
        showToast("⚠️ لا توجد أي بيانات لتصديرها حالياً!", "error");
        return;
      }

      // 💡 السحر هنا: إضافة \ufeff في أول الملف عشان Excel يفتح ملف الـ CSV ويقرأ العربي والتواريخ بشكل سليم
      let csv = '\ufeffالبريد الإلكتروني,تاريخ الاشتراك\n';
      
      snap.docs.forEach(doc => {
        try {
          if (!doc || typeof doc.data !== 'function') return;
          const data = doc.data() || {};
          const email = data.email || '—';
          
          // معالجة التاريخ بأمان فائق مطابقة للجدول
          let date = '—';
          const timestamp = data.createdAt || data.subscribedAt;
          if (timestamp && timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000).toLocaleDateString('ar-EG');
          } else if (timestamp) {
            date = String(timestamp);
          }
          
          // تنظيف الإيميل وحقنه في السطر بأمان
          csv += `"${String(email).replace(/"/g, '""')}","${date}"\n`;
        } catch (innerErr) {
          console.error("خطأ عابر في تصدير سطر مشترك:", innerErr);
        }
      });
      
      // إنشاء وتحميل الملف فوراً للكمبيوتر أو الموبايل
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      showToast("✅ تم تصدير كشف المشتركين بنجاح!");
    } catch(e) {
      console.error("Export Error:", e);
      showToast("❌ حدث خطأ أثناء محاولة تصدير البيانات", "error");
    }
  });
}

// الـ Toast Notification
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  if(t) {
    t.textContent = msg;
    t.className = "toast " + type + " show";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3200);
  }
}

// دالة جلب وفتح تفاصيل العميل بالكامل ومجهزة بالتحويل للواتساب 👤💬
window.viewCustomerDetails = async function(userId) {
  if (!userId || userId === "undefined" || userId === "null") { 
    showToast("⚠️ هذا الطلب تم بواسطة عميل زائر (غير مسجل بحساب)", "error"); 
    return; 
  }
  
  const contentEl = document.getElementById('userDetailContent'); 
  const overlay = document.getElementById('userDetailOverlay');
  if (!contentEl || !overlay) return;
  
  contentEl.innerHTML = `🔄 جاري سحب ملف العميل من قاعدة البيانات...`; 
  overlay.classList.remove('hidden');
  
  try {
    const userDoc = await db.collection("users").doc(userId).get(); 
    if (!userDoc.exists) {
      contentEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--red);">❌ البيانات غير موجودة بالسيرفر.</div>`;
      return;
    }
    
    const u = userDoc.data();
    const joinDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : 'غير محدد';
    
    // دالة داخلية لتنظيف رقم الموبايل وتحويله للصيغة الدولية الصحيحة للواتساب
    const formatWhatsAppNumber = (phone) => {
      if (!phone) return '';
      const trimmed = phone.trim();
      return trimmed.startsWith('0') ? '20' + trimmed.slice(1) : trimmed;
    };

    // تجهيز رابط واتساب الهاتف الأساسي
    const mainWaPhone = formatWhatsAppNumber(u.phone);
    const mainWaMsg = encodeURIComponent(`أهلاً بك يا أستاذ ${u.name || 'عزيزنا العميل'}، معاك صيدلية الصباغ لتاكيد الأوردر الخاص بك من الموقع الإلكتروني `);

    // رندرة العناوين المحفوظة مع تزويدها بروابط واتساب للمستلمين أيضاً
    let addressesHtml = '<p style="color:var(--muted); font-size:13px;">• لا توجد عناوين مسجلة في ملفه الشخصي</p>';
    if (u.addresses && u.addresses.length > 0) {
      addressesHtml = '<div style="display:flex; flex-direction:column; gap:8px; max-height:150px; overflow-y:auto; padding-left:5px;">';
      u.addresses.forEach((addr, i) => {
        const addrWaPhone = formatWhatsAppNumber(addr.phone);
        const addrWaMsg = encodeURIComponent(`أهلاً يا ${addr.name}، معاك صيدلية الصباغ بخصوص طلبك المطلوب شحنه إلى: ${addr.addressDetail}`);
        
        addressesHtml += `
          <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border-right: 3px solid var(--teal); font-size:13px;">
            📍 <strong>العنوان ${i+1}:</strong> ${addr.addressDetail}<br/>
            <span style="color:var(--muted); font-size:12px;">👤 المستلم: ${addr.name} | 📞 هاتف: <a href="https://wa.me/${addrWaPhone}?text=${addrWaMsg}" target="_blank" style="color:var(--teal); text-decoration:underline; font-weight:bold;" title="اضغط لفتح شات واتساب للمستلم">${addr.phone} 💬</a></span>
          </div>`;
      });
      addressesHtml += '</div>';
    }

    // كتابة البيانات الكاملة وتلوين رابط الواتساب الجديد باللون الأخضر المميز
    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; text-align: right; line-height: 1.6;">
        <div style="background: rgba(0, 128, 128, 0.1); padding: 10px; border-radius: 6px; text-align:center; font-weight:bold; font-size:16px; color:var(--teal);">
          👤 ${u.name || 'بدون اسم'}
        </div>
        <div><strong>📧 البريد الإلكتروني:</strong> <a href="mailto:${u.email}" style="color:var(--teal);">${u.email || '—'}</a></div>
        
        <div>
          <strong>📞 الهاتف الأساسي:</strong> 
          <a href="https://wa.me/${mainWaPhone}?text=${mainWaMsg}" target="_blank" style="color: #25D366; font-weight: bold; text-decoration: underline;" title="اضغط لفتح شات واتساب وتأكيد الطلب فوراً">
            ${u.phone || '—'} 🟢 (تأكيد الأوردر واتساب)
          </a>
        </div>
        
        <div><strong>📅 تاريخ الانضمام للموقع:</strong> ${joinDate}</div>
        <div><strong>🛡️ نوع الحساب:</strong> ${u.role === 'admin' ? 'مسؤول (Admin)' : 'عميل (Customer)'}</div>
        
        <hr style="border: 0; border-top: 1px solid var(--border); margin: 5px 0;" />
        
        <h4 style="color: var(--teal); margin-bottom: 4px; font-size:14px;">🏠 جميع العناوين المحفوظة بحسابه (${u.addresses ? u.addresses.length : 0}):</h4>
        ${addressesHtml}
      </div>
    `;
  } catch (e) {
    contentEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--red);">❌ حدث خطأ أثناء الاتصال بالسيرفر.</div>`;
  }
};
// ========================================================
// 1️⃣ أولاً: المستمع الحي لرسائل التواصل (بيسحب الداتا فوراً من السيرفر) ⚡
// ========================================================
if (typeof db !== 'undefined') {
  db.collection("contactMessages").onSnapshot(snap => {
    // تشغيل دالة الرندرة وعرض الرسائل تلقائياً أول ما أي زبون يبعت رسالة
    renderContactMessagesTable(snap.docs);
  }, error => {
    console.error("Firebase Messages Error:", error);
  });
}

// ========================================================
// 1️⃣ المستمع الحي لرسائل التواصل (مع طباعة تقارير في الـ Console) ⚡
// ========================================================
if (typeof db !== 'undefined') {
  db.collection("contactMessages").onSnapshot(snap => {
    console.log("📥 [PharmaCare] وصلنا تحديث من السيرفر! عدد الرسائل الحالية:", snap.size);
    renderContactMessagesTable(snap.docs);
  }, error => {
    console.error("❌ [PharmaCare] خطأ من الفايربيز أثناء جلب الرسائل:", error);
  });
} else {
  console.error("❌ [PharmaCare] خطأ كاريثي: متغير db الخاص بالفايربيز غير معرف في هذا الملف!");
}

// ========================================================
// 2️⃣ دالة الرندرة الذكية (تبني الجدول ديناميكياً لو العنصر Div أو Tbody) 💬
// ========================================================
// 📨 دالة عرض كروت الرسائل (النسخة المطورة للتحويل التلقائي للواتساب)
function renderMessagesGrid(docs) {
  const container = document.getElementById('messagesGrid') || document.getElementById('messagesContainer');
  if (!container) return;

  try {
    let html = '';

    if (!docs || docs.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--muted);">📭 لا توجد رسائل حالياً</div>`;
      return;
    }

    docs.forEach(doc => {
      try {
        if (!doc || typeof doc.data !== 'function') return;
        const data = doc.data() || {};
        const id = doc.id;
        
        const clean = (val) => typeof escapeHtml === 'function' ? escapeHtml(val) : (val || '—');

        // 🎯 السحر هنا: تهيئة وتطهير الرقم ليكون متوافقاً مع رابط الواتساب العالمي
        let rawPhone = String(data.phone || '').trim();
        let whatsappUrl = '#';
        
        if (rawPhone) {
          // إزالة أي مسافات أو رموز زائدة
          let cleanPhone = rawPhone.replace(/\D/g, ''); 
          // لو الرقم بيبدأ بصفر (زي 010...) بنشيل الصفر ونحط كود مصر 20
          if (cleanPhone.startsWith('0')) {
            cleanPhone = '20' + cleanPhone.substring(1);
          }
          whatsappUrl = `https://wa.me/${cleanPhone}`;
        }

        html += `
          <div class="message-card" style="position:relative;">
            <div class="msg-header">
              <strong>${clean(data.name)}</strong> 👤
            </div>
            <div class="msg-email">${clean(data.email)} 📧</div>
            
            <div class="msg-phone">
              <a href="${whatsappUrl}" target="_blank" title="اضغط لفتح محادثة واتساب فوراً" 
                 style="color: #25D366; text-decoration: underline; font-weight: 600; cursor: pointer;">
                ${clean(data.phone)} 📞
              </a>
            </div>
            
            <div class="msg-subject" style="color: var(--teal); margin-top:8px;"><strong>الموضوع:</strong> ${clean(data.subject)}</div>
            <div class="msg-body" style="margin-top:5px; font-style:italic;">${clean(data.message)}</div>
            
            <button class="act-btn del" onclick="deleteMessage('${id}')" style="margin-top:15px;">🗑️ حذف</button>
          </div>`;
          
      } catch (innerErr) {
        console.error("خطأ عابر في كرت رسالة:", innerErr);
      }
    });

    container.innerHTML = html;

  } catch (error) {
    console.error("Grid Rendering Error:", error);
    container.innerHTML = `<p style="text-align:center; color:var(--red);">❌ خطأ في عرض الكروت: ${error.message}</p>`;
  }
}

// ربط المسميات احتياطياً لضمان العمل تحت أي استدعاء عشوائي
window.renderMessagesTable = renderContactMessagesTable;