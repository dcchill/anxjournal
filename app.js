const STORAGE_KEY = "anxjournal.entries.v1";
const DAILY_STORAGE_KEY = "anxjournal.dailyEntries.v1";
const POINTS_STORAGE_KEY = "anxjournal.points.v1";
const STICKERS_STORAGE_KEY = "anxjournal.stickers.v1";

const state = {
  entries: loadEntries(),
  dailyEntries: loadDailyEntries(),
  points: loadPoints(),
  stickers: loadStickers(),
  activeReviewId: null,
  editingDailyId: null,
  journalPage: 0,
  entryTemplate: "full",
  viewTransitioning: false,
  pageTransitioning: false,
};

const journalForm = document.querySelector("#journalForm");
const reviewForm = document.querySelector("#reviewForm");
const dailyForm = document.querySelector("#dailyForm");
const reviewSelect = document.querySelector("#reviewSelect");
const reviewEmpty = document.querySelector("#reviewEmpty");
const entryList = document.querySelector("#entryList");
const dailyList = document.querySelector("#dailyList");
const stickerList = document.querySelector("#stickerList");
const searchEntries = document.querySelector("#searchEntries");
const cancelDailyEditButton = document.querySelector("#cancelDailyEdit");
const dailySubmitButton = document.querySelector("#dailySubmit");
const importFile = document.querySelector("#importFile");
const journalPages = Array.from(document.querySelectorAll(".form-page"));
const pageDots = Array.from(document.querySelectorAll("[data-step-dot]"));
const prevPageButton = document.querySelector("#prevPage");
const nextPageButton = document.querySelector("#nextPage");
const saveEntryButton = document.querySelector("#saveEntry");
const entryModal = document.querySelector("#entryModal");
const modalContent = document.querySelector("#modalContent");
const closeModalButton = document.querySelector("#closeModal");
const trendStats = document.querySelector("#trendStats");
const trendChart = document.querySelector("#trendChart");
const reminderList = document.querySelector("#reminderList");
const toast = document.querySelector("#toast");
let toastTimer = null;

const stickerCatalog = [
  { icon: "Sunrise", name: "Sunrise" },
  { icon: "Tea", name: "Tea" },
  { icon: "Leaf", name: "Leaf" },
  { icon: "Moon", name: "Moon" },
  { icon: "Star", name: "Star" },
  { icon: "Heart", name: "Heart" },
  { icon: "Cloud", name: "Cloud" },
  { icon: "Home", name: "Home" },
];

const formatDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});

document.querySelectorAll('input[name="entryTemplate"]').forEach((input) => {
  input.addEventListener("change", () => {
    state.entryTemplate = input.value;
    state.journalPage = 0;
    renderJournalPage();
  });
});

document.querySelector("#clearForm").addEventListener("click", () => {
  journalForm.reset();
  state.entryTemplate = "full";
  state.journalPage = 0;
  updateRangeLabels();
  renderJournalPage();
});

document.querySelector("#exportEntries").addEventListener("click", exportEntries);
document.querySelector("#importEntries").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importEntries);
document.querySelector("#markClosed").addEventListener("click", () => markActiveReviewClosed());
searchEntries.addEventListener("input", renderEntries);
prevPageButton.addEventListener("click", () => changeJournalPage(-1));
nextPageButton.addEventListener("click", () => changeJournalPage(1));
closeModalButton.addEventListener("click", closeEntryModal);
entryModal.addEventListener("click", (event) => {
  if (event.target === entryModal) {
    closeEntryModal();
  }
});
reminderList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-entry]");
  if (!button) return;
  openEntryModal(button.dataset.openEntry);
});
dailyList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-daily]");
  if (editButton) {
    startDailyEdit(editButton.dataset.editDaily);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-daily]");
  if (deleteButton) {
    deleteDailyEntry(deleteButton.dataset.deleteDaily);
  }
});
cancelDailyEditButton.addEventListener("click", cancelDailyEdit);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !entryModal.classList.contains("hidden")) {
    closeEntryModal();
  }
});

document.querySelectorAll('input[type="range"]').forEach((range) => {
  range.addEventListener("input", updateRangeLabels);
});

journalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(journalForm).entries());
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    reviews: [],
    ...data,
    status: "Open",
    reminderDate: "",
  };

  state.entries.unshift(entry);
  saveEntries();
  journalForm.reset();
  state.journalPage = 0;
  updateRangeLabels();
  render();
  showView("library");
});

dailyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(dailyForm).entries());
  const todayKey = getTodayKey();
  const now = new Date().toISOString();
  const editingEntry = state.dailyEntries.find((entry) => entry.id === state.editingDailyId);
  const existingEntry = editingEntry || state.dailyEntries.find((entry) => entry.dateKey === todayKey);
  const earnedPoints = !editingEntry && !existingEntry;

  if (existingEntry) {
    Object.assign(existingEntry, data, { updatedAt: now });
  } else {
    state.dailyEntries.unshift({
      id: crypto.randomUUID(),
      dateKey: todayKey,
      createdAt: now,
      updatedAt: now,
      ...data,
    });
    state.points += 10;
  }

  const newStickers = earnedPoints ? awardAvailableStickers() : [];
  saveDailyEntries();
  savePoints();
  saveStickers();
  resetDailyForm();
  updateRangeLabels();
  render();
  if (newStickers.length) {
    showToast(`Daily entry saved. You earned 10 points and a new sticker: ${newStickers.map((sticker) => sticker.name).join(", ")}.`);
  } else {
    showToast(earnedPoints ? "Daily entry saved. You earned 10 points." : "Today's daily entry was updated.");
  }
});

reviewSelect.addEventListener("change", () => {
  state.activeReviewId = reviewSelect.value;
  renderReview();
});

reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const entry = getActiveReviewEntry();
  if (!entry) return;

  const data = Object.fromEntries(new FormData(reviewForm).entries());
  entry.reviews.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...data,
  });
  entry.updatedAt = new Date().toISOString();
  if (data.statusUpdate) {
    entry.status = data.statusUpdate;
  } else if (data.stillAnxious === "No") {
    entry.status = "Closed";
  }
  if (data.reminderDate) {
    entry.reminderDate = data.reminderDate;
  }

  saveEntries();
  reviewForm.reset();
  document.querySelector("#reviewAnxiety").value = "3";
  updateRangeLabels();
  render();
  showView("library");
});

function showView(viewName) {
  const targetView = document.querySelector(`#${viewName}View`);
  const activeView = document.querySelector(".view.active");
  if (!targetView || targetView === activeView || state.viewTransitioning) return;

  state.viewTransitioning = true;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  if (viewName === "review") {
    state.activeReviewId = state.activeReviewId || state.entries[0]?.id || null;
    renderReview();
  }

  activeView?.classList.add("exiting");
  window.setTimeout(() => {
    activeView?.classList.remove("active", "exiting");
    targetView.classList.add("active");
    state.viewTransitioning = false;
  }, 150);
}

function changeJournalPage(direction) {
  if (state.pageTransitioning || (direction > 0 && !validateCurrentPage())) return;

  const visiblePages = getVisibleJournalPages();
  const currentVisibleIndex = visiblePages.indexOf(state.journalPage);
  const nextVisibleIndex = Math.min(Math.max(currentVisibleIndex + direction, 0), visiblePages.length - 1);
  const nextPage = visiblePages[nextVisibleIndex];
  if (nextPage === state.journalPage) return;

  state.pageTransitioning = true;
  journalPages[state.journalPage]?.classList.add("exiting");
  window.setTimeout(() => {
    state.journalPage = nextPage;
    renderJournalPage();
    state.pageTransitioning = false;
  }, 150);
}

function validateCurrentPage() {
  const page = journalPages[state.journalPage];
  const fields = Array.from(page.querySelectorAll("input, textarea, select"));
  const invalidField = fields.find((field) => !field.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    return false;
  }

  return true;
}

function renderJournalPage() {
  const visiblePages = getVisibleJournalPages();
  if (!visiblePages.includes(state.journalPage)) {
    state.journalPage = visiblePages[0];
  }

  journalPages.forEach((page, index) => {
    page.classList.remove("exiting");
    page.classList.toggle("active", index === state.journalPage);
  });
  pageDots.forEach((dot, index) => {
    const isVisible = visiblePages.includes(index);
    dot.classList.toggle("hidden", !isVisible);
    dot.classList.toggle("active", index === state.journalPage);
  });

  const currentVisibleIndex = visiblePages.indexOf(state.journalPage);
  const isLastPage = currentVisibleIndex === visiblePages.length - 1;
  prevPageButton.disabled = currentVisibleIndex === 0;
  nextPageButton.classList.toggle("hidden", isLastPage);
  saveEntryButton.classList.toggle("hidden", !isLastPage);
}

function getVisibleJournalPages() {
  return state.entryTemplate === "quick" ? [0, 3] : journalPages.map((_, index) => index);
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function loadDailyEntries() {
  try {
    return JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function loadPoints() {
  return Number(localStorage.getItem(POINTS_STORAGE_KEY) || "0");
}

function loadStickers() {
  try {
    return JSON.parse(localStorage.getItem(STICKERS_STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function saveDailyEntries() {
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state.dailyEntries));
}

function savePoints() {
  localStorage.setItem(POINTS_STORAGE_KEY, String(state.points));
}

function saveStickers() {
  localStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(state.stickers));
}

function render() {
  renderJournalPage();
  renderStatus();
  renderDailyJournal();
  renderReviewOptions();
  renderEntries();
  renderReview();
  renderTrends();
}

function renderStatus() {
  const count = state.entries.length;
  const dailyCount = state.dailyEntries.length;
  document.querySelector("#entryCount").textContent = `${count} ${count === 1 ? "entry" : "entries"} | ${dailyCount} daily`;
  document.querySelector("#lastSaved").textContent = count
    ? `Last updated ${formatDate.format(new Date(state.entries[0].updatedAt))}`
    : "Nothing saved yet";
}

function renderDailyJournal() {
  awardAvailableStickers();
  saveStickers();
  document.querySelector("#pointTotal").textContent = state.points;
  document.querySelector("#dailyStreak").textContent = `${getDailyStreak()} day streak`;
  const editingEntry = state.dailyEntries.find((entry) => entry.id === state.editingDailyId);
  document.querySelector("#dailyFormTitle").textContent = editingEntry
    ? `Edit ${formatDailyDate(editingEntry.dateKey)}`
    : hasDailyEntryToday() ? "Update today" : "Today";
  dailySubmitButton.textContent = editingEntry ? "Save changes" : "Save daily entry";
  cancelDailyEditButton.classList.toggle("hidden", !editingEntry);
  renderStickerLogbook();

  dailyList.innerHTML = "";
  if (!state.dailyEntries.length) {
    dailyList.innerHTML = '<div class="empty-state">Daily entries will appear here.</div>';
    return;
  }

  state.dailyEntries
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((entry) => {
      const card = document.createElement("article");
      card.className = "daily-card";
      card.innerHTML = `
        <div class="daily-card-head">
          <h4>${escapeHtml(formatDailyDate(entry.dateKey))}</h4>
          <span class="metric">Mood ${escapeHtml(entry.dailyMood ?? "?")}/10</span>
        </div>
        <div class="daily-fields">
          ${dailyField("What happened", entry.daySummary)}
          ${dailyField("Feelings", entry.dayFeelings)}
          ${dailyField("Carry forward", entry.dayTakeaway)}
        </div>
        <div class="card-actions daily-actions">
          <button class="secondary" type="button" data-edit-daily="${escapeHtml(entry.id)}">Edit</button>
          <button class="ghost icon-only-button" type="button" data-delete-daily="${escapeHtml(entry.id)}" aria-label="Delete daily entry" title="Delete daily entry">
            <img src="img/trash-svgrepo-com.svg" alt="" aria-hidden="true">
          </button>
        </div>
      `;
      dailyList.append(card);
    });
}

function startDailyEdit(id) {
  const entry = state.dailyEntries.find((item) => item.id === id);
  if (!entry) return;

  state.editingDailyId = id;
  dailyForm.elements.daySummary.value = entry.daySummary || "";
  dailyForm.elements.dayFeelings.value = entry.dayFeelings || "";
  dailyForm.elements.dayTakeaway.value = entry.dayTakeaway || "";
  dailyForm.elements.dailyMood.value = entry.dailyMood || "5";
  updateRangeLabels();
  renderDailyJournal();
  dailyForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelDailyEdit() {
  resetDailyForm();
  renderDailyJournal();
}

function deleteDailyEntry(id) {
  const entry = state.dailyEntries.find((item) => item.id === id);
  if (!entry) return;

  state.dailyEntries = state.dailyEntries.filter((item) => item.id !== id);
  if (state.editingDailyId === id) {
    resetDailyForm();
  }
  syncDailyRewards();
  saveDailyEntries();
  savePoints();
  saveStickers();
  render();
  showToast(`Deleted daily entry for ${formatDailyDate(entry.dateKey)}.`);
}

function resetDailyForm() {
  state.editingDailyId = null;
  dailyForm.reset();
  document.querySelector("#dailyMood").value = "5";
}

function renderStickerLogbook() {
  const uniqueDailyCount = getUniqueDailyCount();
  const remainder = uniqueDailyCount % 7;
  const nextStickerIn = remainder === 0 ? 7 : 7 - remainder;
  document.querySelector("#nextStickerText").textContent =
    `${nextStickerIn} daily ${nextStickerIn === 1 ? "entry" : "entries"} until your next sticker`;

  stickerList.innerHTML = "";
  if (!state.stickers.length) {
    stickerList.innerHTML = '<div class="empty-state">Earn your first sticker after 7 daily entries.</div>';
    return;
  }

  state.stickers.forEach((sticker) => {
    const card = document.createElement("article");
    card.className = "sticker-card";
    card.innerHTML = `
      <div class="sticker-icon">${escapeHtml(sticker.icon)}</div>
      <div>
        <h4>${escapeHtml(sticker.name)}</h4>
        <p>Earned after ${escapeHtml(sticker.milestone)} daily entries</p>
      </div>
    `;
    stickerList.append(card);
  });
}

function awardAvailableStickers() {
  const earnedStickerCount = Math.floor(getUniqueDailyCount() / 7);
  const newStickers = [];

  while (state.stickers.length < earnedStickerCount) {
    const milestone = (state.stickers.length + 1) * 7;
    const sticker = stickerCatalog[state.stickers.length % stickerCatalog.length];
    const awardedSticker = {
      ...sticker,
      id: crypto.randomUUID(),
      milestone,
      earnedAt: new Date().toISOString(),
    };
    state.stickers.push(awardedSticker);
    newStickers.push(awardedSticker);
  }

  return newStickers;
}

function syncDailyRewards() {
  state.points = getUniqueDailyCount() * 10;
  state.stickers = [];
  awardAvailableStickers();
}

function dailyField(label, value) {
  return `
    <div>
      <div class="daily-label">${escapeHtml(label)}</div>
      <p>${escapeHtml(value || "Not recorded")}</p>
    </div>
  `;
}

function renderReviewOptions() {
  reviewSelect.innerHTML = "";
  state.entries.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${shortText(entry.worry, 42)} - ${entry.status}`;
    reviewSelect.append(option);
  });
}

function renderReview() {
  const entry = getActiveReviewEntry();
  reviewEmpty.classList.toggle("hidden", Boolean(entry));
  reviewForm.classList.toggle("hidden", !entry);
  reviewSelect.disabled = !state.entries.length;

  if (!entry) return;

  reviewSelect.value = entry.id;
  document.querySelector("#reviewTitle").textContent = `Review: ${shortText(entry.worry, 54)}`;
  document.querySelector("#reviewSummary").innerHTML = summaryHtml(entry);
}

function renderEntries() {
  const query = searchEntries.value.trim().toLowerCase();
  const entries = state.entries.filter((entry) => {
    if (!query) return true;
    return [
      entry.feelings,
      entry.situation,
      entry.worry,
      entry.notes,
      entry.balancedThought,
      entry.nextAction,
      entry.lettingGo,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  entryList.innerHTML = "";
  if (!entries.length) {
    entryList.innerHTML = '<div class="empty-state">No matching entries yet.</div>';
    return;
  }

  const template = document.querySelector("#entryCardTemplate");
  entries.forEach((entry) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".entry-date").textContent = formatDate.format(new Date(entry.createdAt));
    card.querySelector(".entry-heading").textContent = shortText(entry.situation || entry.worry, 62);
    card.querySelector(".entry-preview").textContent = shortText(entry.worry || entry.balancedThought || entry.friendAdvice || entry.feelings, 150);

    const badge = card.querySelector(".badge");
    badge.textContent = entry.status;
    badge.classList.toggle("closed", entry.status === "Closed");

    card.querySelector(".metrics").innerHTML = [
      metric(`Before ${entry.anxietyBefore}/10`),
      metric(`After ${entry.anxietyAfter}/10`),
      metric(entry.worryType),
      entry.reminderDate ? metric(`Reminder ${formatReminderDate(entry.reminderDate)}`) : "",
      metric(`${entry.reviews.length} ${entry.reviews.length === 1 ? "review" : "reviews"}`),
    ].join("");

    const statusSelect = card.querySelector(".entry-status");
    const reminderInput = card.querySelector(".entry-reminder");
    const notesInput = card.querySelector(".entry-notes");
    statusSelect.value = entry.status || "Open";
    reminderInput.value = entry.reminderDate || "";
    notesInput.value = entry.notes || "";
    statusSelect.addEventListener("change", () => updateEntryMeta(entry.id, { status: statusSelect.value }));
    reminderInput.addEventListener("change", () => updateEntryMeta(entry.id, { reminderDate: reminderInput.value }));
    notesInput.addEventListener("change", () => updateEntryMeta(entry.id, { notes: notesInput.value }));

    card.querySelector(".view-entry").addEventListener("click", () => openEntryModal(entry.id));
    card.querySelector(".review-entry").addEventListener("click", () => {
      state.activeReviewId = entry.id;
      showView("review");
    });
    card.querySelector(".delete-entry").addEventListener("click", () => deleteEntry(entry.id));
    entryList.append(card);
  });
}

function updateEntryMeta(id, updates) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
  saveEntries();
  render();
}

function summaryHtml(entry) {
  const latestReview = entry.reviews[0];
  const rows = [
    ["Situation", entry.situation || "Not recorded"],
    ["Original worry", entry.worry],
    ["Balanced thought", entry.balancedThought || "Not recorded"],
    ["In my control", entry.inControl || "Not recorded"],
    ["Outside my control", entry.outControl || "Not recorded"],
    ["Next action", entry.nextAction || "Not recorded"],
  ];

  if (latestReview) {
    rows.push(["Latest review", `${latestReview.stillAnxious}. ${latestReview.currentFeeling || ""}`]);
  }

  return rows.map(([term, description]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(description)}</dd>`).join("");
}

function metric(text) {
  if (!text) return "";
  return `<span class="metric">${escapeHtml(text)}</span>`;
}

function getActiveReviewEntry() {
  return state.entries.find((entry) => entry.id === state.activeReviewId) || state.entries[0] || null;
}

function markActiveReviewClosed() {
  const entry = getActiveReviewEntry();
  if (!entry) return;
  entry.status = "Closed";
  entry.updatedAt = new Date().toISOString();
  saveEntries();
  render();
}

function openEntryModal(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  document.querySelector("#modalTitle").textContent = shortText(entry.situation || entry.worry, 72);
  modalContent.innerHTML = entryDetailsHtml(entry);
  entryModal.classList.remove("hidden", "closing");
  document.body.style.overflow = "hidden";
  closeModalButton.focus();
}

function closeEntryModal() {
  entryModal.classList.add("closing");
  window.setTimeout(() => {
    entryModal.classList.add("hidden");
    entryModal.classList.remove("closing");
    document.body.style.overflow = "";
  }, 150);
}

function entryDetailsHtml(entry) {
  const entryFields = [
    ["Situation", entry.situation, true],
    ["Worry", entry.worry, true],
    ["Feelings", entry.feelings, true],
    ["Facts supporting the worry", entry.supportingFacts, false],
    ["Facts making it less certain", entry.balancingFacts, false],
    ["Advice to a friend", entry.friendAdvice, true],
    ["In my control", entry.inControl, false],
    ["Outside my control", entry.outControl, false],
    ["Balanced thought", entry.balancedThought, true],
    ["Small next action", entry.nextAction, false],
    ["Let-go statement", entry.lettingGo, false],
    ["Notes", entry.notes, true],
    ["Reminder", entry.reminderDate ? formatReminderDate(entry.reminderDate) : "", false],
  ];

  const reviews = entry.reviews.length
    ? entry.reviews.map(reviewDetailsHtml).join("")
    : '<p class="detail-value">No reviews have been saved for this entry yet.</p>';

  return `
    <section class="detail-section">
      <div class="metrics">
        ${metric(entry.status)}
        ${metric(entry.worryType || "No worry type")}
        ${metric(`Before ${entry.anxietyBefore ?? "?"}/10`)}
        ${metric(`After ${entry.anxietyAfter ?? "?"}/10`)}
        ${metric(`Created ${formatDate.format(new Date(entry.createdAt))}`)}
      </div>
      <div class="detail-grid">
        ${entryFields.map(([label, value, full]) => detailItem(label, value, full)).join("")}
      </div>
    </section>
    <section class="detail-section">
      <h3>Reviews</h3>
      <div class="review-list">${reviews}</div>
    </section>
  `;
}

function reviewDetailsHtml(review) {
  return `
    <article class="review-item">
      <div class="metrics">
        ${metric(formatDate.format(new Date(review.createdAt)))}
        ${metric(`Still anxious: ${review.stillAnxious || "Not recorded"}`)}
        ${metric(`Anxiety ${review.reviewAnxiety ?? "?"}/10`)}
        ${metric(review.statusUpdate ? `Status ${review.statusUpdate}` : "")}
        ${metric(review.reminderDate ? `Reminder ${formatReminderDate(review.reminderDate)}` : "")}
      </div>
      <div class="detail-grid">
        ${detailItem("Feeling now", review.currentFeeling, true)}
        ${detailItem("What happened", review.whatHappened, true)}
        ${detailItem("Closure or next step", review.closure, true)}
      </div>
    </article>
  `;
}

function renderTrends() {
  if (!trendStats || !trendChart || !reminderList) return;

  const entriesWithScores = state.entries.filter((entry) => {
    return isFiniteNumber(entry.anxietyBefore) && isFiniteNumber(entry.anxietyAfter);
  });
  const averageBefore = average(entriesWithScores.map((entry) => Number(entry.anxietyBefore)));
  const averageAfter = average(entriesWithScores.map((entry) => Number(entry.anxietyAfter)));
  const averageDrop = entriesWithScores.length ? averageBefore - averageAfter : 0;
  const openCount = state.entries.filter((entry) => entry.status !== "Closed").length;

  trendStats.innerHTML = [
    statCard(entriesWithScores.length, "rated entries"),
    statCard(formatScore(averageBefore), "average before"),
    statCard(formatScore(averageAfter), "average after"),
    statCard(formatScore(averageDrop), "average change"),
    statCard(openCount, "open entries"),
  ].join("");

  const chartEntries = entriesWithScores.slice(0, 12).reverse();
  trendChart.innerHTML = chartEntries.length
    ? chartEntries.map(trendRowHtml).join("")
    : '<div class="empty-state">Save entries with anxiety ratings to see trends.</div>';

  const reminders = getReminderEntries();
  reminderList.innerHTML = reminders.length
    ? reminders.map(reminderItemHtml).join("")
    : '<div class="empty-state">No reminders set yet.</div>';
}

function trendRowHtml(entry) {
  const before = Number(entry.anxietyBefore);
  const after = Number(entry.anxietyAfter);
  return `
    <div class="trend-row">
      <div class="trend-label">${escapeHtml(shortDate(entry.createdAt))}</div>
      <div class="trend-bars" aria-label="Before ${before} out of 10, after ${after} out of 10">
        <div class="trend-track"><div class="trend-fill before" style="width: ${before * 10}%"></div></div>
        <div class="trend-track"><div class="trend-fill after" style="width: ${after * 10}%"></div></div>
      </div>
      <div class="trend-score">${escapeHtml(`${before} -> ${after}`)}</div>
    </div>
  `;
}

function reminderItemHtml(entry) {
  const due = isReminderDue(entry.reminderDate);
  return `
    <article class="reminder-item${due ? " due" : ""}">
      <div>
        <p class="reminder-title">${escapeHtml(shortText(entry.situation || entry.worry, 72))}</p>
        <span class="reminder-date">${escapeHtml(due ? "Due" : "Upcoming")} ${escapeHtml(formatReminderDate(entry.reminderDate))}</span>
      </div>
      <button class="secondary" type="button" data-open-entry="${escapeHtml(entry.id)}">View</button>
    </article>
  `;
}

function statCard(value, label) {
  return `
    <article class="stat-card">
      <p class="stat-value">${escapeHtml(value)}</p>
      <p class="stat-label">${escapeHtml(label)}</p>
    </article>
  `;
}

function getReminderEntries() {
  return state.entries
    .filter((entry) => entry.reminderDate)
    .sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate));
}

function isReminderDue(dateValue) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${dateValue}T00:00:00`) <= today;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isFiniteNumber(value) {
  return value !== "" && Number.isFinite(Number(value));
}

function formatScore(value) {
  return Number(value).toFixed(1);
}

function shortDate(dateValue) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(dateValue));
}

function formatReminderDate(dateValue) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}

function detailItem(label, value, full = false) {
  return `
    <div class="detail-item${full ? " full" : ""}">
      <div class="detail-label">${escapeHtml(label)}</div>
      <p class="detail-value">${escapeHtml(value || "Not recorded")}</p>
    </div>
  `;
}

function deleteEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  const confirmed = confirm(`Delete this entry?\n\n${shortText(entry.worry, 90)}`);
  if (!confirmed) return;

  state.entries = state.entries.filter((item) => item.id !== id);
  if (state.activeReviewId === id) {
    state.activeReviewId = state.entries[0]?.id || null;
  }
  saveEntries();
  render();
}

function exportEntries() {
  const payload = JSON.stringify(createBackupPayload(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `anxjournal-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function createBackupPayload() {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    entries: state.entries,
    dailyEntries: state.dailyEntries,
    points: state.points,
    stickers: state.stickers,
  };
}

function importEntries() {
  const file = importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      const backup = normalizeBackup(imported);
      const existingEntryIds = new Set(state.entries.map((entry) => entry.id));
      const existingDailyIds = new Set(state.dailyEntries.map((entry) => entry.id));
      const existingDailyDates = new Set(state.dailyEntries.map((entry) => entry.dateKey));
      const existingStickerIds = new Set(state.stickers.map((sticker) => sticker.id));
      const newEntries = backup.entries.filter((entry) => !existingEntryIds.has(entry.id));
      const newDailyEntries = backup.dailyEntries.filter((entry) => {
        if (existingDailyIds.has(entry.id) || existingDailyDates.has(entry.dateKey)) return false;
        existingDailyDates.add(entry.dateKey);
        return true;
      });
      const newStickers = backup.stickers.filter((sticker) => !existingStickerIds.has(sticker.id));
      const duplicateCount = backup.entries.length + backup.dailyEntries.length + backup.stickers.length
        - newEntries.length - newDailyEntries.length - newStickers.length;

      state.entries = [...newEntries, ...state.entries].sort((a, b) => {
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
      state.dailyEntries = [...newDailyEntries, ...state.dailyEntries].sort((a, b) => {
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
      state.points = Math.max(state.points, backup.points);
      state.stickers = [...newStickers, ...state.stickers].sort((a, b) => {
        return Number(a.milestone || 0) - Number(b.milestone || 0);
      });
      state.points = Math.max(state.points, getUniqueDailyCount() * 10);
      awardAvailableStickers();
      saveEntries();
      saveDailyEntries();
      savePoints();
      saveStickers();
      render();
      showToast(`Imported ${newEntries.length} anxiety entries, ${newDailyEntries.length} daily entries, and ${newStickers.length} stickers.${duplicateCount ? ` Skipped ${duplicateCount} duplicates.` : ""}`);
    } catch (error) {
      showToast(`Import failed: ${error.message}`);
    } finally {
      importFile.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeBackup(imported) {
  if (Array.isArray(imported)) {
    return {
      entries: imported.map(normalizeImportedEntry),
      dailyEntries: [],
      points: 0,
      stickers: [],
    };
  }

  if (!imported || typeof imported !== "object") {
    throw new Error("Import file must contain a backup object or an array of entries.");
  }

  return {
    entries: Array.isArray(imported.entries) ? imported.entries.map(normalizeImportedEntry) : [],
    dailyEntries: Array.isArray(imported.dailyEntries) ? imported.dailyEntries.map(normalizeImportedDailyEntry) : [],
    points: Number(imported.points || 0),
    stickers: Array.isArray(imported.stickers) ? imported.stickers.map(normalizeImportedSticker) : [],
  };
}

function normalizeImportedEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Each imported entry must be an object.");
  }

  const now = new Date().toISOString();
  return {
    ...entry,
    id: entry.id || crypto.randomUUID(),
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || entry.createdAt || now,
    status: entry.status || "Open",
    reminderDate: entry.reminderDate || "",
    notes: entry.notes || "",
    reviews: Array.isArray(entry.reviews) ? entry.reviews : [],
  };
}

function normalizeImportedDailyEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Each imported daily entry must be an object.");
  }

  const now = new Date().toISOString();
  const createdAt = entry.createdAt || now;
  return {
    ...entry,
    id: entry.id || crypto.randomUUID(),
    dateKey: entry.dateKey || toDateKey(new Date(createdAt)),
    createdAt,
    updatedAt: entry.updatedAt || createdAt,
  };
}

function normalizeImportedSticker(sticker) {
  if (!sticker || typeof sticker !== "object") {
    throw new Error("Each imported sticker must be an object.");
  }

  return {
    ...sticker,
    id: sticker.id || crypto.randomUUID(),
    icon: sticker.icon || "Star",
    name: sticker.name || "Daily Sticker",
    milestone: sticker.milestone || 7,
    earnedAt: sticker.earnedAt || new Date().toISOString(),
  };
}

function updateRangeLabels() {
  document.querySelector("#anxietyBeforeValue").textContent = `${document.querySelector("#anxietyBefore").value}/10`;
  document.querySelector("#anxietyAfterValue").textContent = `${document.querySelector("#anxietyAfter").value}/10`;
  document.querySelector("#reviewAnxietyValue").textContent = `${document.querySelector("#reviewAnxiety").value}/10`;
  document.querySelector("#dailyMoodValue").textContent = `${document.querySelector("#dailyMood").value}/10`;
}

function hasDailyEntryToday() {
  return state.dailyEntries.some((entry) => entry.dateKey === getTodayKey());
}

function getUniqueDailyCount() {
  return new Set(state.dailyEntries.map((entry) => entry.dateKey)).size;
}

function getDailyStreak() {
  const dates = new Set(state.dailyEntries.map((entry) => entry.dateKey));
  let streak = 0;
  const cursor = new Date();

  while (dates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getTodayKey() {
  return toDateKey(new Date());
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDailyDate(dateKey) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date(`${dateKey}T00:00:00`));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden", "hiding");
  toastTimer = window.setTimeout(() => {
    toast.classList.add("hiding");
    window.setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("hiding");
    }, 160);
  }, 3200);
}

function shortText(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled entry";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

updateRangeLabels();
render();
