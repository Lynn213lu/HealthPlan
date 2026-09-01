const STORAGE_KEY = "daily-health-data-v1";

const defaultState = {
  profile: { name: "", goal: "保持健康", days: "3", preference: "" },
  stateDate: "",
  water: 0,
  tasks: [false, false, false, false, false],
  records: [],
  reflection: "",
};

const tasks = [
  { title: "准备一份均衡早餐", detail: "加入蛋白质和一份水果", tag: "饮食", className: "tag-meal" },
  { title: "午餐吃够蔬菜", detail: "餐盘的一半留给蔬菜", tag: "饮食", className: "tag-meal" },
  { title: "快走或训练 30 分钟", detail: "以能自然交谈的强度开始", tag: "活动", className: "tag-move" },
  { title: "完成 10 分钟拉伸", detail: "让身体从久坐中恢复", tag: "恢复", className: "tag-recover" },
  { title: "给自己留出睡前缓冲", detail: "睡前 30 分钟减少屏幕刺激", tag: "睡眠", className: "tag-recover" },
];

const guides = [
  { type: "meal", label: "饮食", title: "用餐盘法安排一餐", summary: "把蔬菜、蛋白质和主食放在同一个餐盘里，让搭配更直观。", source: "中国居民膳食指南" },
  { type: "meal", label: "饮食", title: "如何选择日常加餐", summary: "优先考虑水果、原味坚果、无糖酸奶等营养密度较高的食物。", source: "中国居民膳食指南" },
  { type: "exercise", label: "运动", title: "从中等强度活动开始", summary: "快走、骑车或游泳都可以。先让频率稳定，再增加时长和强度。", source: "WHO 身体活动建议" },
  { type: "exercise", label: "运动", title: "力量训练的入门原则", summary: "选择可控动作，关注姿势与恢复。疼痛不是有效训练的必要条件。", source: "ACSM 运动建议" },
  { type: "sleep", label: "睡眠", title: "建立更稳定的睡眠节奏", summary: "尽量固定起床时间，给睡前留一段低刺激、可重复的放松流程。", source: "CDC 睡眠健康建议" },
  { type: "sleep", label: "睡眠", title: "下午疲劳时先检查什么", summary: "先评估午餐、饮水、久坐与前一晚睡眠，再决定是否增加咖啡因。", source: "一般健康教育" },
];

function normalizeState(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const profile = source.profile && typeof source.profile === "object" ? source.profile : {};
  const water = Number(source.water);
  return {
    profile: {
      name: typeof profile.name === "string" ? profile.name.slice(0, 16) : "",
      goal: ["保持健康", "改善体能", "减脂", "增肌"].includes(profile.goal) ? profile.goal : defaultState.profile.goal,
      days: ["2", "3", "4", "5"].includes(String(profile.days)) ? String(profile.days) : defaultState.profile.days,
      preference: typeof profile.preference === "string" ? profile.preference.slice(0, 80) : "",
    },
    stateDate: typeof source.stateDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.stateDate) ? source.stateDate : "",
    water: Number.isFinite(water) ? Math.max(0, Math.min(20, Math.round(water))) : 0,
    tasks: Array.isArray(source.tasks) ? tasks.map((_, index) => Boolean(source.tasks[index])) : [...defaultState.tasks],
    records: Array.isArray(source.records) ? source.records.filter((record) => record && typeof record === "object" && ["meal", "exercise", "weight", "sleep"].includes(record.type) && typeof record.value === "string" && typeof record.date === "string").slice(-500) : [],
    reflection: typeof source.reflection === "string" ? source.reflection.slice(0, 1000) : "",
  };
}

function getState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const normalized = normalizeState(saved);
    const today = todayInputValue();
    if (!normalized.stateDate) {
      normalized.stateDate = today;
    } else if (normalized.stateDate !== today) {
      normalized.stateDate = today;
      normalized.water = 0;
      normalized.tasks = [...defaultState.tasks];
    }
    return normalized;
  } catch {
    return { ...normalizeState(), stateDate: todayInputValue() };
  }
}

let state = getState();
let currentGuideFilter = "all";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function updateDate() {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(now);
  $("#today-date").textContent = `${weekday}，${date}`;
}

function renderTasks() {
  const list = $("#task-list");
  list.innerHTML = tasks.map((task, index) => `
    <label class="task-row ${state.tasks[index] ? "is-done" : ""}">
      <input class="task-check" type="checkbox" data-task-index="${index}" ${state.tasks[index] ? "checked" : ""} />
      <span class="task-text"><b>${task.title}</b><small>${task.detail}</small></span>
      <span class="task-tag ${task.className}">${task.tag}</span>
    </label>
  `).join("");
  $$("[data-task-index]").forEach((input) => input.addEventListener("change", (event) => {
    state.tasks[Number(event.target.dataset.taskIndex)] = event.target.checked;
    saveState();
    renderTasks();
    renderDashboard();
  }));
}

function renderDashboard() {
  const completed = state.tasks.filter(Boolean).length;
  const percent = Math.round((completed / tasks.length) * 100);
  $("#completed-count").textContent = completed;
  $("#daily-progress").style.width = `${percent}%`;
  $(".progress-track").setAttribute("aria-valuenow", completed);
  $("#progress-percent").textContent = `${percent}%`;
  const messages = ["从一顿均衡早餐开始。", "不错，继续完成下一件小事。", "节奏很稳，身体会感受到。", "今天已经照顾好自己很多了。", "只差一点，完成后记得放松。", "全部完成，给自己一个肯定。"];
  $("#summary-note").textContent = messages[completed];
  $("#water-count").textContent = state.water;
  const weight = [...state.records].reverse().find((record) => record.type === "weight");
  $("#last-weight").textContent = weight ? `${weight.value} kg` : "尚未记录";
  renderInsights();
}

function renderWeek() {
  const now = new Date();
  const monday = new Date(now);
  const delta = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - delta);
  const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
  $("#week-strip").innerHTML = weekDays.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const isToday = date.toDateString() === now.toDateString();
    return `<div class="day-chip ${isToday ? "is-today" : ""}"><span>周${label}</span><b>${date.getDate()}</b></div>`;
  }).join("");
}

function typeLabel(type) {
  return { meal: "饮食", exercise: "运动", weight: "体重", sleep: "睡眠" }[type] || "记录";
}

function renderRecords() {
  const list = $("#record-list");
  const records = [...state.records].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  if (!records.length) {
    list.innerHTML = '<p class="empty-state">还没有记录。从今天的一餐或一次活动开始。</p>';
    return;
  }
  list.innerHTML = records.map((record) => `
    <article class="record-row">
      <span class="record-dot ${record.type}" aria-hidden="true"></span>
      <div class="record-main"><b>${typeLabel(record.type)}：${escapeHtml(record.value)}</b><small>${record.note ? escapeHtml(record.note) : "无备注"}</small></div>
      <time class="record-date" datetime="${record.date}">${formatDate(record.date)}</time>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}

function renderInsights() {
  const completed = state.tasks.filter(Boolean).length;
  const percent = Math.round((completed / tasks.length) * 100);
  $("#insight-completion").textContent = `${percent}%`;
  $("#insight-water").textContent = `${state.water} 杯`;
  $("#insight-records").textContent = state.records.length;
  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const todayIndex = (new Date().getDay() + 6) % 7;
  const bars = dayLabels.map((label, index) => {
    const value = index === todayIndex ? percent : 0;
    return `<div class="bar-column ${index === todayIndex ? "is-today" : ""}"><div class="bar" style="height:${Math.max(value, 3)}%" aria-label="周${label} ${value}%"></div><span>周${label}</span></div>`;
  });
  $("#bar-chart").innerHTML = bars.join("");
}

function renderGuides() {
  const search = $("#guide-search").value.trim().toLowerCase();
  const filtered = guides.filter((guide) => {
    const matchesFilter = currentGuideFilter === "all" || guide.type === currentGuideFilter;
    const content = `${guide.label} ${guide.title} ${guide.summary} ${guide.source}`.toLowerCase();
    return matchesFilter && content.includes(search);
  });
  $("#guide-grid").innerHTML = filtered.length ? filtered.map((guide) => `
    <article class="guide-card">
      <span class="tag ${guide.type === "meal" ? "green-tag" : guide.type === "exercise" ? "blue-tag" : "tag-recover"}">${guide.label}</span>
      <h3>${guide.title}</h3><p>${guide.summary}</p><button class="text-action" type="button" data-guide-source="${guide.source}">来源：${guide.source}</button>
    </article>
  `).join("") : '<p class="empty-state">没有找到对应指南，换一个关键词试试。</p>';
  $$('[data-guide-source]').forEach((button) => button.addEventListener('click', () => {
    alert(`${button.dataset.guideSource}\n\n此版本将指南保存在页面中。后续可在这里加入对应的官方链接与全文内容。`);
  }));
}

function setView(viewName) {
  $$(".view").forEach((view) => view.classList.toggle("is-visible", view.id === `${viewName}-view`));
  $$('[data-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.view === viewName && (button.classList.contains("nav-item") || button.closest(".mobile-nav"))));
  const title = { today: "今天，照顾好自己", plan: "本周计划", records: "记录你的节奏", insights: "回顾你的趋势", guides: "健康指南", settings: "个人设置" }[viewName];
  $("#page-title").textContent = title;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setRecordFields(type) {
  const input = $("#record-value");
  const config = {
    meal: { label: "内容", placeholder: "例如：午餐，蔬菜和鸡肉", type: "text" },
    exercise: { label: "内容", placeholder: "例如：快走 30 分钟", type: "text" },
    weight: { label: "体重（kg）", placeholder: "例如：62.4", type: "number" },
    sleep: { label: "睡眠时长（小时）", placeholder: "例如：7.5", type: "number" },
  }[type];
  $("#record-value-label").childNodes[0].textContent = config.label;
  input.placeholder = config.placeholder;
  input.type = config.type;
  input.step = config.type === "number" ? "0.1" : "";
}

function populateProfile() {
  $("#profile-name").value = state.profile.name;
  $("#profile-goal").value = state.profile.goal;
  $("#profile-days").value = state.profile.days;
  $("#profile-preference").value = state.profile.preference;
  $("#avatar-initial").textContent = state.profile.name ? state.profile.name.slice(0, 1) : "你";
}

function addQuickRecord(type) {
  setView("records");
  $("#record-type").value = type;
  setRecordFields(type);
  $("#record-value").focus();
}

function initEvents() {
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => {
    setView(button.dataset.view);
    if (button.dataset.guide) {
      currentGuideFilter = button.dataset.guide;
      $$(".filter-button").forEach((filter) => filter.classList.toggle("is-selected", filter.dataset.filter === currentGuideFilter));
      renderGuides();
    }
  }));
  $$('[data-quick]').forEach((button) => button.addEventListener('click', () => addQuickRecord(button.dataset.quick)));
  $("#water-plus").addEventListener("click", () => { state.water = Math.min(20, state.water + 1); saveState(); renderDashboard(); });
  $("#water-minus").addEventListener("click", () => { state.water = Math.max(0, state.water - 1); saveState(); renderDashboard(); });
  $("#record-type").addEventListener("change", (event) => setRecordFields(event.target.value));
  $("#record-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const record = { type: form.get("type"), date: form.get("date"), value: form.get("value").trim(), note: form.get("note").trim(), createdAt: Date.now() };
    state.records.push(record);
    saveState();
    renderRecords(); renderDashboard();
    $("#form-feedback").textContent = "已保存到此设备。";
    event.currentTarget.reset();
    $("#record-date").value = todayInputValue();
    setRecordFields($("#record-type").value);
  });
  $("#clear-records").addEventListener("click", () => {
    if (state.records.length && confirm("确定清空所有记录吗？此操作无法撤销。")) { state.records = []; saveState(); renderRecords(); renderDashboard(); }
  });
  $("#save-reflection").addEventListener("click", () => { state.reflection = $("#reflection-input").value.trim(); saveState(); $("#reflection-feedback").textContent = "本周回顾已保存。"; });
  $("#guide-search").addEventListener("input", renderGuides);
  $$(".filter-button").forEach((button) => button.addEventListener("click", () => { currentGuideFilter = button.dataset.filter; $$(".filter-button").forEach((item) => item.classList.toggle("is-selected", item === button)); renderGuides(); }));
  $("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    state.profile = { name: form.get("name").trim(), goal: form.get("goal"), days: form.get("days"), preference: form.get("preference").trim() };
    saveState(); populateProfile(); $("#profile-feedback").textContent = "设置已保存。";
  });
  $("#export-data").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `daily-health-backup-${todayInputValue()}.json`; link.click(); URL.revokeObjectURL(url);
    $("#data-feedback").textContent = "备份文件已生成。";
  });
  $("#import-data").addEventListener("change", async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try { const imported = JSON.parse(await file.text()); if (!imported || typeof imported !== "object") throw new Error("invalid"); state = normalizeState(imported); saveState(); renderAll(); $("#data-feedback").textContent = "数据已恢复。"; } catch { $("#data-feedback").textContent = "无法读取此备份文件。"; } finally { event.target.value = ""; }
  });
}

function renderAll() {
  updateDate(); renderTasks(); renderDashboard(); renderWeek(); renderRecords(); renderInsights(); renderGuides(); populateProfile();
  $("#record-date").value = todayInputValue(); $("#reflection-input").value = state.reflection || ""; setRecordFields($("#record-type").value);
}

initEvents();
renderAll();
