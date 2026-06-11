export const formatDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function shortText(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled entry";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function metric(text) {
  if (!text) return "";
  return `<span class="metric">${escapeHtml(text)}</span>`;
}

export function detailItem(label, value, full = false) {
  return `
    <div class="detail-item${full ? " full" : ""}">
      <div class="detail-label">${escapeHtml(label)}</div>
      <p class="detail-value">${escapeHtml(value || "Not recorded")}</p>
    </div>
  `;
}

export function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function isFiniteNumber(value) {
  return value !== "" && Number.isFinite(Number(value));
}

export function formatScore(value) {
  return Number(value).toFixed(1);
}

export function shortDate(dateValue) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(dateValue));
}

export function formatReminderDate(dateValue) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}

export function getTodayKey() {
  return toDateKey(new Date());
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDailyDate(dateKey) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date(`${dateKey}T00:00:00`));
}
