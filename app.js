import { setupJournalFlow } from "./js/journalFlow.js";
import { setupDailyJournal } from "./js/dailyJournal.js";
import { setupEntries } from "./js/entries.js";
import { setupTrends } from "./js/trends.js";
import { createToast } from "./js/toast.js";
import {
  loadDailyEntries,
  loadEntries,
  loadOwnedRewards,
  loadPoints,
  loadProfilePicture,
  loadSkipDays,
  loadStickers,
} from "./js/storage.js";

const state = {
  entries: loadEntries(),
  dailyEntries: loadDailyEntries(),
  points: loadPoints(),
  stickers: loadStickers(),
  ownedRewards: loadOwnedRewards(),
  profilePicture: loadProfilePicture(),
  skipDays: loadSkipDays(),
  activeReviewId: null,
  editingDailyId: null,
  journalPage: 0,
  entryTemplate: "full",
  viewTransitioning: false,
  pageTransitioning: false,
};

const elements = {
  journalForm: document.querySelector("#journalForm"),
  reviewForm: document.querySelector("#reviewForm"),
  dailyForm: document.querySelector("#dailyForm"),
  reviewSelect: document.querySelector("#reviewSelect"),
  reviewEmpty: document.querySelector("#reviewEmpty"),
  entryList: document.querySelector("#entryList"),
  dailyList: document.querySelector("#dailyList"),
  stickerList: document.querySelector("#stickerList"),
  rewardShopList: document.querySelector("#rewardShopList"),
  searchEntries: document.querySelector("#searchEntries"),
  cancelDailyEditButton: document.querySelector("#cancelDailyEdit"),
  dailySubmitButton: document.querySelector("#dailySubmit"),
  importFile: document.querySelector("#importFile"),
  journalPages: Array.from(document.querySelectorAll(".form-page")),
  pageDots: Array.from(document.querySelectorAll("[data-step-dot]")),
  prevPageButton: document.querySelector("#prevPage"),
  nextPageButton: document.querySelector("#nextPage"),
  saveEntryButton: document.querySelector("#saveEntry"),
  entryModal: document.querySelector("#entryModal"),
  modalContent: document.querySelector("#modalContent"),
  closeModalButton: document.querySelector("#closeModal"),
  trendStats: document.querySelector("#trendStats"),
  trendChart: document.querySelector("#trendChart"),
  reminderList: document.querySelector("#reminderList"),
  toast: document.querySelector("#toast"),
};

let journal;
let daily;
let entries;
let trends;
const showToast = createToast(elements.toast);

function render() {
  journal.renderJournalPage();
  renderStatus();
  daily.renderDailyJournal();
  entries.renderReviewOptions();
  entries.renderEntries();
  entries.renderReview();
  trends.renderTrends();
}

function renderStatus() {
  const count = state.entries.length;
  const dailyCount = state.dailyEntries.length;
  document.querySelector("#entryCount").textContent = `${count} ${count === 1 ? "entry" : "entries"} | ${dailyCount} daily`;
  document.querySelector("#lastSaved").textContent = count
    ? `Last updated ${entries.formatDate.format(new Date(state.entries[0].updatedAt))}`
    : "Nothing saved yet";
}

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
    entries.renderReview();
  }

  activeView?.classList.add("exiting");
  window.setTimeout(() => {
    activeView?.classList.remove("active", "exiting");
    targetView.classList.add("active");
    state.viewTransitioning = false;
  }, 150);
}

function updateRangeLabels() {
  document.querySelector("#anxietyBeforeValue").textContent = `${document.querySelector("#anxietyBefore").value}/10`;
  document.querySelector("#anxietyAfterValue").textContent = `${document.querySelector("#anxietyAfter").value}/10`;
  document.querySelector("#reviewAnxietyValue").textContent = `${document.querySelector("#reviewAnxiety").value}/10`;
  document.querySelector("#dailyMoodValue").textContent = `${document.querySelector("#dailyMood").value}/10`;
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});

document.querySelectorAll('input[type="range"]').forEach((range) => {
  range.addEventListener("input", updateRangeLabels);
});

journal = setupJournalFlow({ state, elements, render, showView, updateRangeLabels });
daily = setupDailyJournal({ state, elements, render, updateRangeLabels, showToast });
entries = setupEntries({ state, elements, render, showView, updateRangeLabels, showToast, daily });
trends = setupTrends({ state, elements, openEntryModal: entries.openEntryModal });

updateRangeLabels();
render();
