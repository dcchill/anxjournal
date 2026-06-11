import { toDateKey } from "./utils.js";

const STORAGE_KEY = "anxjournal.entries.v1";
const DAILY_STORAGE_KEY = "anxjournal.dailyEntries.v1";
const POINTS_STORAGE_KEY = "anxjournal.points.v1";
const STICKERS_STORAGE_KEY = "anxjournal.stickers.v1";
const OWNED_REWARDS_STORAGE_KEY = "anxjournal.ownedRewards.v1";
const PROFILE_PICTURE_STORAGE_KEY = "anxjournal.profilePicture.v1";
const SKIP_DAYS_STORAGE_KEY = "anxjournal.skipDays.v1";

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadEntries() {
  return loadJson(STORAGE_KEY, []);
}

export function loadDailyEntries() {
  return loadJson(DAILY_STORAGE_KEY, []);
}

export function loadPoints() {
  return Number(localStorage.getItem(POINTS_STORAGE_KEY) || "0");
}

export function loadStickers() {
  return loadJson(STICKERS_STORAGE_KEY, []);
}

export function loadOwnedRewards() {
  return loadJson(OWNED_REWARDS_STORAGE_KEY, []);
}

export function loadProfilePicture() {
  return localStorage.getItem(PROFILE_PICTURE_STORAGE_KEY) || "Default";
}

export function loadSkipDays() {
  return loadJson(SKIP_DAYS_STORAGE_KEY, []);
}

export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function saveDailyEntries(dailyEntries) {
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(dailyEntries));
}

export function savePoints(points) {
  localStorage.setItem(POINTS_STORAGE_KEY, String(points));
}

export function saveStickers(stickers) {
  localStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(stickers));
}

export function saveOwnedRewards(ownedRewards) {
  localStorage.setItem(OWNED_REWARDS_STORAGE_KEY, JSON.stringify(ownedRewards));
}

export function saveProfilePicture(profilePicture) {
  localStorage.setItem(PROFILE_PICTURE_STORAGE_KEY, profilePicture);
}

export function saveSkipDays(skipDays) {
  localStorage.setItem(SKIP_DAYS_STORAGE_KEY, JSON.stringify(skipDays));
}

export function createBackupPayload(state) {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    entries: state.entries,
    dailyEntries: state.dailyEntries,
    points: state.points,
    stickers: state.stickers,
    ownedRewards: state.ownedRewards,
    profilePicture: state.profilePicture,
    skipDays: state.skipDays,
  };
}

export function normalizeBackup(imported) {
  if (Array.isArray(imported)) {
    return {
      entries: imported.map(normalizeImportedEntry),
      dailyEntries: [],
      points: 0,
      stickers: [],
      ownedRewards: [],
      profilePicture: "Default",
      skipDays: [],
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
    ownedRewards: Array.isArray(imported.ownedRewards) ? imported.ownedRewards : [],
    profilePicture: imported.profilePicture || "Default",
    skipDays: Array.isArray(imported.skipDays) ? imported.skipDays : [],
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
    type: sticker.type || "daily",
    icon: sticker.icon || "Star",
    name: sticker.name || "Daily Sticker",
    milestone: sticker.milestone || 7,
    days: sticker.days || "",
    description: sticker.description || "",
    earnedAt: sticker.earnedAt || new Date().toISOString(),
  };
}
