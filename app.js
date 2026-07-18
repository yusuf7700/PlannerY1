// =====================================================================
// PlannerY v3 — professional rebuild
// Firebase (Google Login + Firestore cloud storage + login history)
// Loaded dynamically & safely: if Firebase fails to load (no server,
// bad config, offline, etc.) the rest of the app keeps working locally.
// =====================================================================

let firebaseApp = null;
let auth = null;
let db = null;
let ADMIN_EMAILS = [];
let firebaseReady = false;

// firebase function references — filled in once loaded, no-ops until then
let GoogleAuthProvider = function () {};
let signInWithPopup = async () => { throw new Error("Firebase hali ulanmagan"); };
let signInWithRedirect = async () => { throw new Error("Firebase hali ulanmagan"); };
let getRedirectResult = async () => null;
let onAuthStateChangedFn = () => {};
let signOutFn = async () => {};
let collectionFn = () => null;
let docFn = () => null;
let setDocFn = async () => {};
let deleteDocFn = async () => {};
let onSnapshotFn = () => () => {};
let queryFn = () => null;
let orderByFn = () => null;
let limitFn = () => null;
let serverTimestampFn = () => null;

async function initFirebase() {
  try {
    const [appMod, authMod, fsMod, cfgMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js"),
      import("./firebase-config.js"),
    ]);

    ADMIN_EMAILS = cfgMod.ADMIN_EMAILS || [];
    firebaseApp = appMod.initializeApp(cfgMod.firebaseConfig);
    auth = authMod.getAuth(firebaseApp);
    db = fsMod.getFirestore(firebaseApp);

    GoogleAuthProvider = authMod.GoogleAuthProvider;
    signInWithPopup = authMod.signInWithPopup;
    signInWithRedirect = authMod.signInWithRedirect;
    getRedirectResult = authMod.getRedirectResult;
    onAuthStateChangedFn = authMod.onAuthStateChanged;
    signOutFn = authMod.signOut;
    collectionFn = fsMod.collection;
    docFn = fsMod.doc;
    setDocFn = fsMod.setDoc;
    deleteDocFn = fsMod.deleteDoc;
    onSnapshotFn = fsMod.onSnapshot;
    queryFn = fsMod.query;
    orderByFn = fsMod.orderBy;
    limitFn = fsMod.limit;
    serverTimestampFn = fsMod.serverTimestamp;

    firebaseReady = true;
    window.dispatchEvent(new Event("plannery-firebase-ready"));
  } catch (err) {
    firebaseReady = false;
    console.warn("Firebase ulanmadi — ilova faqat lokal (shu qurilma) rejimida ishlaydi.", err);
  }
}

initFirebase();

(function () {
  "use strict";

  /* ---------------------------------------------------------------
     HELPERS
  --------------------------------------------------------------- */

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayISO = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  function formatMoney(n) {
    return Math.round(n).toLocaleString("uz-UZ");
  }

  const CATEGORY_COLORS = {
    "Oziq-ovqat": "#4F3A93",
    "Transport": "#F2B134",
    "Kommunal": "#2F9E68",
    "Ko'ngilochar": "#E5484D",
    "Boshqa": "#8A8798",
  };

  /* ---------------------------------------------------------------
     TOAST
  --------------------------------------------------------------- */

  const toast = qs("#toast");
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  /* ---------------------------------------------------------------
     STATE (localStorage now — swapped for Firestore in phase 2)
  --------------------------------------------------------------- */

  const Store = {
    get(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };

  let tasks = Store.get("plannerY_tasks", []);
  let expenses = Store.get("plannerY_expenses", []);
  let goals = Store.get("plannerY_goals", []);
  let user = Store.get("plannerY_user", null); // { name, method: 'local' | 'google', email?, photo? }

  function saveTasks() { Store.set("plannerY_tasks", tasks); renderAll(); }
  function saveExpenses() { Store.set("plannerY_expenses", expenses); renderAll(); }
  function saveGoals() { Store.set("plannerY_goals", goals); renderGoals(); }
  function saveUser() { Store.set("plannerY_user", user); }

  /* ---------------------------------------------------------------
     AUTH / USER
  --------------------------------------------------------------- */

  const authModal = qs("#authModal");
  const nameInput = qs("#nameInput");
  const saveNameBtn = qs("#saveName");
  const googleLoginBtn = qs("#googleLoginBtn");
  const welcomeText = qs("#welcomeText");
  const userNameEl = qs("#userName");
  const avatarEl = qs("#avatar");
  const dateEyebrow = qs("#dateEyebrow");
  const cloudConnectBtn = qs("#cloudConnectBtn");
  const cloudStatusText = qs("#cloudStatusText");
  const syncPillSide = qs("#syncPillSide");
  const adminTableBody = qs("#adminTableBody");

  let authMode = "login"; // 'login' | 'rename'

  function openAuthModal(mode) {
    authMode = mode;
    if (mode === "rename") {
      qs(".modal-eyebrow").textContent = "Profil";
      qs("#authModal h2").textContent = "Ismingizni yangilang";
      qs("#authModal .modal-box > p").textContent = "Yangi ismingizni kiriting.";
      googleLoginBtn.parentElement.querySelectorAll(".google-btn, .modal-divider").forEach(el => el.classList.add("hidden"));
      qs(".modal-note").classList.add("hidden");
      nameInput.value = user ? user.name : "";
      saveNameBtn.textContent = "Saqlash";
    } else {
      qs(".modal-eyebrow").textContent = "Boshlashdan oldin";
      qs("#authModal h2").textContent = "PlannerY'ga xush kelibsiz";
      qs("#authModal .modal-box > p").textContent = "Kunlaringizni tartibga soling — vazifalar, xarajatlar va kalendar bir joyda.";
      googleLoginBtn.parentElement.querySelectorAll(".google-btn, .modal-divider").forEach(el => el.classList.remove("hidden"));
      qs(".modal-note").classList.remove("hidden");
      nameInput.value = "";
      saveNameBtn.textContent = "Davom etish";
    }
    authModal.classList.remove("hidden");
    setTimeout(() => nameInput.focus(), 250);
  }

  function closeAuthModal() {
    authModal.classList.add("hidden");
  }

  const adminCard = qs("#adminCard");

  function applyUserToUI() {
    if (!user) return;
    closeAuthModal();
    welcomeText.textContent = `Assalomu alaykum, ${user.name} 👋`;
    userNameEl.textContent = user.name;
    avatarEl.textContent = user.name.charAt(0).toUpperCase();
    avatarEl.style.backgroundImage = "";
    if (user.photo) {
      avatarEl.style.backgroundImage = `url(${user.photo})`;
      avatarEl.textContent = "";
    }
    adminCard.classList.toggle("hidden", !isAdmin());
    renderAdminTable();
    updateCloudUI();
  }

  function updateCloudUI() {
    const connected = user && user.method === "google";
    syncPillSide.textContent = connected ? "☁️ Bulutda" : "💾 Lokal";
    cloudStatusText.textContent = connected
      ? "Ma'lumotlaringiz Google hisobingiz orqali bulutda saqlanmoqda."
      : "Hozircha faqat shu qurilmada saqlanmoqda. Google orqali kiring — bulutga ulanadi.";
    cloudConnectBtn.textContent = connected ? "Ulangan ✓" : "Ulash";
  }

  function renderAdminTable() {
    if (!user) return;
    if (cloudMode() && !isAdmin()) {
      adminTableBody.innerHTML = `<tr><td colspan="3" class="empty-row">Bu jadval faqat administrator uchun. (${user.email})</td></tr>`;
      return;
    }
    if (cloudMode() && isAdmin()) return; // loadAdminLogins() fills this via onSnapshot
    const rows = [
      {
        name: user.name,
        time: new Date().toLocaleString("uz-UZ"),
        source: "Lokal",
      },
    ];
    adminTableBody.innerHTML = rows
      .map(
        (r) => `<tr><td>${r.name}</td><td>${r.time}</td><td>${r.source}</td></tr>`
      )
      .join("");
  }

  saveNameBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast("Ismingizni kiriting ✍️");
      return;
    }
    if (authMode === "rename") {
      user.name = name;
      saveUser();
      applyUserToUI();
      if (cloudMode()) writeUserProfile();
      showToast("Ism yangilandi ✨");
    } else {
      user = { name, method: "local" };
      saveUser();
      applyUserToUI();
      showToast("Xush kelibsiz 😊");
    }
    closeAuthModal();
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveNameBtn.click();
  });

  const logoutBtn = qs("#logoutBtn");
  const profileMethodText = qs("#profileMethodText");

  function isAdmin() {
    return !!(user && user.email && ADMIN_EMAILS.includes(user.email));
  }

  function cloudMode() {
    return !!(user && user.method === "google" && firebaseReady);
  }

  googleLoginBtn.addEventListener("click", async () => {
    if (!firebaseReady) {
      showToast("☁️ Bulut ulanishi hali tayyor emas. Lokal serverda (Live Server) ochganingizga ishonch hosil qiling.");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged handles the rest
    } catch (err) {
      const popupIssue = [
        "auth/popup-blocked",
        "auth/popup-closed-by-user",
        "auth/cancelled-popup-request",
        "auth/operation-not-supported-in-this-environment",
      ].includes(err.code);

      if (popupIssue) {
        // Mobile browsers (Safari, in-app browsers, etc.) often block
        // popups — fall back to a full-page redirect instead.
        try {
          await signInWithRedirect(auth, provider);
        } catch (err2) {
          console.error(err2);
          showToast("Kirishda xatolik: " + (err2.code || err2.message));
        }
      } else {
        console.error(err);
        showToast("Kirishda xatolik: " + (err.code || err.message));
      }
    }
  });

  cloudConnectBtn.addEventListener("click", () => {
    if (cloudMode()) return;
    googleLoginBtn.click();
  });

  logoutBtn.addEventListener("click", async () => {
    stopCloudSync();
    if (firebaseReady && auth && auth.currentUser) {
      await signOutFn(auth);
    }
    user = null;
    Store.set("plannerY_user", null);
    tasks = [];
    expenses = [];
    goals = [];
    renderAll();
    openAuthModal("login");
  });

  qs("#editNameBtn").addEventListener("click", () => openAuthModal("rename"));
  qs("#profileBtn").addEventListener("click", () => openAuthModal("rename"));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !authModal.classList.contains("hidden") && user) {
      closeAuthModal();
    }
  });

  // ---- Firebase Auth state ----
  // Registered only once Firebase has actually finished loading (see
  // initFirebase() at the top). If Firebase never loads (no server,
  // offline, bad config) the app simply stays in local mode — nothing
  // else breaks.
  function registerAuthWatcher() {
    onAuthStateChangedFn(auth, (fbUser) => {
      if (fbUser) {
        user = {
          name: fbUser.displayName || "Foydalanuvchi",
          method: "google",
          email: fbUser.email,
          photo: fbUser.photoURL || null,
          uid: fbUser.uid,
        };
        saveUser();
        applyUserToUI();
        logoutBtn.classList.remove("hidden");
        profileMethodText.textContent = `Google orqali kirgan: ${fbUser.email}`;
        closeAuthModal();
        writeUserProfile();
        recordLogin(fbUser);
        startCloudSync(fbUser.uid);
        if (isAdmin()) loadAdminLogins();
        showToast("Google orqali kirdingiz ☁️");
      } else {
        logoutBtn.classList.add("hidden");
        profileMethodText.textContent = "Ismingizni o'zgartiring.";
        // fall back to whatever local user (if any) was previously saved
        if (user && user.method === "google") user = null;
        const localUser = Store.get("plannerY_user", null);
        if (localUser && localUser.method === "local") {
          user = localUser;
          applyUserToUI();
        } else if (!user) {
          openAuthModal("login");
        }
      }
    });
  }

  if (firebaseReady) {
    registerAuthWatcher();
  } else {
    window.addEventListener("plannery-firebase-ready", registerAuthWatcher, { once: true });
  }

  // Surface any error from a redirect-based sign-in (mobile fallback).
  // A successful redirect is already handled by onAuthStateChanged above.
  (async () => {
    if (!firebaseReady) {
      await new Promise((resolve) => window.addEventListener("plannery-firebase-ready", resolve, { once: true }));
    }
    try {
      await getRedirectResult(auth);
    } catch (err) {
      console.error("redirect natijasi xatosi", err);
      showToast("Kirishda xatolik: " + (err.code || err.message));
    }
  })();

  // Show whatever we already have cached locally RIGHT AWAY — this never
  // waits on Firebase, so the app is instantly usable even if the cloud
  // connection is slow, broken, or unavailable.
  if (user) {
    applyUserToUI();
  } else {
    openAuthModal("login");
  }

  /* ---------------------------------------------------------------
     FIRESTORE — cloud sync (only active when signed in with Google)
  --------------------------------------------------------------- */

  let unsubTasks = null;
  let unsubExpenses = null;
  let unsubGoals = null;

  function writeUserProfile() {
    if (!user || !user.uid) return;
    setDocFn(
      docFn(db, "users", user.uid),
      { name: user.name, email: user.email, photo: user.photo || null },
      { merge: true }
    ).catch((e) => console.error("profile yozishda xato", e));
  }

  function recordLogin(fbUser) {
    setDocFn(docFn(collectionFn(db, "logins")), {
      uid: fbUser.uid,
      name: fbUser.displayName || "Foydalanuvchi",
      email: fbUser.email,
      photo: fbUser.photoURL || null,
      timestamp: serverTimestampFn(),
    }).catch((e) => console.error("login yozishda xato", e));
  }

  function startCloudSync(uid) {
    stopCloudSync();

    unsubTasks = onSnapshotFn(
      collectionFn(db, "users", uid, "tasks"),
      (snap) => {
        tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderAll();
      },
      (err) => console.error("tasks sync xatosi", err)
    );

    unsubExpenses = onSnapshotFn(
      collectionFn(db, "users", uid, "expenses"),
      (snap) => {
        expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderAll();
      },
      (err) => console.error("expenses sync xatosi", err)
    );

    unsubGoals = onSnapshotFn(
      collectionFn(db, "users", uid, "goals"),
      (snap) => {
        goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderGoals();
      },
      (err) => console.error("goals sync xatosi", err)
    );
  }

  function stopCloudSync() {
    if (unsubTasks) { unsubTasks(); unsubTasks = null; }
    if (unsubExpenses) { unsubExpenses(); unsubExpenses = null; }
    if (unsubGoals) { unsubGoals(); unsubGoals = null; }
  }

  function loadAdminLogins() {
    const q = queryFn(collectionFn(db, "logins"), orderByFn("timestamp", "desc"), limitFn(50));
    onSnapshotFn(q, (snap) => {
      const rows = snap.docs.map((d) => d.data());
      if (!rows.length) return;
      adminTableBody.innerHTML = rows
        .map((r) => {
          const t = r.timestamp && r.timestamp.toDate ? r.timestamp.toDate().toLocaleString("uz-UZ") : "—";
          return `<tr><td>${r.name || ""} <span style="color:var(--ink-soft);font-size:12px;">(${r.email || ""})</span></td><td>${t}</td><td>Google</td></tr>`;
        })
        .join("");
    });
  }

  /* ---------------------------------------------------------------
     NAVIGATION + MOBILE DRAWER
  --------------------------------------------------------------- */

  const navLinks = qsa("#mainNav a");
  const views = qsa(".view");
  const sidebar = qs("#sidebar");
  const sidebarOverlay = qs("#sidebarOverlay");
  const hamburgerBtn = qs("#hamburgerBtn");
  const drawerClose = qs("#drawerClose");

  function openDrawer() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
  }
  function closeDrawer() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
  }
  hamburgerBtn.addEventListener("click", openDrawer);
  drawerClose.addEventListener("click", closeDrawer);
  sidebarOverlay.addEventListener("click", closeDrawer);

  function switchView(target) {
    views.forEach((v) => v.classList.toggle("active", v.id === `view-${target}`));
    navLinks.forEach((a) => a.classList.toggle("active", a.dataset.target === target));
    if (target === "calendar") renderCalendar();
    if (target === "stats") renderStats();
    if (target === "goals") renderGoals();
    closeDrawer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  qsa("[data-target]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      switchView(el.dataset.target);
    });
  });

  /* ---------------------------------------------------------------
     TASKS
  --------------------------------------------------------------- */

  const taskInput = qs("#taskInput");
  const taskDateInput = qs("#taskDate");
  const addTaskBtn = qs("#addTaskBtn");
  const taskList = qs("#taskList");
  const taskEmptyHint = qs("#taskEmptyHint");
  const dashTaskPreview = qs("#dashTaskPreview");

  const totalTasksEl = qs("#totalTasks");
  const completedTasksEl = qs("#completedTasks");
  const remainingTasksEl = qs("#remainingTasks");
  const progressPercentEl = qs("#progressPercent");
  const dialFill = qs("#dialFill");

  taskDateInput.value = todayISO();
  let taskFilter = "all";

  qsa(".chip[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      qsa(".chip[data-filter]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      taskFilter = chip.dataset.filter;
      renderTasks();
    });
  });

  function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    const newTask = {
      text,
      date: taskDateInput.value || todayISO(),
      status: "pending",
      createdAt: Date.now(),
    };
    taskInput.value = "";
    taskDateInput.value = todayISO();

    if (cloudMode()) {
      const ref = docFn(collectionFn(db, "users", user.uid, "tasks"));
      setDocFn(ref, newTask).catch((e) => console.error("vazifa yozishda xato", e));
    } else {
      tasks.push({ id: uid(), ...newTask });
      saveTasks();
    }
    showToast("Vazifa qo'shildi ✅");
  }

  addTaskBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });

  // Older tasks (saved before the status system existed) only have a
  // boolean `completed` field — normalize everything to `status` so the
  // rest of the app only ever has to deal with one shape.
  function getStatus(task) {
    if (task.status) return task.status;
    return task.completed ? "done" : "pending";
  }

  const STATUS_LABEL = {
    pending: "✗ Bajarilmadi",
    progress: "⏳ Jarayonda",
    done: "✅ Bajarildi",
  };
  const STATUS_ORDER = { pending: 0, progress: 1, done: 2 };

  function taskRowHTML(task) {
    const status = getStatus(task);
    return `
      <li class="task-item status-${status}" data-id="${task.id}">
        <div class="task-main">
          <span class="task-text">${escapeHTML(task.text)}</span>
          <div class="task-meta">
            <span class="task-date">${formatDatePretty(task.date)}</span>
            <span class="task-status ${status}">${STATUS_LABEL[status]}</span>
          </div>
          <div class="status-toggle">
            <button data-action="setstatus" data-status="pending" class="${status === "pending" ? "active" : ""}" title="Bajarilmadi">✗</button>
            <button data-action="setstatus" data-status="progress" class="${status === "progress" ? "active" : ""}" title="Jarayonda">⏳</button>
            <button data-action="setstatus" data-status="done" class="${status === "done" ? "active" : ""}" title="Bajarildi">✅</button>
          </div>
        </div>
        <div class="actions">
          <button class="delete-btn" data-action="delete">🗑</button>
        </div>
      </li>`;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDatePretty(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (iso === todayISO()) return "Bugun";
    return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
  }

  function renderTasks() {
    let filtered = tasks;
    if (taskFilter === "active") filtered = tasks.filter((t) => getStatus(t) !== "done");
    if (taskFilter === "done") filtered = tasks.filter((t) => getStatus(t) === "done");

    const sorted = [...filtered].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    taskList.innerHTML = sorted.map(taskRowHTML).join("");
    taskEmptyHint.classList.toggle("show", sorted.length === 0);

    // dashboard preview: today's tasks, not-done first
    const today = todayISO();
    const todays = tasks
      .filter((t) => t.date === today)
      .sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)])
      .slice(0, 5);
    dashTaskPreview.innerHTML = todays.length
      ? todays.map(taskRowHTML).join("")
      : `<p class="empty-hint show">Bugunga vazifa yo'q. Vazifalar bo'limidan qo'shing.</p>`;
  }

  taskList.addEventListener("click", (e) => handleTaskAction(e, taskList));
  dashTaskPreview.addEventListener("click", (e) => handleTaskAction(e, dashTaskPreview));

  function handleTaskAction(e, container) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const li = e.target.closest("li[data-id]");
    const id = li.dataset.id;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (btn.dataset.action === "setstatus") {
      const status = btn.dataset.status;
      if (cloudMode()) {
        setDocFn(docFn(db, "users", user.uid, "tasks", id), { status }, { merge: true })
          .catch((e2) => console.error("vazifani belgilashda xato", e2));
      } else {
        task.status = status;
        saveTasks();
      }
    } else if (btn.dataset.action === "delete") {
      if (cloudMode()) {
        deleteDocFn(docFn(db, "users", user.uid, "tasks", id)).catch((e2) => console.error("vazifani o'chirishda xato", e2));
      } else {
        tasks = tasks.filter((t) => t.id !== id);
        saveTasks();
      }
      showToast("Vazifa o'chirildi 🗑");
    }
  }

  function updateTaskStats() {
    // Dashboard progress reflects TODAY only, so it naturally starts
    // fresh at 0% every new day instead of counting all-time tasks.
    const today = todayISO();
    const todaysTasks = tasks.filter((t) => t.date === today);

    const total = todaysTasks.length;
    const completed = todaysTasks.filter((t) => getStatus(t) === "done").length;
    const remaining = total - completed;

    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    remainingTasksEl.textContent = remaining;

    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressPercentEl.textContent = percent + "%";

    const circumference = 376.8; // 2 * PI * 60
    dialFill.style.strokeDashoffset = circumference - (circumference * percent) / 100;

    if (percent === 100 && total > 0 && updateTaskStats._lastPercent !== 100) {
      showToast("🎉 Bugungi barcha vazifalar bajarildi!");
    }
    updateTaskStats._lastPercent = percent;
  }

  /* ---------------------------------------------------------------
     EXPENSES
  --------------------------------------------------------------- */

  const expenseNameInput = qs("#expenseName");
  const expenseAmountInput = qs("#expenseAmount");
  const expenseCategoryInput = qs("#expenseCategory");
  const addExpenseBtn = qs("#addExpenseBtn");
  const expenseList = qs("#expenseList");
  const expenseTotalEl = qs("#expenseTotal");
  const expenseEmptyHint = qs("#expenseEmptyHint");
  const dashExpensePreview = qs("#dashExpensePreview");
  const todayExpenseMini = qs("#todayExpenseMini");

  function addExpense() {
    const name = expenseNameInput.value.trim();
    const amount = parseFloat(expenseAmountInput.value);
    if (!name || !amount || amount <= 0) {
      showToast("To'liq ma'lumot kiriting");
      return;
    }
    const newExpense = {
      name,
      amount,
      category: expenseCategoryInput.value,
      date: todayISO(),
      createdAt: Date.now(),
    };
    expenseNameInput.value = "";
    expenseAmountInput.value = "";

    if (cloudMode()) {
      const ref = docFn(collectionFn(db, "users", user.uid, "expenses"));
      setDocFn(ref, newExpense).catch((e) => console.error("xarajat yozishda xato", e));
    } else {
      expenses.push({ id: uid(), ...newExpense });
      saveExpenses();
    }
    showToast("Xarajat qo'shildi 💰");
  }

  addExpenseBtn.addEventListener("click", addExpense);
  expenseAmountInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addExpense(); });

  function expenseRowHTML(item) {
    const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Boshqa"];
    return `
      <li class="expense-row" data-id="${item.id}">
        <div class="exp-main">
          <span class="exp-cat-dot" style="background:${color}"></span>
          <div>
            <div class="exp-name">${escapeHTML(item.name)}</div>
            <div class="exp-cat">${item.category}</div>
          </div>
        </div>
        <div class="expense-row-inner">
          <strong>${formatMoney(item.amount)} so'm</strong>
          <button class="exp-del" data-action="delete" title="O'chirish">🗑</button>
        </div>
      </li>`;
  }

  function renderExpenses() {
    const today = todayISO();
    const todays = expenses.filter((e) => e.date === today);
    expenseList.innerHTML = todays.map(expenseRowHTML).join("");
    expenseEmptyHint.classList.toggle("show", todays.length === 0);

    const total = todays.reduce((sum, e) => sum + e.amount, 0);
    expenseTotalEl.textContent = formatMoney(total);
    todayExpenseMini.textContent = formatMoney(total) + " so'm";

    const recent = [...expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    dashExpensePreview.innerHTML = recent.length
      ? recent.map(expenseRowHTML).join("")
      : `<p class="empty-hint show">Hali xarajat qo'shilmagan.</p>`;
  }

  expenseList.addEventListener("click", (e) => handleExpenseDelete(e));
  dashExpensePreview.addEventListener("click", (e) => handleExpenseDelete(e));

  function handleExpenseDelete(e) {
    const btn = e.target.closest("button[data-action='delete']");
    if (!btn) return;
    const li = e.target.closest("li[data-id]");
    const id = li.dataset.id;

    if (cloudMode()) {
      deleteDocFn(docFn(db, "users", user.uid, "expenses", id)).catch((e2) => console.error("xarajatni o'chirishda xato", e2));
    } else {
      expenses = expenses.filter((x) => x.id !== id);
      saveExpenses();
    }
    showToast("Xarajat o'chirildi 🗑");
  }

  /* ---------------------------------------------------------------
     CALENDAR
  --------------------------------------------------------------- */

  const calGrid = qs("#calGrid");
  const calendarTitle = qs("#calendarTitle");
  const calPrev = qs("#calPrev");
  const calNext = qs("#calNext");
  const calToday = qs("#calToday");
  const calDayTitle = qs("#calDayTitle");
  const calDayTasks = qs("#calDayTasks");
  const calEmptyHint = qs("#calEmptyHint");

  const AY_NOMLARI = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];

  let calCursor = new Date();
  let selectedDate = todayISO();

  function isoOf(y, m, d) {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  function renderCalendar() {
    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    calendarTitle.textContent = `${AY_NOMLARI[m]} ${y}`;

    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, muted: true, iso: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, muted: false, iso: isoOf(y, m, d) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: cells.length - (firstDay + daysInMonth) + 1, muted: true, iso: null });
    }

    const today = todayISO();
    calGrid.innerHTML = cells
      .map((c) => {
        const classes = ["cal-day"];
        if (c.muted) classes.push("muted");
        if (c.iso === today) classes.push("today");
        if (c.iso === selectedDate) classes.push("selected");
        const hasTasks = c.iso && tasks.some((t) => t.date === c.iso);
        return `<div class="${classes.join(" ")}" data-iso="${c.iso || ""}">
          <span>${c.day}</span>
          ${hasTasks ? '<span class="dot"></span>' : ""}
        </div>`;
      })
      .join("");

    renderCalDay();
  }

  calGrid.addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-day");
    if (!cell || !cell.dataset.iso) return;
    selectedDate = cell.dataset.iso;
    renderCalendar();
  });

  function renderCalDay() {
    const d = new Date(selectedDate + "T00:00:00");
    calDayTitle.textContent = d.toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long" });
    const dayTasks = tasks.filter((t) => t.date === selectedDate);
    calDayTasks.innerHTML = dayTasks.map(taskRowHTML).join("");
    calEmptyHint.classList.toggle("show", dayTasks.length === 0);
  }

  calDayTasks.addEventListener("click", (e) => handleTaskAction(e, calDayTasks));

  calPrev.addEventListener("click", () => {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalendar();
  });
  calNext.addEventListener("click", () => {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalendar();
  });
  calToday.addEventListener("click", () => {
    calCursor = new Date();
    selectedDate = todayISO();
    renderCalendar();
  });

  /* ---------------------------------------------------------------
     GOALS
  --------------------------------------------------------------- */

  const goalInput = qs("#goalInput");
  const goalPeriodInput = qs("#goalPeriod");
  const addGoalBtn = qs("#addGoalBtn");
  const goalList = qs("#goalList");
  const goalEmptyHint = qs("#goalEmptyHint");

  let goalFilter = "all";

  qsa("#goalFilters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      qsa("#goalFilters .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      goalFilter = chip.dataset.filter;
      renderGoals();
    });
  });

  function addGoal() {
    const title = goalInput.value.trim();
    if (!title) return;
    const newGoal = {
      title,
      period: goalPeriodInput.value,
      progress: 0,
      createdAt: Date.now(),
    };
    goalInput.value = "";

    if (cloudMode()) {
      const ref = docFn(collectionFn(db, "users", user.uid, "goals"));
      setDocFn(ref, newGoal).catch((e) => console.error("maqsad yozishda xato", e));
    } else {
      goals.push({ id: uid(), ...newGoal });
      saveGoals();
    }
    showToast("Maqsad qo'shildi 🎯");
  }

  addGoalBtn.addEventListener("click", addGoal);
  goalInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addGoal(); });

  function setGoalProgress(id, progress) {
    progress = Math.max(0, Math.min(100, progress));
    if (cloudMode()) {
      setDocFn(docFn(db, "users", user.uid, "goals", id), { progress }, { merge: true })
        .catch((e) => console.error("maqsadni yangilashda xato", e));
    } else {
      const g = goals.find((x) => x.id === id);
      if (g) { g.progress = progress; saveGoals(); }
    }
  }

  function deleteGoal(id) {
    if (cloudMode()) {
      deleteDocFn(docFn(db, "users", user.uid, "goals", id)).catch((e) => console.error("maqsadni o'chirishda xato", e));
    } else {
      goals = goals.filter((g) => g.id !== id);
      saveGoals();
    }
    showToast("Maqsad o'chirildi 🗑");
  }

  function goalRowHTML(g) {
    return `
      <li class="goal-item" data-id="${g.id}">
        <div class="goal-top">
          <span class="goal-title">${escapeHTML(g.title)}</span>
          <span class="goal-period">${g.period}</span>
        </div>
        <div class="goal-progress-row">
          <div class="goal-track"><div class="goal-fill" style="width:${g.progress}%"></div></div>
          <span class="goal-pct">${g.progress}%</span>
        </div>
        <div class="goal-controls">
          <button data-action="dec">−</button>
          <input type="range" min="0" max="100" step="5" value="${g.progress}" data-action="slider">
          <button data-action="inc">+</button>
          <button class="goal-del" data-action="del" title="O'chirish">🗑</button>
        </div>
      </li>`;
  }

  function renderGoals() {
    let filtered = goals;
    if (goalFilter !== "all") filtered = goals.filter((g) => g.period === goalFilter);
    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    goalList.innerHTML = sorted.map(goalRowHTML).join("");
    goalEmptyHint.classList.toggle("show", sorted.length === 0);
  }

  goalList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const li = e.target.closest("li[data-id]");
    const id = li.dataset.id;
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    if (btn.dataset.action === "inc") setGoalProgress(id, g.progress + 10);
    if (btn.dataset.action === "dec") setGoalProgress(id, g.progress - 10);
    if (btn.dataset.action === "del") deleteGoal(id);
  });

  goalList.addEventListener("input", (e) => {
    if (e.target.dataset.action !== "slider") return;
    const li = e.target.closest("li[data-id]");
    setGoalProgress(li.dataset.id, parseInt(e.target.value, 10));
  });

  /* ---------------------------------------------------------------
     STATS
  --------------------------------------------------------------- */

  const streakCountEl = qs("#streakCount");
  const weeklyRateEl = qs("#weeklyRate");
  const weeklyExpenseEl = qs("#weeklyExpense");
  const weeklyBars = qs("#weeklyBars");
  const categoryBars = qs("#categoryBars");

  const KUN_QISQA = ["Yak","Dush","Sesh","Chor","Pay","Jum","Shan"];

  function lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(isoOf(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return out;
  }

  function renderStats() {
    const days = lastNDays(7);

    // weekly completed-task bars
    const counts = days.map((iso) => tasks.filter((t) => t.date === iso && getStatus(t) === "done").length);
    const maxCount = Math.max(1, ...counts);
    weeklyBars.innerHTML = days
      .map((iso, i) => {
        const d = new Date(iso + "T00:00:00");
        const h = Math.round((counts[i] / maxCount) * 100);
        return `<div class="bar-col">
          <div class="bar-fill" style="height:${h}%"></div>
          <span>${KUN_QISQA[d.getDay()]}</span>
        </div>`;
      })
      .join("");

    // weekly rate
    const dayTasksAll = tasks.filter((t) => days.includes(t.date));
    const doneCount = dayTasksAll.filter((t) => getStatus(t) === "done").length;
    const rate = dayTasksAll.length ? Math.round((doneCount / dayTasksAll.length) * 100) : 0;
    weeklyRateEl.textContent = rate + "%";

    // weekly expense
    const weekExpenseSum = expenses.filter((e) => days.includes(e.date)).reduce((s, e) => s + e.amount, 0);
    weeklyExpenseEl.textContent = formatMoney(weekExpenseSum) + " so'm";

    // streak: consecutive days up to today with >=1 completed task
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
      const hasDone = tasks.some((t) => t.date === iso && getStatus(t) === "done");
      if (hasDone) streak++;
      else break;
    }
    streakCountEl.textContent = streak;

    // category breakdown (all-time)
    const byCat = {};
    expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const total = Object.values(byCat).reduce((a, b) => a + b, 0) || 1;
    const catEntries = Object.entries(CATEGORY_COLORS).map(([cat, color]) => ({
      cat, color, amount: byCat[cat] || 0,
    }));

    categoryBars.innerHTML = catEntries
      .map((c) => {
        const pct = Math.round((c.amount / total) * 100);
        return `<div class="cat-row">
          <div class="cat-row-top"><span>${c.cat}</span><span>${formatMoney(c.amount)} so'm</span></div>
          <div class="cat-track"><div class="cat-fill" style="width:${pct}%;background:${c.color}"></div></div>
        </div>`;
      })
      .join("");
  }

  /* ---------------------------------------------------------------
     DARK MODE
  --------------------------------------------------------------- */

  const darkModeSwitch = qs("#darkModeSwitch");
  const darkToggleSide = qs("#darkToggleSide");

  function applyTheme(dark) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    darkModeSwitch.checked = dark;
    darkToggleSide.textContent = dark ? "☀️" : "🌙";
    Store.set("plannerY_theme", dark ? "dark" : "light");
  }

  const savedTheme = Store.get("plannerY_theme", null);
  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme ? savedTheme === "dark" : systemDark);

  darkModeSwitch.addEventListener("change", () => applyTheme(darkModeSwitch.checked));
  darkToggleSide.addEventListener("click", () => applyTheme(document.documentElement.getAttribute("data-theme") !== "dark"));

  /* ---------------------------------------------------------------
     NOTIFICATIONS — daily reminder about today's tasks
  --------------------------------------------------------------- */

  const notifSwitch = qs("#notifSwitch");
  const notifTimeRow = qs("#notifTimeRow");
  const notifTimeInput = qs("#notifTimeInput");

  const notifPrefs = Store.get("plannerY_notif", { enabled: false, time: "09:00", lastFired: null });
  notifSwitch.checked = notifPrefs.enabled;
  notifTimeInput.value = notifPrefs.time || "09:00";
  notifTimeRow.classList.toggle("hidden", !notifPrefs.enabled);

  function saveNotifPrefs() { Store.set("plannerY_notif", notifPrefs); }

  notifSwitch.addEventListener("change", async () => {
    if (notifSwitch.checked) {
      if (!("Notification" in window)) {
        showToast("Brauzeringiz bildirishnomani qo'llab-quvvatlamaydi 😕");
        notifSwitch.checked = false;
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("Bildirishnomaga ruxsat berilmadi ❌");
        notifSwitch.checked = false;
        return;
      }
      notifPrefs.enabled = true;
      notifTimeRow.classList.remove("hidden");
      showToast("Bildirishnomalar yoqildi 🔔");
    } else {
      notifPrefs.enabled = false;
      notifTimeRow.classList.add("hidden");
      showToast("Bildirishnomalar o'chirildi");
    }
    saveNotifPrefs();
  });

  notifTimeInput.addEventListener("change", () => {
    notifPrefs.time = notifTimeInput.value;
    saveNotifPrefs();
  });

  function checkDailyNotification() {
    if (!notifPrefs.enabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = todayISO();

    if (nowHHMM === notifPrefs.time && notifPrefs.lastFired !== today) {
      const todaysTasks = tasks.filter((t) => t.date === today);
      const remaining = todaysTasks.filter((t) => getStatus(t) !== "done").length;
      const body = todaysTasks.length === 0
        ? "Bugunga hali vazifa qo'shmadingiz. PlannerY'ni ochib rejalashtiring!"
        : remaining > 0
        ? `Bugun ${remaining} ta vazifangiz kutmoqda. Omad! 💪`
        : "Bugungi barcha vazifalar bajarilgan, ajoyib! 🎉";

      new Notification("PlannerY — kunlik eslatma", {
        body,
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png",
      });

      notifPrefs.lastFired = today;
      saveNotifPrefs();
    }
  }

  setInterval(checkDailyNotification, 30000);

  /* ---------------------------------------------------------------
     DATE & TIME
  --------------------------------------------------------------- */

  const todayDateHidden = null;
  const liveTime = qs("#liveTime");
  const KUNLAR = ["Yakshanba","Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba"];

  function updateDateTime() {
    const now = new Date();
    dateEyebrow.textContent = `${KUNLAR[now.getDay()]}, ${now.getDate()} ${AY_NOMLARI[now.getMonth()]} ${now.getFullYear()}`;
    liveTime.textContent = now.toLocaleTimeString("uz-UZ");
  }
  updateDateTime();
  setInterval(updateDateTime, 1000);

  /* ---------------------------------------------------------------
     PWA — install prompt + service worker
  --------------------------------------------------------------- */

  let deferredPrompt = null;
  const installPwaBtn = qs("#installPwaBtn");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installPwaBtn.textContent = "O'rnatish";
  });

  installPwaBtn.addEventListener("click", async () => {
    if (!deferredPrompt) {
      showToast("Brauzeringiz avtomatik o'rnatishni qo'llab-quvvatlamaydi. Menyudan 'Bosh ekranga qo'shish'ni tanlang.");
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  /* ---------------------------------------------------------------
     RENDER ALL
  --------------------------------------------------------------- */

  function renderAll() {
    renderTasks();
    updateTaskStats();
    renderExpenses();
    if (qs("#view-calendar").classList.contains("active")) renderCalendar();
    if (qs("#view-stats").classList.contains("active")) renderStats();
    if (qs("#view-goals").classList.contains("active")) renderGoals();
  }

  renderAll();

  console.log("🚀 PlannerY v3 ishga tushdi.");
})();
