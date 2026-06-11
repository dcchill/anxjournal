import {
  average,
  escapeHtml,
  formatReminderDate,
  formatScore,
  isFiniteNumber,
  shortDate,
  shortText,
} from "./utils.js";

export function setupTrends({ state, elements, openEntryModal }) {
  const { trendStats, trendChart, reminderList } = elements;

  reminderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-entry]");
    if (!button) return;
    openEntryModal(button.dataset.openEntry);
  });

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

  return { renderTrends };
}
