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
let productDocsCache = [];
let orderDocsCache = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function formatFirestoreDate(data) {
  const value = data?.createdAt || data?.subscribedAt;
  return value?.seconds ? new Date(value.seconds * 1000).toLocaleDateString('ar-EG') : '-';
}

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
  if(statusFilter !== 'all') filtered = filtered.filter(d => d.data().status === statusFilter);
  if(query) filtered = filtered.filter(d => {
    const userEmail = d.data().userEmail || '';
    const userName = d.data().shippingInfo?.name || '';
    return userEmail.toLowerCase().includes(query) || userName.toLowerCase().includes(query);
  });
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

  // 2. الطلبات (آخر الطلبات + صفحة الطلبات الكاملة)
  db.collection("orders").onSnapshot(snap => {
    orderDocsCache = snap.docs;
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
        <td style="cursor: pointer; color: var(--teal); font-weight: 600; text-decoration: underline;" 
            onclick="viewCustomerDetails('${data.userId}')" 
            title="اضغط لعرض ملف العميل الكامل">
            ${data.shippingInfo ? `${data.shippingInfo.name} (${data.shippingInfo.phone})` : data.userEmail || 'عميل مجهول'}
        </td>
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
        <td><strong>${escapeHtml(p.name)}</strong></td>
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

function renderNewsletterTable(docs) {
  const body = document.getElementById('newsletterBody');
  if(!body) return;
  
  let html = '';
  if(docs.length === 0) {
    html = '<tr><td colspan="3" style="text-align:center;">📭 لا توجد اشتراكات حالياً</td></tr>';
  } else {
    docs.forEach((doc, index) => {
      const data = doc.data();
      const date = formatFirestoreDate(data);
      html += `<tr>
        <td>${index + 1}</td>
        <td>${data.email || '—'}</td>
        <td>${date}</td>
      </tr>`;
    });
  }
  body.innerHTML = html;
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
  //  فيتشر الرفع الجماعي من ملف إكسيل (Bulk Upload) 📥
  // ================================================
  const excelInput = document.getElementById('excelFileInput');
  if (excelInput) {
    excelInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(evt) {
        try {
          const data = evt.target.result;
          // قراءة ملف الإكسيل
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // تحويل الشيت إلى مصفوفة JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            showToast("⚠️ ملف الإكسيل فارغ أو غير صحيح!", "error");
            return;
          }

          // تنبيه العميل ببدء الرفع
          showToast("⏳ جاري رفع المنتجات إلى السيرفر، برجاء الانتظار...");

          let successCount = 0;

          // عمل Loop على كل صف في شيت الإكسيل ورفعه للفايرستور
          for (const row of jsonData) {
            // قراءة الأعمدة (يدعم اللغة العربية والإنجليزية في أسماء الأعمدة)
            const name     = row['الاسم'] || row['name'];
            const category = row['الفئة'] || row['category'];
            const price    = parseFloat(row['السعر'] || row['price']);
            const emoji    = row['الصورة'] || row['رابط الصورة'] || row['emoji'] || '💊';
            const oldPrice = parseFloat(row['السعر القديم'] || row['oldPrice']) || null;
            const badge    = row['الشارة'] || row['badge'] || null;
            const desc     = row['الوصف'] || row['desc'] || '';

            // التحقق من الحقول الإلزامية قبل الرفع لمنع الداتا البايظة
            if (name && category && !isNaN(price)) {
              await db.collection("products").add({
                id: "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                name, category, emoji, price, oldPrice, badge, desc,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              successCount++;
            }
          }

          showToast(`🎉 بنجاح! تم رفع ${successCount} منتج من شيت الإكسيل.`);
          excelInput.value = ''; // تصفير المدخلات ليعمل مجدداً عند اختيار نفس الملف
        } catch (err) {
          console.error("Excel Parsing Error:", err);
          showToast("❌ حدث خطأ أثناء قراءة أو رفع ملف الإكسيل", "error");
        }
      };
      reader.readAsBinaryString(file);
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
const exportEmailsBtn = document.getElementById('exportEmailsBtn');
if(exportEmailsBtn) {
  exportEmailsBtn.addEventListener('click', async () => {
    try {
      const snap = await db.collection("newsletter").get();
      let csv = 'البريد الإلكتروني,تاريخ الاشتراك\n';
      snap.docs.forEach(doc => {
        const data = doc.data();
        const date = formatFirestoreDate(data);
        csv += `"${String(data.email || '').replace(/"/g, '""')}","${date}"\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast("✅ تم تصدير الرسائل البريدية بنجاح!");
    } catch(e) {
      showToast("❌ حدث خطأ في التصدير", "error");
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
    const mainWaMsg = encodeURIComponent(`أهلاً بك يا أستاذ ${u.name || 'عزيزنا العميل'}، معاك صيدلية الصباغ بخصوص الأوردر الخاص بك من الموقع الإلكتروني `);

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