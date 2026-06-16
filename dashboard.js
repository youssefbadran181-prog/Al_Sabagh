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

// تشغيل الفايربيز
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ================================================
//  مراقبة حالة تسجيل الدخول والأمان
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
          initModalsAndActions(); // تشغيل الأزرار والـ Modals
        } else {
          document.getElementById('loginGateError').textContent = "❌ خطأ: هذا الحساب لا يملك صلاحيات المسؤول.";
          await auth.signOut();
        }
      } catch (e) {
        document.getElementById('loginGateError').textContent = "❌ حدث خطأ أثناء التحقق من الصلاحيات.";
        await auth.signOut();
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
    newsletter: 'المشتركين'
  };
  if(titles[pageId]) pageTitle.textContent = titles[pageId];
}

navItems.forEach(item => {
  item.addEventListener('click', () => switchPage(item.dataset.page));
});

// ================================================
//  جلب البيانات الحية وعرضها في الجداول 🎉
// ================================================
function loadDashboardData() {
  // 1. الأعداد الإجمالية للمنتجات
  db.collection("products").onSnapshot(snap => {
    document.getElementById('stat-products').textContent = snap.size;
    renderProductsTable(snap.docs);
  });

  // 2. الطلبات (آخر الطلبات + صفحة الطلبات الكاملة)
  db.collection("orders").onSnapshot(snap => {
    document.getElementById('stat-orders').textContent = snap.size;
    const pendingCount = snap.docs.filter(doc => doc.data().status === 'pending').length;
    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('pendingBadge').textContent = pendingCount;
    
    // حساب إجمالي الإيرادات من الطلبات الموصلة (delivered)
    let revenue = 0;
    snap.docs.forEach(doc => {
      if(doc.data().status === 'delivered') revenue += (doc.data().total || 0);
    });
    document.getElementById('stat-revenue').textContent = revenue + " ج.م";

    renderOrdersTable(snap.docs);
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
}

// ================================================
//  دوال الـ Rendering لعرض البيانات جوه جداول الـ HTML
// ================================================

function renderOrdersTable(docs) {
  const recentBody = document.getElementById('recentOrdersBody');
  const mainBody = document.getElementById('ordersTableBody');
  
  let recentHtml = '';
  let mainHtml = '';

  if (docs.length === 0) {
    const emptyRow = `<tr><td colspan="7" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>`;
    if(recentBody) recentBody.innerHTML = emptyRow;
    if(mainBody) mainBody.innerHTML = emptyRow;
    return;
  }

  const sortedDocs = docs.sort((a,b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));

  sortedDocs.forEach((doc, index) => {
    const data = doc.data();
    const id = doc.id.substring(0, 6).toUpperCase();
    const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '—';
    
    const rowHtml = `
      <tr>
        <td>#${id}</td>
        <td>${data.shippingInfo ? `${data.shippingInfo.name} (<a href="tel:${data.shippingInfo.phone}">${data.shippingInfo.phone}</a>)` : data.userEmail || 'عميل مجهول'}</td>
        <td>${data.items ? data.items.map(i => `${i.name} (${i.qty})`).join('، ') : '—'}</td>
        <td style="font-weight:bold; color:var(--teal);">${data.total || 0} ج.م</td>
        <td><span class="status-badge status-${data.status || 'pending'}">${getStatusLabel(data.status)}</span></td>
        <td>${date}</td>
        <td>
          <select class="status-select" onchange="updateOrderStatus('${doc.id}', this.value)">
            <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
            <option value="processing" ${data.status === 'processing' ? 'selected' : ''}>جاري التجهيز</option>
            <option value="shipped" ${data.status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
            <option value="delivered" ${data.status === 'delivered' ? 'selected' : ''}>تم التوصيل</option>
            <option value="cancelled" ${data.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
          </select>
        </td>
      </tr>`;
    
    mainHtml += rowHtml;
    if(index < 5) recentHtml += rowHtml;
  });

  if(recentBody) recentBody.innerHTML = recentHtml;
  if(mainBody) mainBody.innerHTML = mainHtml;
}

function getStatusLabel(status) {
  const map = { pending: 'قيد الانتظار', processing: 'جاري التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
  return map[status] || 'قيد الانتظار';
}

window.updateOrderStatus = function(id, newStatus) {
  db.collection("orders").doc(id).update({ status: newStatus })
    .then(() => showToast("✅ تم تحديث حالة الطلب بنجاح"))
    .catch(() => showToast("❌ فشل تحديث حالة الطلب", "error"));
};

// [تعديل 1]: إضافة زرار "تعديل" وتمرير البيانات للـ Modal
function renderProductsTable(docs) {
  const body = document.getElementById('productsTableBody');
  let html = '';
  
  docs.forEach(doc => {
    const p = doc.data();
    
    const isImage = p.emoji && (p.emoji.startsWith('http://') || p.emoji.startsWith('https://'));
    const displayMedia = isImage 
      ? `<img src="${p.emoji}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px;" onerror="this.src='💊'"/>` 
      : p.emoji || '💊';

    html += `
      <tr>
        <td style="text-align: center; vertical-align: middle;">${displayMedia}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category || '—'}</td>
        <td style="color:var(--teal); font-weight:700;">${p.price} ج.م</td>
        <td style="text-decoration:line-through; color:var(--muted);">${p.oldPrice || '—'} ج.م</td>
        <td><span style="color:var(--red); font-weight:600;">${p.badge || '—'}</span></td>
        <td>
          <div class="action-btns">
            <button class="act-btn edit" onclick="openEditProductModal('${doc.id}', ${JSON.stringify(p).replace(/"/g, '&quot;')})">✏️ تعديل</button>
            <button class="act-btn del" onclick="deleteProduct('${doc.id}')">🗑️ حذف</button>
          </div>
        </td>
      </tr>`;
  });
  if(body) body.innerHTML = html || `<tr><td colspan="7" style="text-align:center;">📦 لا توجد منتجات معروضة</td></tr>`;
}

// [تعديل 2]: دالة فتح الـ Modal وملء البيانات عند الرغبة في التعديل
window.openEditProductModal = function(docId, productData) {
  document.getElementById('productModalTitle').textContent = "تعديل بيانات المنتج";
  document.getElementById('saveProductBtn').textContent = "💾 تحديث المنتج";
  document.getElementById('editProductId').value = docId; // تعبئة حقل الـ ID المخفي

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
        <td><strong>${d.name}</strong></td>
        <td>${d.phone}</td>
        <td>${d.address}</td>
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
        <p class="msg-body">${m.message}</p>
        <button class="act-btn del msg-del" onclick="deleteDocument('contactMessages', '${doc.id}')">🗑️ حذف</button>
      </div>`;
  });
  if(grid) grid.innerHTML = html || `<div class="loading-cell">💬 لا توجد رسائل تواصل واردة حالياً</div>`;
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