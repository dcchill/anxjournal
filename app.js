const STORAGE_KEY = "anxjournal.entries.v1";

const state = {
  entries: loadEntries(),
  activeReviewId: null,
};

const journalForm = document.querySelector("#journalForm");
const reviewForm = document.querySelector("#reviewForm");
const reviewSelect = document.querySelector("#reviewSelect");
const reviewEmpty = document.querySelector("#reviewEmpty");
const entryList = document.querySelector("#entryList");
const searchEntries = document.querySelector("#searchEntries");

const formatDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});

document.querySelector("#clearForm").addEventListener("click", () => {
  journalForm.reset();
  updateRangeLabels();
});

document.querySelector("#exportEntries").addEventListener("click", exportEntries);
document.querySelector("#markClosed").addEventListener("click", () => markActiveReviewClosed());
searchEntries.addEventListener("input", renderEntries);

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
    status: "Open",
    reviews: [],
    ...data,
  };

  state.entries.unshift(entry);
  saveEntries();
  journalForm.reset();
  updateRangeLabels();
  render();
  showView("library");
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
  if (data.stillAnxious === "No") {
    entry.status = "Closed";
  }

  saveEntries();
  reviewForm.reset();
  document.querySelector("#reviewAnxiety").value = "3";
  updateRangeLabels();
  render();
  showView("library");
});

function showView(viewName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}View`);
  });
  if (viewName === "review") {
    state.activeReviewId = state.activeReviewId || state.entries[0]?.id || null;
    renderReview();
  }
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function render() {
  renderStatus();
  renderReviewOptions();
  renderEntries();
  renderReview();
}

function renderStatus() {
  const count = state.entries.length;
  document.querySelector("#entryCount").textContent = `${count} ${count === 1 ? "entry" : "entries"}`;
  document.querySelector("#lastSaved").textContent = count
    ? `Last updated ${formatDate.format(new Date(state.entries[0].updatedAt))}`
    : "Nothing saved yet";
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
      entry.worry,
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
    card.querySelector(".entry-heading").textContent = shortText(entry.worry, 62);
    card.querySelector(".entry-preview").textContent = shortText(entry.balancedThought || entry.friendAdvice || entry.feelings, 150);

    const badge = card.querySelector(".badge");
    badge.textContent = entry.status;
    badge.classList.toggle("closed", entry.status === "Closed");

    card.querySelector(".metrics").innerHTML = [
      metric(`Before ${entry.anxietyBefore}/10`),
      metric(`After ${entry.anxietyAfter}/10`),
      metric(entry.worryType),
      metric(`${entry.reviews.length} ${entry.reviews.length === 1 ? "review" : "reviews"}`),
    ].join("");

    card.querySelector(".review-entry").addEventListener("click", () => {
      state.activeReviewId = entry.id;
      showView("review");
    });
    card.querySelector(".delete-entry").addEventListener("click", () => deleteEntry(entry.id));
    entryList.append(card);
  });
}

function summaryHtml(entry) {
  const latestReview = entry.reviews[0];
  const rows = [
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
  const payload = JSON.stringify(state.entries, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `anxjournal-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function updateRangeLabels() {
  document.querySelector("#anxietyBeforeValue").textContent = `${document.querySelector("#anxietyBefore").value}/10`;
  document.querySelector("#anxietyAfterValue").textContent = `${document.querySelector("#anxietyAfter").value}/10`;
  document.querySelector("#reviewAnxietyValue").textContent = `${document.querySelector("#reviewAnxiety").value}/10`;
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
