import {
  createBackupPayload,
  normalizeBackup,
  saveDailyEntries,
  saveEntries,
  saveOwnedRewards,
  savePoints,
  saveProfilePicture,
  saveSkipDays,
  saveStickers,
} from "./storage.js";
import {
  detailItem,
  escapeHtml,
  formatDate,
  formatReminderDate,
  metric,
  shortText,
} from "./utils.js";

export function setupEntries({ state, elements, render, showView, updateRangeLabels, showToast, daily }) {
  const {
    reviewForm,
    reviewSelect,
    reviewEmpty,
    entryList,
    searchEntries,
    importFile,
    entryModal,
    modalContent,
    closeModalButton,
  } = elements;

  document.querySelector("#exportEntries").addEventListener("click", exportEntries);
  document.querySelector("#importEntries").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importEntries);
  document.querySelector("#markClosed").addEventListener("click", markActiveReviewClosed);
  searchEntries.addEventListener("input", renderEntries);
  closeModalButton.addEventListener("click", closeEntryModal);
  entryModal.addEventListener("click", (event) => {
    if (event.target === entryModal) {
      closeEntryModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !entryModal.classList.contains("hidden")) {
      closeEntryModal();
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

    saveEntries(state.entries);
    reviewForm.reset();
    document.querySelector("#reviewAnxiety").value = "3";
    updateRangeLabels();
    render();
    showView("library");
  });

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
    saveEntries(state.entries);
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

  function getActiveReviewEntry() {
    return state.entries.find((entry) => entry.id === state.activeReviewId) || state.entries[0] || null;
  }

  function markActiveReviewClosed() {
    const entry = getActiveReviewEntry();
    if (!entry) return;
    entry.status = "Closed";
    entry.updatedAt = new Date().toISOString();
    saveEntries(state.entries);
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

  function deleteEntry(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    const confirmed = confirm(`Delete this entry?\n\n${shortText(entry.worry, 90)}`);
    if (!confirmed) return;

    state.entries = state.entries.filter((item) => item.id !== id);
    if (state.activeReviewId === id) {
      state.activeReviewId = state.entries[0]?.id || null;
    }
    saveEntries(state.entries);
    render();
  }

  function exportEntries() {
    const payload = JSON.stringify(createBackupPayload(state), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anxjournal-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importEntries() {
    const file = importFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const backup = normalizeBackup(JSON.parse(reader.result));
        const existingEntryIds = new Set(state.entries.map((entry) => entry.id));
        const existingDailyIds = new Set(state.dailyEntries.map((entry) => entry.id));
        const existingDailyDates = new Set(state.dailyEntries.map((entry) => entry.dateKey));
        const existingStickerIds = new Set(state.stickers.map((sticker) => sticker.id));
        const existingRewardIds = new Set(state.ownedRewards);
        const existingSkipDays = new Set(state.skipDays);
        const newEntries = backup.entries.filter((entry) => !existingEntryIds.has(entry.id));
        const newDailyEntries = backup.dailyEntries.filter((entry) => {
          if (existingDailyIds.has(entry.id) || existingDailyDates.has(entry.dateKey)) return false;
          existingDailyDates.add(entry.dateKey);
          return true;
        });
        const newStickers = backup.stickers.filter((sticker) => !existingStickerIds.has(sticker.id));
        const newOwnedRewards = backup.ownedRewards.filter((id) => !existingRewardIds.has(id));
        const newSkipDays = backup.skipDays.filter((dateKey) => {
          if (existingSkipDays.has(dateKey)) return false;
          existingSkipDays.add(dateKey);
          return true;
        });
        const duplicateCount = backup.entries.length + backup.dailyEntries.length + backup.stickers.length
          + backup.ownedRewards.length + backup.skipDays.length
          - newEntries.length - newDailyEntries.length - newStickers.length - newOwnedRewards.length - newSkipDays.length;

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
        state.ownedRewards = [...new Set([...state.ownedRewards, ...newOwnedRewards])];
        state.profilePicture = backup.profilePicture || state.profilePicture;
        state.skipDays = [...new Set([...state.skipDays, ...newSkipDays])];
        daily.awardAvailableStickers();
        saveEntries(state.entries);
        saveDailyEntries(state.dailyEntries);
        savePoints(state.points);
        saveStickers(state.stickers);
        saveOwnedRewards(state.ownedRewards);
        saveProfilePicture(state.profilePicture);
        saveSkipDays(state.skipDays);
        render();
        showToast(`Imported ${newEntries.length} anxiety entries, ${newDailyEntries.length} daily entries, ${newStickers.length} stickers, and ${newOwnedRewards.length} rewards.${duplicateCount ? ` Skipped ${duplicateCount} duplicates.` : ""}`);
      } catch (error) {
        showToast(`Import failed: ${error.message}`);
      } finally {
        importFile.value = "";
      }
    });
    reader.readAsText(file);
  }

  return {
    formatDate,
    openEntryModal,
    renderEntries,
    renderReview,
    renderReviewOptions,
  };
}
