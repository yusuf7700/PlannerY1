// =====================================================================
// PlannerY v3 — professional rebuild
// Cloud/Google-login hooks are marked with TODO(firebase) for phase 2.
// =====================================================================

(function () {
  "use strict";

  /* ---------------------------------------------------------------
     HELPERS
  --------------------------------------------------------------- */

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayISO = () => new Date().toISOString().slice(0, 10);

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
  let user = Store.get("plannerY_user", null); // { name, method: 'local' | 'google', email?, photo? }

  function saveTasks() { Store.set("plannerY_tasks", tasks); renderAll(); }
  function saveExpenses() { Store.set("plannerY_expenses", expenses); renderAll(); }
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

  function applyUserToUI() {
    if (!user) return;
    welcomeText.textContent = `Assalomu alaykum, ${user.name} 👋`;
    userNameEl.textContent = user.name;
    avatarEl.textContent = user.name.charAt(0).toUpperCase();
    if (user.photo) {
      avatarEl.style.backgroundImage = `url(${user.photo})`;
      avatarEl.textContent = "";
    }
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
    const rows = [
      {
        name: user.name,
        time: new Date().toLocaleString("uz-UZ"),
        source: user.method === "google" ? "Google" : "Lokal",
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

  // TODO(firebase): replace with signInWithPopup(auth, new GoogleAuthProvider())
  googleLoginBtn.addEventListener("click", () => {
    showToast("Google kirish keyingi bosqichda (Firebase) ulanadi ☁️");
  });

  cloudConnectBtn.addEventListener("click", () => {
    if (user && user.method === "google") return;
    showToast("Google kirish keyingi bosqichda (Firebase) ulanadi ☁️");
  });

  qs("#editNameBtn").addEventListener("click", () => openAuthModal("rename"));
  qs("#profileBtn").addEventListener("click", () => openAuthModal("rename"));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !authModal.classList.contains("hidden") && user) {
      closeAuthModal();
    }
  });

  if (user) {
    applyUserToUI();
  } else {
    openAuthModal("login");
  }

  /* ---------------------------------------------------------------
     NAVIGATION
  --------------------------------------------------------------- */

  const navLinks = qsa("#mainNav a");
  const bottomLinks = qsa("#bottomNav a");
  const views = qsa(".view");

  function switchView(target) {
    views.forEach((v) => v.classList.toggle("active", v.id === `view-${target}`));
    navLinks.forEach((a) => a.classList.toggle("active", a.dataset.target === target));
    bottomLinks.forEach((a) => a.classList.toggle("active", a.dataset.target === target));
    if (target === "calendar") renderCalendar();
    if (target === "stats") renderStats();
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
    tasks.push({
      id: uid(),
      text,
      date: taskDateInput.value || todayISO(),
      completed: false,
      createdAt: Date.now(),
    });
    taskInput.value = "";
    taskDateInput.value = todayISO();
    saveTasks();
    showToast("Vazifa qo'shildi ✅");
  }

  addTaskBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });

  function taskRowHTML(task) {
    return `
      <li class="task-item ${task.completed ? "completed" : ""}" data-id="${task.id}">
        <div class="task-main">
          <span class="task-text">${escapeHTML(task.text)}</span>
          <span class="task-date">${formatDatePretty(task.date)}</span>
        </div>
        <div class="actions">
          <button class="complete-btn" data-action="toggle">✔</button>
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
    if (taskFilter === "active") filtered = tasks.filter((t) => !t.completed);
    if (taskFilter === "done") filtered = tasks.filter((t) => t.completed);

    const sorted = [...filtered].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    taskList.innerHTML = sorted.map(taskRowHTML).join("");
    taskEmptyHint.classList.toggle("show", sorted.length === 0);

    // dashboard preview: today's tasks, incomplete first
    const today = todayISO();
    const todays = tasks
      .filter((t) => t.date === today)
      .sort((a, b) => a.completed - b.completed)
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
    if (btn.dataset.action === "toggle") {
      task.completed = !task.completed;
      saveTasks();
    } else if (btn.dataset.action === "delete") {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      showToast("Vazifa o'chirildi 🗑");
    }
  }

  function updateTaskStats() {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const remaining = total - completed;

    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    remainingTasksEl.textContent = remaining;

    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressPercentEl.textContent = percent + "%";

    const circumference = 376.8; // 2 * PI * 60
    dialFill.style.strokeDashoffset = circumference - (circumference * percent) / 100;

    if (percent === 100 && total > 0 && updateTaskStats._lastPercent !== 100) {
      showToast("🎉 Barcha vazifalar bajarildi!");
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
    expenses.push({
      id: uid(),
      name,
      amount,
      category: expenseCategoryInput.value,
      date: todayISO(),
      createdAt: Date.now(),
    });
    expenseNameInput.value = "";
    expenseAmountInput.value = "";
    saveExpenses();
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
    expenses = expenses.filter((x) => x.id !== li.dataset.id);
    saveExpenses();
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
    const counts = days.map((iso) => tasks.filter((t) => t.date === iso && t.completed).length);
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
    const doneCount = dayTasksAll.filter((t) => t.completed).length;
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
      const hasDone = tasks.some((t) => t.date === iso && t.completed);
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
  }

  renderAll();

  console.log("🚀 PlannerY v3 ishga tushdi.");
})();
