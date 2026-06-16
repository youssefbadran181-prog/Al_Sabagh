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

// Firebase refs (set after init)
let auth, db, googleProvider;
let firebaseReady = false;

// ================================================
//  FIREBASE INIT (safe – won't crash if config wrong)
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
    googleProvider = new firebase.auth.GoogleAuthProvider();
    firebaseReady  = true;

    // Auth state listener
    auth.onAuthStateChanged(user => {
      currentUser = user;
      const btn = $("authBtn");
      if (user) {
        btn.textContent = `👋 ${(user.displayName || "حسابي").split(" ")[0]} | خروج`;
      } else {
        btn.textContent = "تسجيل الدخول";
      }
    });

    return true;
  } catch (e) {
    console.warn("Firebase init failed:", e.message);
    return false;
  }
}

// ================================================
//  UTILITY
// ================================================
function $(id) { return document.getElementById(id); }

function showToast(msg, type = "success") {
  const t = $("toast");
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

// ================================================
//  NAVBAR SCROLL + HAMBURGER
// ================================================
window.addEventListener("scroll", () => {
  $("navbar").classList.toggle("scrolled", window.scrollY > 50);
});

$("hamburger").addEventListener("click", () => {
  $("navLinks").classList.toggle("open");
});

// Close nav on link click (mobile)
document.querySelectorAll(".nav-links a").forEach(a => {
  a.addEventListener("click", () => $("navLinks").classList.remove("open"));
});

// ================================================
//  COUNTDOWN TIMER
// ================================================
(function initTimer() {
  const end = new Date(Date.now() + 6 * 3600000 + 25 * 60000 + 18000);
  function tick() {
    const d = end - Date.now();
    if (d <= 0) return;
    $("t-hours").textContent = String(Math.floor(d / 3600000)).padStart(2,"0");
    $("t-mins").textContent  = String(Math.floor((d % 3600000) / 60000)).padStart(2,"0");
    $("t-secs").textContent  = String(Math.floor((d % 60000) / 1000)).padStart(2,"0");
  }
  tick();
  setInterval(tick, 1000);
})();

// ================================================
//  LOAD PRODUCTS
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
  ["vitamins","skincare","medicine","baby","dental","devices"].forEach(cat => {
    const el = $("count-" + cat);
    if (el) el.textContent = allProducts.filter(p => p.category === cat).length + " منتج";
  });
}

// ================================================
//  RENDER PRODUCTS (تحديث العرض لدعم الصور الحقيقية)
// ================================================
function renderProducts() {
  const grid    = $("productsGrid");
  const spinner = $("loadingSpinner");
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

    // التحقق هل القيمة المدخلة رابط صورة أم رمز تعبيري
    const isImage = p.emoji && (p.emoji.startsWith('http://') || p.emoji.startsWith('https://'));
    const mediaHtml = isImage 
      ? `<img src="${p.emoji}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='💊'"/>` 
      : p.emoji || '💊';

    card.innerHTML = `
      ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
      <div class="product-image">${mediaHtml}</div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc || ""}</div>
        <div class="product-price">
          <span class="price-current">${p.price} ج.م</span>
          ${p.oldPrice ? `<span class="price-old">${p.oldPrice} ج.م</span>` : ""}
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

// ================================================
//  FILTER + SEARCH
// ================================================
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
    document.querySelectorAll(".filter-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.filter === activeFilter);
    });
    applyFilters();
    $("products").scrollIntoView({ behavior: "smooth" });
  });
});

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

$("searchBtn").addEventListener("click", applyFilters);
$("searchInput").addEventListener("keyup", e => { if (e.key === "Enter") applyFilters(); });

// ================================================
//  CART
// ================================================
function saveCart() { localStorage.setItem("pharmcare_cart", JSON.stringify(cart)); }

function addToCart(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(x => x.id === productId);
  if (existing) existing.qty++;
  else cart.push({ ...p, qty: 1 });
  saveCart();
  updateCartCount();
  showToast(`✅ تم إضافة "${p.name}" للسلة`);
}

function updateCartCount() {
  $("cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function renderCart() {
  const container = $("cartItems");
  const footer    = $("cartFooter");
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
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${item.price} ج.م</div>
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

// Cart open/close
$("cartBtn").addEventListener("click", () => {
  renderCart();
  $("cartDrawer").classList.add("open");
  $("cartOverlay").classList.add("open");
});
$("closeCart").addEventListener("click",   closeCart);
$("cartOverlay").addEventListener("click", closeCart);
function closeCart() {
  $("cartDrawer").classList.remove("open");
  $("cartOverlay").classList.remove("open");
}
// ================================================
//  CHECKOUT & SAVED ADDRESSES LOGIC (النسخة النظيفة والآمنة) 🚚
// ================================================
let userSavedAddresses = []; 

// 1. تفعيل زرار إتمام الشراء الأساسي بشكل آمن
if ($("checkoutBtn")) {
  $("checkoutBtn").addEventListener("click", async () => {
    if (!currentUser) {
      showToast("⚠️ سجل دخولك أولاً لإتمام الشراء", "error");
      closeCart();
      openAuthModal();
      return;
    }
    if (!cart.length) return;

    if ($("checkoutAddressOverlay")) {
      $("checkoutAddressOverlay").classList.remove("hidden");
      loadUserAddresses();
    } else {
      alert("خطأ عابر: كود الـ HTML بتاع المودال لسه متضافش في index.html أو الـ ID غلط!");
    }
  });
}

// 2. زرار إغلاق مودال العناوين
if ($("closeAddressModal")) {
  $("closeAddressModal").addEventListener("click", () => {
    if ($("checkoutAddressOverlay")) $("checkoutAddressOverlay").classList.add("hidden");
  });
}

// 3. مراقبة تغيير الـ Select
if ($("addressSelector")) {
  $("addressSelector").addEventListener("change", function() {
    if ($("newAddressFields")) {
      if (this.value === "new") {
        $("newAddressFields").classList.remove("hidden");
      } else {
        $("newAddressFields").classList.add("hidden");
      }
    }
  });
}

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

// 5. زرار التأكيد النهائي وإرسال الأوردر للمسؤولين
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
        if (errorEl) errorEl.textContent = "⚠️ من فضلك املا كل الحقول المطلوبة للعنوان الجديد";
        return;
      }
      if (phone.length < 11) {
        if (errorEl) errorEl.textContent = "⚠️ رقم الهاتف يجب أن يكون 11 رقم على الأقل";
        return;
      }

      finalShippingData = { name, phone, addressDetail };

      if ($("saveAddressCheck") && $("saveAddressCheck").checked && firebaseReady) {
        try {
          await db.collection("users").doc(currentUser.uid).update({
            addresses: firebase.firestore.FieldValue.arrayUnion(finalShippingData)
          });
        } catch (err) {
          console.warn("فشل حفظ العنوان:", err.message);
        }
      }
    } else {
      finalShippingData = userSavedAddresses[parseInt(selectValue)];
    }

    try {
      $("confirmOrderBtn").disabled = true;
      $("confirmOrderBtn").textContent = "جاري تأكيد طلبك...";

      if (firebaseReady) {
        await db.collection("orders").add({
          userId:       currentUser.uid,
          userEmail:    currentUser.email,
          shippingInfo: finalShippingData, 
          items:        cart,
          total:        cart.reduce((s, i) => s + i.price * i.qty, 0),
          status:       "pending",
          createdAt:    firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      cart = [];
      saveCart(); updateCartCount(); renderCart(); closeCart();
      if ($("checkoutAddressOverlay")) $("checkoutAddressOverlay").classList.add("hidden");
      
      ['shipName', 'shipPhone', 'shipAddress'].forEach(id => {
        if ($(id)) $(id).value = "";
      });
      
      showToast("🎉 تم إرسال طلبك بنجاح! سنتواصل معك قريباً");
    } catch (e) {
      showToast("حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى", "error");
    } finally {
      $("confirmOrderBtn").disabled = false;
      $("confirmOrderBtn").textContent = "تأكيد وإرسال الطلب الآن 🎉";
    }
  });
}

// ================================================
//  PRODUCT MODAL (تحديث العرض المنبثق ليدعم الصور)
// ================================================
function openProductModal(p) {
  const isImage = p.emoji && (p.emoji.startsWith('http://') || p.emoji.startsWith('https://'));
  const modalMediaHtml = isImage 
    ? `<img src="${p.emoji}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" onerror="this.parentNode.innerHTML='💊'"/>` 
    : p.emoji || '💊';

  $("productModalContent").innerHTML = `
    <div class="product-modal-img">${modalMediaHtml}</div>
    <h2>${p.name}</h2>
    <p class="product-desc">${p.desc || ""}</p>
    <div class="product-price">${p.price} ج.م
      ${p.oldPrice ? `<span class="price-old" style="font-size:15px;color:var(--text-muted)">${p.oldPrice} ج.م</span>` : ""}
    </div>
    ${p.badge ? `<span class="product-badge" style="position:relative;top:auto;right:auto;display:inline-block;margin-bottom:16px">${p.badge}</span>` : ""}
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
$("closeProduct").addEventListener("click", closeProductModal);
$("productOverlay").addEventListener("click", e => { if (e.target === $("productOverlay")) closeProductModal(); });
function closeProductModal() { $("productOverlay").classList.remove("open"); }

// ================================================
//  ORDER FORM
// ================================================
$("prescriptionFile").addEventListener("change", () => {
  const file = $("prescriptionFile").files[0];
  $("fileName").textContent = file ? "📎 " + file.name : "";
});

$("submitOrderBtn").addEventListener("click", async () => {
  const name    = $("orderName").value.trim();
  const phone   = $("orderPhone").value.trim();
  const address = $("orderAddress").value.trim();
  const notes   = $("orderNotes").value.trim();

  if (!name || !phone || !address) {
    showToast("⚠️ من فضلك ادخل اسمك وهاتفك وعنوانك", "error");
    return;
  }

  const btn = $("submitOrderBtn");
  btn.disabled = true;
  btn.textContent = "جاري الإرسال...";

  try {
    await fsAdd("prescriptionOrders", { name, phone, address, notes, userId: currentUser?.uid || null, status: "pending" });
    showToast("✅ تم إرسال طلبك! سنتصل بك خلال دقائق 🎉");
    ["orderName","orderPhone","orderAddress","orderNotes"].forEach(id => $(id).value = "");
    $("fileName").textContent = "";
  } catch (e) {
    showToast("✅ تم استلام طلبك بنجاح (وضع تجريبي)");
  } finally {
    btn.disabled = false;
    btn.textContent = "إرسال الطلب الآن";
  }
});

// ================================================
//  CONTACT FORM
// ================================================
$("sendContactBtn").addEventListener("click", async () => {
  const name    = $("cName").value.trim();
  const email   = $("cEmail").value.trim();
  const message = $("cMessage").value.trim();

  if (!name || !message) { showToast("⚠️ الاسم والرسالة مطلوبان", "error"); return; }

  try {
    await fsAdd("contactMessages", {
      name, email,
      phone:   $("cPhone").value.trim(),
      subject: $("cSubject").value.trim(),
      message
    });
    showToast("✅ وصلتنا رسالتك! هنرد عليك قريباً 💬");
    ["cName","cEmail","cPhone","cSubject","cMessage"].forEach(id => $(id).value = "");
  } catch (e) {
    showToast("✅ تم استلام رسالتك (وضع تجريبي)");
  }
});

// ================================================
//  NEWSLETTER
// ================================================
$("subscribeBtn").addEventListener("click", async () => {
  const email = $("newsletterEmail").value.trim();
  if (!email || !email.includes("@")) { showToast("⚠️ أدخل بريدك الإلكتروني الصحيح", "error"); return; }
  try {
    await fsAdd("newsletter", { email });
    showToast("🎉 تم تسجيلك في قائمة العروض!");
    $("newsletterEmail").value = "";
  } catch (e) {
    showToast("🎉 تم تسجيلك في قائمة العروض! (وضع تجريبي)");
    $("newsletterEmail").value = "";
  }
});

// ================================================
//  AUTH MODAL
// ================================================
function openAuthModal() {
  $("authOverlay").classList.add("open");
}
function closeAuthModal() {
  $("authOverlay").classList.remove("open");
  $("loginError").textContent = "";
  $("registerError").textContent = "";
}

$("authBtn").addEventListener("click", () => {
  if (currentUser && firebaseReady) { auth.signOut(); showToast("👋 تم تسجيل الخروج"); }
  else openAuthModal();
});
$("closeAuth").addEventListener("click", closeAuthModal);
$("authOverlay").addEventListener("click", e => { if (e.target === $("authOverlay")) closeAuthModal(); });

// Tabs
$("tabLogin").addEventListener("click", () => {
  $("tabLogin").classList.add("active"); $("tabRegister").classList.remove("active");
  $("loginForm").classList.remove("hidden"); $("registerForm").classList.add("hidden");
});
$("tabRegister").addEventListener("click", () => {
  $("tabRegister").classList.add("active"); $("tabLogin").classList.remove("active");
  $("registerForm").classList.remove("hidden"); $("loginForm").classList.add("hidden");
});

// Password toggle
$("toggleLoginPwd").addEventListener("click", () => {
  const i = $("loginPassword");
  i.type = i.type === "password" ? "text" : "password";
});
$("toggleRegPwd").addEventListener("click", () => {
  const i = $("regPassword");
  i.type = i.type === "password" ? "text" : "password";
});

// Password strength
$("regPassword").addEventListener("input", function () {
  const v   = this.value;
  const bar = $("pwdStrength");
  if (!v.length)    { bar.className = "password-strength"; return; }
  if (v.length < 6) { bar.className = "password-strength strength-weak"; return; }
  if (v.length < 10 || !/[0-9]/.test(v)) { bar.className = "password-strength strength-med"; return; }
  bar.className = "password-strength strength-strong";
});

// ── LOGIN ──
$("loginBtn").addEventListener("click", async () => {
  const email    = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const errEl    = $("loginError");
  errEl.textContent = "";

  if (!email)          { errEl.textContent = "⚠️ أدخل البريد الإلكتروني"; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "⚠️ بريد إلكتروني غير صحيح"; return; }
  if (password.length < 6) { errEl.textContent = "⚠️ كلمة المرور أقل من 6 أحرف"; return; }
  if (!firebaseReady)  { showToast("⚠️ Firebase غير مفعل – وضع تجريبي", "error"); closeAuthModal(); return; }

  const btn = $("loginBtn");
  btn.disabled = true; btn.textContent = "جاري التحقق...";
  try {
    await auth.signInWithEmailAndPassword(email, password);
    closeAuthModal();
    showToast("🎉 أهلاً بك مجدداً!");
  } catch (e) {
    errEl.textContent = getAuthError(e.code);
  } finally {
    btn.disabled = false; btn.textContent = "تسجيل الدخول";
  }
});

// ── REGISTER ──
$("registerBtn").addEventListener("click", async () => {
  const name     = $("regName").value.trim();
  const email    = $("regEmail").value.trim();
  const phone    = $("regPhone").value.trim();
  const password = $("regPassword").value;
  const confirm  = $("regConfirm").value;
  const errEl    = $("registerError");
  errEl.textContent = "";

  if (!name)           { errEl.textContent = "⚠️ أدخل اسمك الكامل"; return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "⚠️ بريد إلكتروني غير صحيح"; return; }
  if (!phone || phone.length < 11) { errEl.textContent = "⚠️ رقم الهاتف غير صحيح (11 رقم)"; return; }
  if (password.length < 6)         { errEl.textContent = "⚠️ كلمة المرور أقل من 6 أحرف"; return; }
  if (password !== confirm)         { errEl.textContent = "⚠️ كلمتا المرور غير متطابقتين"; return; }
  if (!firebaseReady)  { showToast("⚠️ Firebase غير مفعل – وضع تجريبي", "error"); closeAuthModal(); return; }

  const btn = $("registerBtn");
  btn.disabled = true; btn.textContent = "جاري الإنشاء...";
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await fsSet("users", cred.user.uid, { name, email, phone, role: "customer", createdAt: new Date().toISOString() });
    closeAuthModal();
    showToast(`🎉 أهلاً ${name}! تم إنشاء حسابك بنجاح`);
  } catch (e) {
    errEl.textContent = getAuthError(e.code);
  } finally {
    btn.disabled = false; btn.textContent = "إنشاء الحساب";
  }
});

// ── GOOGLE ──
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
$("googleLoginBtn").addEventListener("click", googleSignIn);
$("googleRegBtn").addEventListener("click",   googleSignIn);

// ── FORGOT PASSWORD ──
$("forgotPwdLink").addEventListener("click", async e => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  if (!email) { $("loginError").textContent = "⚠️ أدخل بريدك الإلكتروني أولاً"; return; }
  if (!firebaseReady) { showToast("⚠️ Firebase غير مفعل", "error"); return; }
  try {
    await auth.sendPasswordResetEmail(email);
    showToast("📧 تم إرسال رابط إعادة تعيين كلمة المرور!");
  } catch (e) {
    $("loginError").textContent = getAuthError(e.code);
  }
});

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

// ================================================
//  INIT & DOM READY (ضع هذا البلوك في آخر ملف app.js)
// ================================================
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. زرار لوحة التحكم للمسؤولين
  const dashBtn = document.getElementById("goToDashBtn");
  if (dashBtn) {
    dashBtn.addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });
  }

  // 2. زرار إتمام الشراء الأساسي جوه السلة
  if ($("checkoutBtn")) {
    $("checkoutBtn").addEventListener("click", async () => {
      if (!currentUser) {
        showToast("⚠️ سجل دخولك أولاً لإتمام الشراء", "error");
        closeCart();
        openAuthModal();
        return;
      }
      if (!cart.length) return;

      if ($("checkoutAddressOverlay")) {
        $("checkoutAddressOverlay").classList.remove("hidden");
        loadUserAddresses(); // استدعاء دالة جلب العناوين
      } else {
        alert("⚠️ تنبيه للمطور: كود الـ HTML الخاص بمودال الشحن لسه مش موجود جوه index.html أو الـ ID مكتوب غلط!");
      }
    });
  }

  // 3. زرار إغلاق مودال العناوين
  if ($("closeAddressModal")) {
    $("closeAddressModal").addEventListener("click", () => {
      if ($("checkoutAddressOverlay")) $("checkoutAddressOverlay").classList.add("hidden");
    });
  }

  // 4. مراقبة تغيير الـ Select (عنوان قديم أم جديد)
  if ($("addressSelector")) {
    $("addressSelector").addEventListener("change", function() {
      if ($("newAddressFields")) {
        if (this.value === "new") {
          $("newAddressFields").classList.remove("hidden");
        } else {
          $("newAddressFields").classList.add("hidden");
        }
      }
    });
  }

  // 5. زرار التأكيد النهائي وإرسال الأوردر للـ Firebase
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
          if (errorEl) errorEl.textContent = "⚠️ من فضلك املا كل الحقول المطلوبة للعنوان الجديد";
          return;
        }
        if (phone.length < 11) {
          if (errorEl) errorEl.textContent = "⚠️ رقم الهاتف يجب أن يكون 11 رقم على الأقل";
          return;
        }

        finalShippingData = { name, phone, addressDetail };

        if ($("saveAddressCheck") && $("saveAddressCheck").checked && firebaseReady) {
          try {
            await db.collection("users").doc(currentUser.uid).update({
              addresses: firebase.firestore.FieldValue.arrayUnion(finalShippingData)
            });
          } catch (err) {
            console.warn("فشل حفظ العنوان:", err.message);
          }
        }
      } else {
        finalShippingData = userSavedAddresses[parseInt(selectValue)];
      }

      try {
        $("confirmOrderBtn").disabled = true;
        $("confirmOrderBtn").textContent = "جاري تأكيد طلبك...";

        if (firebaseReady) {
          await db.collection("orders").add({
            userId:       currentUser.uid,
            userEmail:    currentUser.email,
            shippingInfo: finalShippingData, 
            items:        cart,
            total:        cart.reduce((s, i) => s + i.price * i.qty, 0),
            status:       "pending",
            createdAt:    firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        cart = [];
        saveCart(); updateCartCount(); renderCart(); closeCart();
        if ($("checkoutAddressOverlay")) $("checkoutAddressOverlay").classList.add("hidden");
        
        ['shipName', 'shipPhone', 'shipAddress'].forEach(id => {
          if ($(id)) $(id).value = "";
        });
        
        showToast("🎉 تم إرسال طلبك بنجاح! سنتواصل معك قريباً");
      } catch (e) {
        showToast("حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى", "error");
      } finally {
        $("confirmOrderBtn").disabled = false;
        $("confirmOrderBtn").textContent = "تأكيد وإرسال الطلب الآن 🎉";
      }
    });
  }

  // تشغيل الدوال الأساسية المعتادة بالسستم
  initFirebase();
  updateCartCount();
  loadProducts();
});