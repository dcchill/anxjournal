import { saveEntries } from "./storage.js";

export function setupJournalFlow({ state, elements, render, showView, updateRangeLabels }) {
  const {
    journalForm,
    journalPages,
    pageDots,
    prevPageButton,
    nextPageButton,
    saveEntryButton,
  } = elements;

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

  prevPageButton.addEventListener("click", () => changeJournalPage(-1));
  nextPageButton.addEventListener("click", () => changeJournalPage(1));

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
    saveEntries(state.entries);
    journalForm.reset();
    state.journalPage = 0;
    updateRangeLabels();
    render();
    showView("library");
  });

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

  return { renderJournalPage };
}
