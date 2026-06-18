// ================================================
//  PharmaCare – app.js  (No ES Modules – works with file://)
//  Firebase loaded via CDN scripts in HTML
// ================================================

// ================================================
//  STATE
// ================================================
let allProducts    = [];
let filteredProducts = [];
let cart           = JSON.parse(localStorage.getItem("pharmcare_cart") || "[]");
let currentPage    = 1;
const PAGE_SIZE    = 8;
let activeFilter   = "all";
let currentUser    = null;
let userSavedAddresses = []; // مصفوفة تخزين عناوين العميل المسترجعة
let offerTimerInterval = null;

// Firebase refs (set after init)
let auth, db, storage, googleProvider;
let firebaseReady = false;

// ================================================
//  FIREBASE INIT
// ================================================
function initFirebase() {
  try {
    const firebaseConfig = {
       apiKey:            "AIzaSyBBM0PFOBK2tFJ2YliwEGsC1po_5HzcM7I",
       authDomain:        "al-sabagh.firebaseapp.com",
       projectId:         "al-sabagh",
       storageBucket:     "al-sabagh.firebasestorage.app",
       messagingSenderId: "66677156721",
       appId:             "1:66677156721:web:30700b98289f904c5424d0",
       measurementId:     "G-SS0XVJC5XB"
    };

    firebase.initializeApp(firebaseConfig);
    auth           = firebase.auth();
    db             = firebase.firestore();
    storage        = firebase.storage();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    firebaseReady  = true;

    // مراقب حالة الدخول والخروج الحية
    auth.onAuthStateChanged(user => {
      currentUser = user;
      const btn = $("authBtn");
      if (btn) {
        if (user) {
          btn.textContent = `👋 ${(user.displayName || "حسابي").split(" ")[0]} | خروج`;
        } else {
          btn.textContent = "تسجيل الدخول";
        }
      }
    });

    return true;
  } catch (e) {
    console.warn("Firebase init failed:", e.message);
    return false;
  }
}

// ================================================
//  UTILITY FUNCTIONS
// ================================================
function $(id) { return document.getElementById(id); }

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function showToast(msg, type = "success") {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast " + type + " show";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3200);
}

async function fsAdd(col, data) {
  if (!firebaseReady) return null;
  return await db.collection(col).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function fsSet(col, docId, data) {
  if (!firebaseReady) return;
  await db.collection(col).doc(docId).set(data);
}

async function fsGet(col, docId) {
  if (!firebaseReady) return null;
  const snap = await db.collection(col).doc(docId).get();
  return snap.exists ? snap.data() : null;
}

// دالة جلب العناوين المحفوظة من الفايرستور
async function loadUserAddresses() {
  const selector = $("addressSelector");
  const errorEl = $("addressModalError");
  if (!selector) return;
  
  selector.innerHTML = `<option value="" disabled selected>جاري تحميل عناوينك المحفوظة...</option>`;
  if (errorEl) errorEl.textContent = "";

  if (!firebaseReady) {
    selector.innerHTML = `<option value="new">➕ إضافة عنوان جديد (وضع تجريبي)</option>`;
    if ($("newAddressFields")) $("newAddressFields").classList.remove("hidden");
    return;
  }

  try {
    const userDoc = await db.collection("users").doc(currentUser.uid).get();
    let optionsHtml = '';
    userSavedAddresses = [];

    if (userDoc.exists && userDoc.data().addresses && userDoc.data().addresses.length > 0) {
      userSavedAddresses = userDoc.data().addresses;
      userSavedAddresses.forEach((addr, index) => {
        optionsHtml += `<option value="${index}">📍 ${addr.addressDetail.substring(0, 30)}... (${addr.name})</option>`;
      });
      optionsHtml += `<option value="new">➕ إضافة عنوان جديد</option>`;
      selector.innerHTML = optionsHtml;
      if ($("newAddressFields")) $("newAddressFields").classList.add("hidden");
    } else {
      selector.innerHTML = `<option value="new">➕ إضافة عنوان جديد</option>`;
      if ($("newAddressFields")) $("newAddressFields").classList.remove("hidden");
    }
  } catch (e) {
    selector.innerHTML = `<option value="new">➕ إضافة عنوان جديد</option>`;
    if ($("newAddressFields")) $("newAddressFields").classList.remove("hidden");
  }
}

// سحب العروض الحية من لوحة التحكم وإخفاء/إظهار البنر
function initRealtimeOffer() {
  if (!firebaseReady) return;

  db.collection("offers").doc("flashOffer").onSnapshot(doc => {
    const offerSection = document.querySelector(".flash-sale") || document.getElementById("promoBanner") || document.querySelector(".flash-banner");

    if (doc.exists) {
      if (offerSection) offerSection.style.display = "block";
      const data = doc.data();
      
      const labelEl = document.querySelector(".flash-label");
      const titleEl = document.querySelector(".flash-text h2");
      const codeEl = document.querySelector(".flash-text strong");

      if (labelEl) labelEl.textContent = data.label || "🔥 عرض حصري لفترة محدودة";
      if (titleEl) titleEl.innerHTML = data.title ? data.title.replace(/\n/g, "<br/>") : "";
      if (codeEl) codeEl.textContent = data.code || "";

      if (offerTimerInterval) clearInterval(offerTimerInterval);
      const endTime = data.endAt || (Date.now() + 6 * 3600000);

      function tick() {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          if ($("t-hours")) $("t-hours").textContent = "00";
          if ($("t-mins")) $("t-mins").textContent = "00";
          if ($("t-secs")) $("t-secs").textContent = "00";
          clearInterval(offerTimerInterval);
          return;
        }
        if ($("t-hours")) $("t-hours").textContent = String(Math.floor(remaining / 3600000)).padStart(2, "0");
        if ($("t-mins")) $("t-mins").textContent = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, "0");
        if ($("t-secs")) $("t-secs").textContent = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
      }
      tick();
      offerTimerInterval = setInterval(tick, 1000);
    } else {
      if (offerSection) offerSection.style.display = "none";
      if (offerTimerInterval) clearInterval(offerTimerInterval);
    }
  });
}

// ================================================
//  LOAD & RENDER PRODUCTS
// ================================================
async function loadProducts() {
  if (firebaseReady) {
    try {
      const snap = await db.collection("products").get();
      if (!snap.empty) {
        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Firestore read failed:", e.message);
    }
  }
  filteredProducts = [...allProducts];
  updateCategoryCounts();
  renderProducts();
}

function updateCategoryCounts() {
  ["medicine","skincare","medical","baby","personalcare","devices"].forEach(cat => {
    const el = $("count-" + cat);
    if (el) el.textContent = allProducts.filter(p => p.category === cat).length + " منتج";
  });
}

function renderProducts() {
  const grid = $("productsGrid");
  const spinner = $("loadingSpinner");
  if (!grid) return;
  if (spinner) spinner.remove();

  grid.querySelectorAll(".product-card, .no-products").forEach(el => el.remove());
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredProducts.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    grid.insertAdjacentHTML("beforeend", `<div class="no-products">😕 لا توجد منتجات تطابق البحث</div>`);
    $("pagination").innerHTML = "";
    return;
  }

  page.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.id = p.id;

    const isImage = p.emoji && (p.emoji.startsWith('http://') || p.emoji.startsWith('https://'));
    const mediaHtml = isImage 
      ? `<img src="${p.emoji}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='💊'"/>` 
      : p.emoji || '💊';

    card.innerHTML = `
      ${p.badge ? `<span class="product-badge">${escapeHtml(p.badge)}</span>` : ""}
      <div class="product-image">${mediaHtml}</div>
      <div class="product-info">
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-desc">${escapeHtml(p.desc || "")}</div>
        <div class="product-price">
          <span class="price-current">${escapeHtml(p.price)} ج.م</span>
          ${p.oldPrice ? `<span class="price-old">${escapeHtml(p.oldPrice)} ج.م</span>` : ""}
        </div>
        <div class="product-actions">
          <button class="btn btn-cart" data-id="${p.id}">🛒 أضف للسلة</button>
          <button class="btn btn-wish" data-id="${p.id}" title="المفضلة">♡</button>
        </div>
      </div>`;
    card.querySelector(".btn-cart").addEventListener("click", e => { e.stopPropagation(); addToCart(p.id); });
    card.querySelector(".btn-wish").addEventListener("click", e => { e.stopPropagation(); showToast("تمت الإضافة للمفضلة ❤️"); });
    card.addEventListener("click", () => openProductModal(p));
    grid.appendChild(card);
  });
  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const pg = $("pagination");
  if (!pg) return;
  pg.innerHTML = "";
  if (total <= 1) return;
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (i === currentPage ? " active" : "");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      currentPage = i;
      renderProducts();
      $("products").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    pg.appendChild(btn);
  }
}

function applyFilters() {
  const q = $("searchInput").value.trim().toLowerCase();
  filteredProducts = allProducts.filter(p => {
    const matchCat = activeFilter === "all" || p.category === activeFilter;
    const matchQ   = !q || p.name.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  currentPage = 1;
  renderProducts();
}

// ================================================
//  CART LOGIC
// ================================================
function saveCart() { localStorage.setItem("pharmcare_cart", JSON.stringify(cart)); }

function addToCart(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(x => x.id === productId);
  if (existing) existing.qty++;
  else cart.push({ ...p, qty: 1 });
  saveCart(); updateCartCount();
  showToast(`✅ تم إضافة "${p.name}" للسلة`);
}

function updateCartCount() {
  if ($("cartCount")) $("cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function renderCart() {
  const container = $("cartItems");
  const footer    = $("cartFooter");
  if (!container || !footer) return;
  container.innerHTML = "";

  if (!cart.length) {
    container.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>سلتك فارغة<br/>تصفح منتجاتنا وأضف ما يعجبك</p></div>`;
    footer.style.display = "none";
    return;
  }

  let total = 0;
  cart.forEach(item => {
    total += item.price * item.qty;
    const div = document.createElement("div");
    div.className = "cart-item";
    
    const isImage = item.emoji && (item.emoji.startsWith('http://') || item.emoji.startsWith('https://'));
    const cartMediaHtml = isImage 
      ? `<img src="${item.emoji}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" onerror="this.parentNode.innerHTML='💊'"/>` 
      : item.emoji || "💊";

    div.innerHTML = `
      <div class="cart-item-icon">${cartMediaHtml}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${escapeHtml(item.price)} ج.م</div>
        <div class="cart-item-qty">
          <button class="qty-btn" data-id="${item.id}" data-action="dec">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" data-id="${item.id}" data-action="inc">+</button>
        </div>
      </div>
      <button class="remove-item" data-id="${item.id}">🗑</button>`;
    container.appendChild(div);
  });

  container.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      const item   = cart.find(x => x.id === id);
      if (!item) return;
      if (action === "inc") item.qty++;
      else if (item.qty > 1) item.qty--;
      else cart = cart.filter(x => x.id !== id);
      saveCart(); updateCartCount(); renderCart();
    });
  });

  container.querySelectorAll(".remove-item").forEach(btn => {
    btn.addEventListener("click", () => {
      cart = cart.filter(x => x.id !== btn.dataset.id);
      saveCart(); updateCartCount(); renderCart();
    });
  });

  $("cartTotal").textContent = total.toFixed(2) + " ج.م";
  footer.style.display = "block";
}

function closeCart() {
  if ($("cartDrawer")) $("cartDrawer").classList.remove("open");
  if ($("cartOverlay")) $("cartOverlay").classList.remove("open");
}

// ================================================
//  MODALS
// ================================================
function openProductModal(p) {
  const isImage = p.emoji && (p.emoji.startsWith('http://') || p.emoji.startsWith('https://'));
  const modalMediaHtml = isImage 
    ? `<img src="${p.emoji}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" onerror="this.parentNode.innerHTML='💊'"/>` 
    : p.emoji || '💊';

  $("productModalContent").innerHTML = `
    <div class="product-modal-img">${modalMediaHtml}</div>
    <h2>${escapeHtml(p.name)}</h2>
    <p class="product-desc">${escapeHtml(p.desc || "")}</p>
    <div class="product-price">${escapeHtml(p.price)} ج.م
      ${p.oldPrice ? `<span class="price-old" style="font-size:15px;color:var(--text-muted)">${escapeHtml(p.oldPrice)} ج.م</span>` : ""}
    </div>
    ${p.badge ? `<span class="product-badge" style="position:relative;top:auto;right:auto;display:inline-block;margin-bottom:16px">${escapeHtml(p.badge)}</span>` : ""}
    <div class="qty-control">
      <label>الكمية:</label>
      <button class="qty-btn" id="modalDec">−</button>
      <span class="qty-num" id="modalQty">1</span>
      <button class="qty-btn" id="modalInc">+</button>
    </div>
    <button class="btn btn-primary btn-block" id="modalAddCart">🛒 أضف للسلة</button>`;

  let qty = 1;
  $("modalDec").onclick = () => { if (qty > 1) { qty--; $("modalQty").textContent = qty; } };
  $("modalInc").onclick = () => { qty++; $("modalQty").textContent = qty; };
  $("modalAddCart").onclick = () => {
    for (let i = 0; i < qty; i++) addToCart(p.id);
    closeProductModal();
  };
  $("productOverlay").classList.add("open");
}
function closeProductModal() { if($("productOverlay")) $("productOverlay").classList.remove("open"); }
function openAuthModal() { if($("authOverlay")) $("authOverlay").classList.add("open"); }
function closeAuthModal() {
  if ($("authOverlay")) $("authOverlay").classList.remove("open");
  if ($("loginError")) $("loginError").textContent = "";
  if ($("registerError")) $("registerError").textContent = "";
}

function getAuthError(code) {
  const map = {
    "auth/user-not-found":         "❌ البريد الإلكتروني غير مسجل",
    "auth/wrong-password":         "❌ كلمة المرور غير صحيحة",
    "auth/email-already-in-use":   "❌ البريد الإلكتروني مسجل بالفعل",
    "auth/invalid-email":          "❌ البريد الإلكتروني غير صحيح",
    "auth/weak-password":          "❌ كلمة المرور ضعيفة جداً",
    "auth/too-many-requests":      "⚠️ محاولات كثيرة جداً، انتظر قليلاً",
    "auth/network-request-failed": "⚠️ مشكلة في الاتصال بالإنترنت",
    "auth/popup-closed-by-user":   "⚠️ تم إغلاق النافذة قبل اكتمال الدخول",
    "auth/invalid-credential":     "❌ بيانات الدخول غير صحيحة",
  };
  return map[code] || "❌ حدث خطأ: " + code;
}

async function googleSignIn() {
  if (!firebaseReady) { showToast("⚠️ Firebase غير مفعل – وضع تجريبي", "error"); return; }
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user   = result.user;
    const exists = await fsGet("users", user.uid);
    if (!exists) {
      await fsSet("users", user.uid, { name: user.displayName, email: user.email, role: "customer", createdAt: new Date().toISOString() });
    }
    closeAuthModal();
    showToast(`🎉 أهلاً ${user.displayName}!`);
  } catch (e) {
    showToast("❌ حدث خطأ في الدخول بجوجل", "error");
  }
}

// ================================================
//  INIT & DOM READY 🔒 (تم تجميع كل الـ Listeners هنا لحل مشكلة الإغلاق والانهيار)
// ================================================
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. زرار فتح لوحة التحكم للمسؤولين
  const dashBtn = document.getElementById("goToDashBtn");
  if (dashBtn) {
    dashBtn.addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });
  }

  // 2. الهامبرجر منيو
  if ($("hamburger")) {
    $("hamburger").addEventListener("click", () => {
      if ($("navLinks")) $("navLinks").classList.toggle("open");
    });
  }
  document.querySelectorAll(".nav-links a").forEach(a => {
    a.addEventListener("click", () => { if($("navLinks")) $("navLinks").classList.remove("open"); });
  });

  // 3. أزرار فتح وقفل السلة
  if ($("cartBtn")) {
    $("cartBtn").addEventListener("click", () => {
      renderCart();
      $("cartDrawer").classList.add("open");
      $("cartOverlay").classList.add("open");
    });
  }
  if ($("closeCart")) $("closeCart").addEventListener("click", closeCart);
  if ($("cartOverlay")) $("cartOverlay").addEventListener("click", closeCart);

  // 4. الفلاتر والبحث
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });
  document.querySelectorAll(".cat-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".cat-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      activeFilter = card.dataset.cat;
      document.querySelectorAll(".filter-btn").forEach(b => { b.classList.toggle("active", b.dataset.filter === activeFilter); });
      applyFilters();
      if($("products")) $("products").scrollIntoView({ behavior: "smooth" });
    });
  });
  // 🔍 تفعيل البحث الحي الفوري بمجرد كتابة أي حرف (Local Instant Search)
if ($("searchInput")) {
  $("searchInput").addEventListener("input", applyFilters);
}

if ($("searchBtn")) {
  $("searchBtn").addEventListener("click", applyFilters);
}
  // 5. زرار إتمام الشراء وفتح مودال الشحن
  if ($("checkoutBtn")) {
    $("checkoutBtn").addEventListener("click", async () => {
      if (!currentUser) {
        showToast("⚠️ سجل دخولك أولاً لإتمام الشراء", "error");
        closeCart(); openAuthModal(); return;
      }
      if (!cart.length) return;
      if ($("checkoutAddressOverlay")) {
        $("checkoutAddressOverlay").classList.remove("hidden");
        $("checkoutAddressOverlay").classList.add("open");
        loadUserAddresses();
      }
    });
  }
  if ($("closeAddressModal")) {
    $("closeAddressModal").addEventListener("click", () => {
      if ($("checkoutAddressOverlay")) { $("checkoutAddressOverlay").classList.remove("open"); $("checkoutAddressOverlay").classList.add("hidden"); }
    });
  }

  // 6. مراقبة الـ Selector وتأكيد الطلب
  if ($("addressSelector")) {
    $("addressSelector").addEventListener("change", function() {
      if ($("newAddressFields")) {
        if (this.value === "new") $("newAddressFields").classList.remove("hidden");
        else $("newAddressFields").classList.add("hidden");
      }
    });
  }

  if ($("confirmOrderBtn")) {
    $("confirmOrderBtn").addEventListener("click", async () => {
      const selectValue = $("addressSelector") ? $("addressSelector").value : "new";
      const errorEl = $("addressModalError");
      if (errorEl) errorEl.textContent = "";

      let finalShippingData = null;
      if (selectValue === "new" || selectValue === "") {
        const name = $("shipName") ? $("shipName").value.trim() : "";
        const phone = $("shipPhone") ? $("shipPhone").value.trim() : "";
        const addressDetail = $("shipAddress") ? $("shipAddress").value.trim() : "";

        if (!name || !phone || !addressDetail) {
          if (errorEl) errorEl.textContent = "⚠️ من فضلك املا كل الحقول المطلوبة للعنوان الجديد"; return;
        }
        if (phone.length < 11) {
          if (errorEl) errorEl.textContent = "⚠️ رقم الهاتف يجب أن يكون 11 رقم على الأقل"; return;
        }
        finalShippingData = { name, phone, addressDetail };
        if ($("saveAddressCheck") && $("saveAddressCheck").checked && firebaseReady) {
          try {
            await db.collection("users").doc(currentUser.uid).update({ addresses: firebase.firestore.FieldValue.arrayUnion(finalShippingData) });
          } catch (err) { console.warn("فشل حفظ العنوان:", err.message); }
        }
      } else {
        finalShippingData = userSavedAddresses[parseInt(selectValue)];
      }

      try {
        $("confirmOrderBtn").disabled = true; $("confirmOrderBtn").textContent = "جاري تأكيد طلبك...";
        if (firebaseReady) {
          await db.collection("orders").add({
            userId: currentUser.uid, userEmail: currentUser.email, shippingInfo: finalShippingData,
            items: cart, total: cart.reduce((s, i) => s + i.price * i.qty, 0), status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        cart = []; saveCart(); updateCartCount(); renderCart(); closeCart();
        if ($("checkoutAddressOverlay")) { $("checkoutAddressOverlay").classList.remove("open"); $("checkoutAddressOverlay").classList.add("hidden"); }
        ['shipName', 'shipPhone', 'shipAddress'].forEach(id => { if ($(id)) $(id).value = ""; });
        showToast("🎉 تم إرسال طلبك بنجاح! سنتواصل معك قريباً");
      } catch (e) { showToast("حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى", "error"); }
      finally { $("confirmOrderBtn").disabled = false; $("confirmOrderBtn").textContent = "تأكيد وإرسال الطلب الآن 🎉"; }
    });
  }

  // 7. الـ Auth Modals والـ Tabs
  if ($("authBtn")) {
    $("authBtn").addEventListener("click", () => {
      if (currentUser && firebaseReady) { auth.signOut(); showToast("👋 تم تسجيل الخروج"); }
      else openAuthModal();
    });
  }
  if ($("closeAuth")) $("closeAuth").addEventListener("click", closeAuthModal);
  if ($("closeProduct")) $("closeProduct").addEventListener("click", closeProductModal);

  if ($("tabLogin")) {
    $("tabLogin").addEventListener("click", () => {
      $("tabLogin").classList.add("active"); $("tabRegister").classList.remove("active");
      $("loginForm").classList.remove("hidden"); $("registerForm").classList.add("hidden");
    });
  }
  if ($("tabRegister")) {
    $("tabRegister").addEventListener("click", () => {
      $("tabRegister").classList.add("active"); $("tabLogin").classList.remove("active");
      $("registerForm").classList.remove("hidden"); $("loginForm").classList.add("hidden");
    });
  }

  // إظهار الباسورد وقوته
  if ($("toggleLoginPwd")) {
    $("toggleLoginPwd").addEventListener("click", () => {
      const i = $("loginPassword"); if(i) i.type = i.type === "password" ? "text" : "password";
    });
  }
  if ($("toggleRegPwd")) {
    $("toggleRegPwd").addEventListener("click", () => {
      const i = $("regPassword"); if(i) i.type = i.type === "password" ? "text" : "password";
    });
  }
  if ($("regPassword")) {
    $("regPassword").addEventListener("input", function () {
      const v = this.value; const bar = $("pwdStrength"); if (!bar) return;
      if (!v.length) { bar.className = "password-strength"; return; }
      if (v.length < 6) { bar.className = "password-strength strength-weak"; return; }
      if (v.length < 10 || !/[0-9]/.test(v)) { bar.className = "password-strength strength-med"; return; }
      bar.className = "password-strength strength-strong";
    });
  }

  // الدخول والتسجيل
  if ($("loginBtn")) {
    $("loginBtn").addEventListener("click", async () => {
      const email = $("loginEmail").value.trim(); const password = $("loginPassword").value;
      const errEl = $("loginError"); if(errEl) errEl.textContent = "";
      if (!email) { errEl.textContent = "⚠️ أدخل البريد الإلكتروني"; return; }
      if (password.length < 6) { errEl.textContent = "⚠️ كلمة المرور أقل من 6 أحرف"; return; }
      if (!firebaseReady) return;
      const btn = $("loginBtn"); btn.disabled = true; btn.textContent = "جاري التحقق...";
      try { await auth.signInWithEmailAndPassword(email, password); closeAuthModal(); showToast("🎉 أهلاً بك مجدداً!"); }
      catch (e) { if(errEl) errEl.textContent = getAuthError(e.code); }
      finally { btn.disabled = false; btn.textContent = "تسجيل الدخول"; }
    });
  }

  if ($("registerBtn")) {
    $("registerBtn").addEventListener("click", async () => {
      const name = $("regName").value.trim(); const email = $("regEmail").value.trim();
      const phone = $("regPhone").value.trim(); const password = $("regPassword").value;
      const confirm = $("regConfirm").value; const errEl = $("registerError"); if(errEl) errEl.textContent = "";
      if (!name || !email || phone.length < 11 || password !== confirm) { errEl.textContent = "⚠️ برجاء التأكد من صحة البيانات وتطابق كلمتي المرور"; return; }
      if (!firebaseReady) return;
      const btn = $("registerBtn"); btn.disabled = true; btn.textContent = "جاري الإنشاء...";
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        await fsSet("users", cred.user.uid, { name, email, phone, role: "customer", createdAt: new Date().toISOString() });
        closeAuthModal(); showToast(`🎉 تم إنشاء حسابك بنجاح يا ${name}`);
      } catch (e) { if(errEl) errEl.textContent = getAuthError(e.code); }
      finally { btn.disabled = false; btn.textContent = "إنشاء الحساب"; }
    });
  }

  if ($("googleLoginBtn")) $("googleLoginBtn").addEventListener("click", googleSignIn);
  if ($("googleRegBtn")) $("googleRegBtn").addEventListener("click", googleSignIn);

  if ($("forgotPwdLink")) {
    $("forgotPwdLink").addEventListener("click", async e => {
      e.preventDefault(); const email = $("loginEmail").value.trim();
      if (!email) { $("loginError").textContent = "⚠️ أدخل بريدك الإلكتروني أولاً"; return; }
      try { await auth.sendPasswordResetEmail(email); showToast("📧 تم إرسال رابط استعادة الباسورد!"); }
      catch (e) { $("loginError").textContent = getAuthError(e.code); }
    });
  }

// 🎯 8. فورم الروشتة السريع المطور عبر الواتساب مباشرة 🚀
  if ($("submitOrderBtn")) {
    $("submitOrderBtn").addEventListener("click", async () => {
      const name    = $("orderName") ? $("orderName").value.trim() : "";
      const phone   = $("orderPhone") ? $("orderPhone").value.trim() : "";
      const address = $("orderAddress") ? $("orderAddress").value.trim() : "";
      const notes   = $("orderNotes") ? $("orderNotes").value.trim() : "";

      // التحقق من الخانات الإلزامية قبل التحويل للواتساب
      if (!name || !phone || !address) { 
        showToast("⚠️ من فضلك أدخل الاسم، الهاتف، والعنوان بالكامل", "error"); 
        return; 
      }

      try {
        // 1️⃣ حفظ الطلب بالفايربيز ديناميكياً عشان يظهر إدارياً في الداشبورد برضه!
        if (firebaseReady) {
          await db.collection("prescriptionOrders").add({ 
            name, 
            phone, 
            address, 
            notes, 
            prescriptionFileUrl: null, 
            prescriptionFileName: "💬 أرسل عبر الواتساب", 
            userId: currentUser?.uid || null, 
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        // 2️⃣ بناء نص الرسالة وتطهير البيانات لفتح محادثة الواتساب فوراً ديناميكياً
        const whatsappNumber = "201055054047"; // رقم الصيدلية الخاص بك
        const messageText = `📋 *طلب روشتة جديد من الموقع*:\n\n👤 *الاسم:* ${name}\n📞 *رقم الموبايل:* ${phone}\n📍 *العنوان بالتفصيل:* ${address}\n📝 *الملاحظات / الأدوية المطلوبة:* ${notes || "لا يوجد"}`;
        
        // فتح شات الواتساب بالرسالة المجهزة
        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageText)}`, '_blank');
        
        // تصفير الخانات بعد نجاح العملية لتجهيز الفورم لأي طلب جديد
        ["orderName", "orderPhone", "orderAddress", "orderNotes"].forEach(id => { 
          if ($(id)) $(id).value = ""; 
        });
        
        showToast("🎉 تم تسجيل طلبك وتوجيهك إلى الواتساب!");
      } catch (e) {
        console.error("Prescription Order Error:", e);
      }
    });
  }
  // 🎯 كود تشغيل زرار اشتراك العروض والنيوزليتر 📧
  if ($("subscribeBtn")) {
    $("subscribeBtn").addEventListener("click", async () => {
      const emailInput = $("newsletterEmail");
      if (!emailInput) return;

      const email = emailInput.value.trim();
      if (!email || !email.includes("@")) { 
        showToast("⚠️ من فضلك أدخل بريد إلكتروني صحيح", "error"); 
        return; 
      }

      try {
        if (firebaseReady) {
          await db.collection("newsletter").add({ 
            email: email, 
            subscribedAt: firebase.firestore.FieldValue.serverTimestamp() 
          });
        }
        showToast("🎉 تم تسجيلك في قائمة العروض والمبيعات بنجاح!");
        emailInput.value = ""; // تصفير الخانة فوراً بعد الاشتراك
      } catch (e) {
        showToast("🎉 تم تسجيلك في قائمة العروض! (وضع تجريبي)");
        emailInput.value = "";
      }
    });
  }
  // 🎯 كود تشغيل فورم "تواصل معنا" بشكل آمن ومقاوم للانهيار 💬
  if ($("sendContactBtn")) {
    $("sendContactBtn").addEventListener("click", async () => {
      const name    = $("cName") ? $("cName").value.trim() : "";
      const email   = $("cEmail") ? $("cEmail").value.trim() : "";
      const message = $("cMessage") ? $("cMessage").value.trim() : "";

      if (!name || !message) { 
        showToast("⚠️ الاسم والرسالة مطلوبان", "error"); 
        return; 
      }

      try {
        if (firebaseReady) {
          await db.collection("contactMessages").add({
            name, 
            email,
            phone:   $("cPhone") ? $("cPhone").value.trim() : "",
            subject: $("cSubject") ? $("cSubject").value.trim() : "",
            message,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        showToast("✅ وصلتنا رسالتك! هنرد عليك قريباً 💬");
        ["cName","cEmail","cPhone","cSubject","cMessage"].forEach(id => {
          if ($(id)) $(id).value = "";
        });
      } catch (e) {
        showToast("✅ تم استلام رسالتك (وضع تجريبي)");
        ["cName","cEmail","cPhone","cSubject","cMessage"].forEach(id => {
          if ($(id)) $(id).value = "";
        });
      }
    });
  }
  // 🎯 كود تشغيل زرار تسجيل الدخول بجوجل 🌐
  const googleLoginBtn = document.getElementById("googleLoginBtn") || document.querySelector(".btn-google");
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
      if (!firebaseReady) { 
        showToast("⚠️ الفايربيز غير متصل - وضع تجريبي", "error"); 
        return; 
      }
      
      try {
        // استدعاء ميكانيزم جوجل بوب-أب من الفايربيز
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // فحص ذكي: لو المستخدم أول مرة يسجل في الموقع، بننشئ له ملف جوه الـ users
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (!userDoc.exists) {
          await db.collection("users").doc(user.uid).set({
            name: user.displayName,
            email: user.email,
            role: "customer",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        
        if (typeof closeAuthModal === 'function') closeAuthModal(); // إغلاق نافذة الدخول
        showToast(`🎉 أهلاً بك يا ${user.displayName.split(' ')[0]}!`);
        
      } catch (error) {
        console.error("Google Auth Error:", error);
        
        // كاشف الأعطال: لو نسيت تفعلها في السيرفر هيقولك فوراً
        if (error.code === "auth/operation-not-allowed") {
          showToast("❌ عطل: يجب تفعيل تسجيل جوجل من Firebase Console", "error");
        } else if (error.code === "auth/popup-closed-by-user") {
          showToast("⚠️ تم إغلاق نافذة تسجيل الدخول قبل الاكتمال");
        } else {
          showToast("❌ فشل تسجيل الدخول بواسطة جوجل", "error");
        }
      }
    });
  }

  // تشغيل السستم الأساسي
  initFirebase();
  updateCartCount();
  loadProducts();
  initRealtimeOffer(); 
});