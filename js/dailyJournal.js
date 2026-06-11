import { saveDailyEntries, savePoints, saveStickers } from "./storage.js";
import { escapeHtml, formatDailyDate, getTodayKey, toDateKey } from "./utils.js";

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

export function setupDailyJournal({ state, elements, render, updateRangeLabels, showToast }) {
  const {
    dailyForm,
    dailyList,
    stickerList,
    cancelDailyEditButton,
    dailySubmitButton,
  } = elements;

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
    saveDailyEntries(state.dailyEntries);
    savePoints(state.points);
    saveStickers(state.stickers);
    resetDailyForm();
    updateRangeLabels();
    render();
    if (newStickers.length) {
      showToast(`Daily entry saved. You earned 10 points and a new sticker: ${newStickers.map((sticker) => sticker.name).join(", ")}.`);
    } else {
      showToast(earnedPoints ? "Daily entry saved. You earned 10 points." : "Today's daily entry was updated.");
    }
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

  function renderDailyJournal() {
    awardAvailableStickers();
    saveStickers(state.stickers);
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
    saveDailyEntries(state.dailyEntries);
    savePoints(state.points);
    saveStickers(state.stickers);
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

  return {
    awardAvailableStickers,
    getUniqueDailyCount,
    renderDailyJournal,
    syncDailyRewards,
  };
}
