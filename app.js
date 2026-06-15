// ================================================
//  PharmaCare – app.js  (No ES Modules – works with file://)
//  Firebase loaded via CDN scripts in HTML
// ================================================

// ================================================
//  DEMO PRODUCTS
// ================================================
const DEMO_PRODUCTS = [
  { id:"p1",  name:"فيتامين C 1000mg",            category:"vitamins", price:85,  oldPrice:110, emoji:"💊", desc:"يعزز المناعة ويقاوم الأكسدة – 60 قرص",             badge:"-23%" },
  { id:"p2",  name:"أوميجا 3 Fish Oil",            category:"vitamins", price:125, oldPrice:180, emoji:"🐟", desc:"أحماض دهنية ضرورية لصحة القلب والمفاصل",            badge:"-31%" },
  { id:"p3",  name:"فيتامين D3 5000IU",            category:"vitamins", price:65,  emoji:"☀️", desc:"ضروري لامتصاص الكالسيوم وتقوية العظام" },
  { id:"p4",  name:"كريم SPF 50+ للبشرة",          category:"skincare", price:180, oldPrice:240, emoji:"🧴", desc:"حماية قصوى من الشمس مع ترطيب عميق",                  badge:"-25%" },
  { id:"p5",  name:"سيروم فيتامين سي للوجه",       category:"skincare", price:340, oldPrice:420, emoji:"✨", desc:"يوحد البشرة ويقلل البقع الداكنة – 30ml",             badge:"-19%" },
  { id:"p6",  name:"مرطب نهاري SPF20",             category:"skincare", price:220, emoji:"🌸", desc:"ترطيب يومي خفيف مع حماية من الشمس" },
  { id:"p7",  name:"باناكول أقراص 500mg",          category:"medicine", price:35,  emoji:"💉", desc:"مسكن ألم وخافض حرارة – 24 قرص" },
  { id:"p8",  name:"برومهيكسين شراب للسعال",       category:"medicine", price:55,  emoji:"🧃", desc:"يذيب المخاط ويسهل التنفس – 120ml" },
  { id:"p9",  name:"جهاز قياس ضغط الدم",           category:"devices",  price:650, emoji:"🩺", desc:"جهاز ديجيتال دقيق للاستخدام المنزلي" },
  { id:"p10", name:"ميزان طبي ذكي",                category:"devices",  price:380, emoji:"⚖️", desc:"يقيس الوزن ونسبة الدهون والعضلات" },
  { id:"p11", name:"معجون أسنان Colgate",           category:"dental",   price:45,  emoji:"🦷", desc:"يحارب البكتيريا ويبيض الأسنان – 100ml" },
  { id:"p12", name:"غسول فم مضاد للجراثيم",        category:"dental",   price:75,  emoji:"🫧", desc:"يقتل 99.9% من البكتيريا ويرطب الفم" },
  { id:"p13", name:"شامبو بيبي طبيعي",             category:"baby",     price:95,  emoji:"👶", desc:"لطيف على فروة رأس الرضيع – 200ml" },
  { id:"p14", name:"كريم حفاض للأطفال",            category:"baby",     price:60,  emoji:"🍼", desc:"يحمي من الطفح الجلدي ويرطب بشرة الطفل" },
  { id:"p15", name:"كالسيوم + ماغنيسيوم",          category:"vitamins", price:110, oldPrice:140, emoji:"🦴", desc:"يقوي العظام والأسنان – 60 كبسولة",                   badge:"-21%" },
  { id:"p16", name:"ميزان حرارة رقمي",              category:"devices",  price:120, emoji:"🌡️", desc:"قياس سريع ودقيق في 10 ثوانٍ" },
];

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
      apiKey:            "YOUR_API_KEY",
      authDomain:        "YOUR_AUTH_DOMAIN",
      projectId:         "YOUR_PROJECT_ID",
      storageBucket:     "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MSG_SENDER_ID",
      appId:             "YOUR_APP_ID"
    };

    // Only init if config is real
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
      console.warn("PharmaCare: Firebase config not set – running in demo mode");
      return false;
    }

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
      } else {
        // Seed demo data
        const batch = db.batch();
        DEMO_PRODUCTS.forEach(p => {
          batch.set(db.collection("products").doc(p.id), p);
        });
        await batch.commit();
        allProducts = [...DEMO_PRODUCTS];
      }
    } catch (e) {
      console.warn("Firestore read failed, using demo:", e.message);
      allProducts = [...DEMO_PRODUCTS];
    }
  } else {
    allProducts = [...DEMO_PRODUCTS];
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
//  RENDER PRODUCTS
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
    card.innerHTML = `
      ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
      <div class="product-image">${p.emoji || "💊"}</div>
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
    div.innerHTML = `
      <div class="cart-item-icon">${item.emoji || "💊"}</div>
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

// Checkout
$("checkoutBtn").addEventListener("click", async () => {
  if (!currentUser) {
    showToast("⚠️ سجل دخولك أولاً لإتمام الشراء", "error");
    closeCart();
    openAuthModal();
    return;
  }
  if (!cart.length) return;
  try {
    if (firebaseReady) {
      await fsAdd("orders", {
        userId:    currentUser.uid,
        userEmail: currentUser.email,
        items:     cart,
        total:     cart.reduce((s, i) => s + i.price * i.qty, 0),
        status:    "pending"
      });
    }
    cart = [];
    saveCart(); updateCartCount(); renderCart(); closeCart();
    showToast("🎉 تم إرسال طلبك بنجاح! سنتواصل معك قريباً");
  } catch (e) {
    showToast("حدث خطأ، حاول مرة أخرى", "error");
  }
});

// ================================================
//  PRODUCT MODAL
// ================================================
function openProductModal(p) {
  $("productModalContent").innerHTML = `
    <div class="product-modal-img">${p.emoji || "💊"}</div>
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
//  INIT
// ================================================
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  updateCartCount();
  loadProducts();
});