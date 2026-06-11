import {
  saveDailyEntries,
  saveOwnedRewards,
  savePoints,
  saveProfilePicture,
  saveSkipDays,
  saveStickers,
} from "./storage.js";
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

const streakStickerCatalog = [
  { days: 30, icon: "Month", name: "One Month Steady" },
  { days: 90, icon: "Quarter", name: "Three Month Quarter" },
  { days: 180, icon: "Half Year", name: "Six Months" },
  { days: 365, icon: "Year", name: "One Year Journal" },
];

const shopItems = [
  { id: "sticker-candle", type: "sticker", icon: "Candle", name: "Calm Candle", cost: 25 },
  { id: "sticker-blanket", type: "sticker", icon: "Blanket", name: "Cozy Blanket", cost: 25 },
  { id: "sticker-garden", type: "sticker", icon: "Garden", name: "Quiet Garden", cost: 35 },
  { id: "profile-sun", type: "profile", icon: "Sun", name: "Sun Profile", cost: 40 },
  { id: "profile-moon", type: "profile", icon: "Moon", name: "Moon Profile", cost: 40 },
  { id: "profile-leaf", type: "profile", icon: "Leaf", name: "Leaf Profile", cost: 40 },
];

const skipDayCost = 50;

export function setupDailyJournal({ state, elements, render, updateRangeLabels, showToast }) {
  const {
    dailyForm,
    dailyList,
    stickerList,
    rewardShopList,
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
  rewardShopList.addEventListener("click", (event) => {
    const shopButton = event.target.closest("[data-buy-reward]");
    if (shopButton) {
      buyReward(shopButton.dataset.buyReward);
      return;
    }

    const profileButton = event.target.closest("[data-use-profile]");
    if (profileButton) {
      useProfile(profileButton.dataset.useProfile);
      return;
    }

    if (event.target.closest("[data-buy-skip-day]")) {
      buySkipDay();
    }
  });

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
    renderRewardShop();

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
    state.points = Math.max(0, state.points - 10);
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
          <p>${escapeHtml(sticker.description || `Earned after ${sticker.milestone} daily entries`)}</p>
        </div>
      `;
      stickerList.append(card);
    });
  }

  function renderRewardShop() {
    document.querySelector("#profilePictureText").textContent = `Profile: ${state.profilePicture || "Default"}`;
    const todaySkipUsed = state.skipDays.includes(getTodayKey());
    const todayEntryExists = hasDailyEntryToday();
    const skipDisabled = state.points < skipDayCost || todaySkipUsed || todayEntryExists;
    const skipText = todayEntryExists
      ? "Entry already saved today"
      : todaySkipUsed ? "Skip day active" : `Buy for ${skipDayCost} points`;

    rewardShopList.innerHTML = `
      <article class="reward-card skip-card">
        <div class="reward-icon">Skip</div>
        <div>
          <h4>Skip day</h4>
          <p>Keep your streak for today without writing a daily entry.</p>
        </div>
        <button class="secondary" type="button" data-buy-skip-day ${skipDisabled ? "disabled" : ""}>${escapeHtml(skipText)}</button>
      </article>
      ${shopItems.map(rewardItemHtml).join("")}
    `;
  }

  function rewardItemHtml(item) {
    const owned = state.ownedRewards.includes(item.id);
    const activeProfile = item.type === "profile" && state.profilePicture === item.name;
    const disabled = state.points < item.cost || owned;
    const action = item.type === "profile" && owned
      ? `<button class="secondary" type="button" data-use-profile="${escapeHtml(item.id)}" ${activeProfile ? "disabled" : ""}>${activeProfile ? "Active" : "Use"}</button>`
      : `<button class="secondary" type="button" data-buy-reward="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""}>${owned ? "Owned" : `${item.cost} points`}</button>`;

    return `
      <article class="reward-card">
        <div class="reward-icon">${escapeHtml(item.icon)}</div>
        <div>
          <h4>${escapeHtml(item.name)}</h4>
          <p>${escapeHtml(item.type === "profile" ? "Profile picture" : "Sticker")}</p>
        </div>
        ${action}
      </article>
    `;
  }

  function buyReward(id) {
    const item = shopItems.find((reward) => reward.id === id);
    if (!item || state.ownedRewards.includes(id)) return;
    if (state.points < item.cost) {
      showToast("Not enough points for that reward yet.");
      return;
    }

    state.points -= item.cost;
    state.ownedRewards.push(id);
    if (item.type === "sticker") {
      state.stickers.push({
        id: crypto.randomUUID(),
        type: "shop",
        icon: item.icon,
        name: item.name,
        milestone: "shop",
        description: `Purchased for ${item.cost} points`,
        earnedAt: new Date().toISOString(),
      });
    } else {
      state.profilePicture = item.name;
      saveProfilePicture(state.profilePicture);
    }

    savePoints(state.points);
    saveOwnedRewards(state.ownedRewards);
    saveStickers(state.stickers);
    render();
    showToast(`Unlocked ${item.name}.`);
  }

  function useProfile(id) {
    const item = shopItems.find((reward) => reward.id === id && reward.type === "profile");
    if (!item || !state.ownedRewards.includes(id)) return;
    state.profilePicture = item.name;
    saveProfilePicture(state.profilePicture);
    render();
    showToast(`${item.name} is now active.`);
  }

  function buySkipDay() {
    const todayKey = getTodayKey();
    if (hasDailyEntryToday()) {
      showToast("You already journaled today, so you do not need a skip day.");
      return;
    }
    if (state.skipDays.includes(todayKey)) {
      showToast("Your skip day is already active for today.");
      return;
    }
    if (state.points < skipDayCost) {
      showToast("You need 50 points to buy a skip day.");
      return;
    }

    state.points -= skipDayCost;
    state.skipDays.push(todayKey);
    savePoints(state.points);
    saveSkipDays(state.skipDays);
    awardAvailableStickers();
    saveStickers(state.stickers);
    render();
    showToast("Skip day active. Your streak is protected today.");
  }

  function awardAvailableStickers() {
    const earnedStickerCount = Math.floor(getUniqueDailyCount() / 7);
    const newStickers = [];
    let existingDailyStickers = state.stickers.filter((sticker) => sticker.type === "daily" || !sticker.type).length;

    while (existingDailyStickers < earnedStickerCount) {
      const milestone = (existingDailyStickers + 1) * 7;
      const sticker = stickerCatalog[existingDailyStickers % stickerCatalog.length];
      const awardedSticker = {
        ...sticker,
        id: crypto.randomUUID(),
        type: "daily",
        milestone,
        description: `Earned after ${milestone} daily entries`,
        earnedAt: new Date().toISOString(),
      };
      state.stickers.push(awardedSticker);
      newStickers.push(awardedSticker);
      existingDailyStickers += 1;
    }

    const streak = getDailyStreak();
    streakStickerCatalog.forEach((sticker) => {
      const alreadyEarned = state.stickers.some((earned) => earned.type === "streak" && Number(earned.days) === sticker.days);
      if (streak < sticker.days || alreadyEarned) return;

      const awardedSticker = {
        ...sticker,
        id: crypto.randomUUID(),
        type: "streak",
        milestone: sticker.days,
        description: `Earned for a ${sticker.days} day journaling streak`,
        earnedAt: new Date().toISOString(),
      };
      state.stickers.push(awardedSticker);
      newStickers.push(awardedSticker);
    });

    return newStickers;
  }

  function syncDailyRewards() {
    state.stickers = state.stickers.filter((sticker) => sticker.type === "shop");
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
    const dates = new Set([
      ...state.dailyEntries.map((entry) => entry.dateKey),
      ...state.skipDays,
    ]);
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
