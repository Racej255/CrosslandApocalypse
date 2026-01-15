const STORAGE_KEY = "crossland.entries";
const LOG_KEY = "crossland.entryLog";
const THEME_KEY = "crossland.theme";

const sampleEntries = [
  {
    id: "e1",
    name: "Rhea Crossland",
    date: "2039-04-18",
    title: "Smoke on the ridge",
    read: false,
    contentHtml:
      "<p>Northern horizon burned all night. We counted six impacts. Supplies low, morale thinner.</p>",
  },
  {
    id: "e2",
    name: "Silas Wren",
    date: "2039-04-20",
    title: "Transit tunnel",
    read: false,
    contentHtml:
      "<p>We reached the transit tunnel before dusk. The echo of footsteps follows us even when we stop.</p>",
  },
  {
    id: "e3",
    name: "Mara Voss",
    date: "2039-04-22",
    title: "The water table",
    read: false,
    contentHtml:
      "<p>Found a clean vein beneath the old courthouse. Trading two batteries for a filter.</p>",
  },
  {
    id: "e4",
    name: "Rhea Crossland",
    date: "2039-04-25",
    title: "Last radio beacon",
    read: false,
    contentHtml:
      "<p>Radio chatter says the coast is gone. We still keep watch for the southbound signal.</p>",
  },
];

const form = document.querySelector("#entry-form");
const timelineEl = document.querySelector("#timeline");
const authorsEl = document.querySelector("#authors");
const viewButtons = document.querySelectorAll("[data-view]");
const openAddButton = document.querySelector("#open-add");
const filterButton = document.querySelector("#filter-unread");
const themeToggleButton = document.querySelector("#theme-toggle");
const contentEditor = document.querySelector("#content-editor");
const entryIdField = document.querySelector("#entry-id");
const entryFormTitle = document.querySelector("#entry-form-title");
const entrySubmitButton = document.querySelector("#entry-submit");
const addModal = document.querySelector("#add-modal");
const dateModal = document.querySelector("#date-modal");
const entryModal = document.querySelector("#entry-modal");
const dateModalTitle = document.querySelector("#date-modal-title");
const dateEntryList = document.querySelector("#date-entry-list");
const entryTitle = document.querySelector("#entry-title");
const entryMeta = document.querySelector("#entry-meta");
const entryBody = document.querySelector("#entry-body");
const toolbarButtons = document.querySelectorAll("[data-command]");
const toggleReadButton = document.querySelector("#toggle-read");
const editEntryButton = document.querySelector("#edit-entry");
const deleteEntryButton = document.querySelector("#delete-entry");
const entryMenu = document.querySelector("#entry-menu");
const entryMenuToggle = document.querySelector("#entry-menu-toggle");
const prevEntryButton = document.querySelector("#prev-entry");
const nextEntryButton = document.querySelector("#next-entry");

const views = {
  timeline: document.querySelector("#timeline-view"),
  authors: document.querySelector("#authors-view"),
};

const state = {
  entries: loadEntries(),
  log: loadLog(),
  filterUnread: false,
  theme: loadTheme(),
};

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return sampleEntries.map(normalizeEntry);
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeEntry) : sampleEntries.map(normalizeEntry);
  } catch (error) {
    return sampleEntries.map(normalizeEntry);
  }
}

function loadLog() {
  const raw = localStorage.getItem(LOG_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function saveLog() {
  localStorage.setItem(LOG_KEY, JSON.stringify(state.log));
}

function pushLog(type, payload) {
  state.log.push({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type,
    ...payload,
  });
  saveLog();
}

function normalizeEntry(entry) {
  if (entry.contentHtml) {
    return {
      ...entry,
      read: Boolean(entry.read),
    };
  }
  const content = entry.content || "";
  return {
    ...entry,
    read: Boolean(entry.read),
    contentHtml: wrapTextInParagraphs(content),
  };
}

function wrapTextInParagraphs(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const parts = escaped.split(/\n+/).filter(Boolean);
  return parts.length
    ? parts.map((part) => `<p>${part}</p>`).join("")
    : "<p></p>";
}

function sortByDateDesc(entries) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function sortByDateAsc(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function getVisibleEntries() {
  return state.filterUnread ? state.entries.filter((entry) => !entry.read) : state.entries;
}

function getNavEntries() {
  return [...state.entries].sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date);
    if (dateOrder !== 0) {
      return dateOrder;
    }
    return a.title.localeCompare(b.title);
  });
}

function buildTimeline(entries) {
  timelineEl.innerHTML = "";
  const grouped = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  dates.forEach((date) => {
    const point = document.createElement("div");
    point.className = "timeline-point";
    point.dataset.date = date;

    const pointCore = document.createElement("div");
    pointCore.className = "point-core";

    const label = document.createElement("div");
    label.className = "point-label";
    label.textContent = formatDate(date, { month: "short", day: "numeric" });

    const subtitle = document.createElement("div");
    subtitle.className = "point-subtitle";
    subtitle.textContent = formatDate(date, { year: "numeric" });

    const tooltip = document.createElement("div");
    tooltip.className = "point-tooltip";
    tooltip.textContent = buildNamesTooltip(grouped[date]);

    const hasUnread = grouped[date].some((entry) => !entry.read);
    if (hasUnread) {
      point.classList.add("is-unread");
    }

    point.append(pointCore, label, subtitle, tooltip);
    point.addEventListener("click", () => openDateModal(date, grouped[date]));
    timelineEl.append(point);
  });
}

function buildAuthors(entries) {
  authorsEl.innerHTML = "";
  const grouped = entries.reduce((acc, entry) => {
    if (!acc[entry.name]) {
      acc[entry.name] = [];
    }
    acc[entry.name].push(entry);
    return acc;
  }, {});

  Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => {
      const card = document.createElement("article");
      card.className = "author-card";

      const title = document.createElement("h3");
      title.textContent = name;

      const list = document.createElement("div");
      list.className = "author-list";

      const entriesSorted = sortByDateAsc(grouped[name]);
      entriesSorted.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "author-entry";
        item.classList.toggle("is-unread", !entry.read);

        const entryTitle = document.createElement("strong");
        entryTitle.textContent = entry.title;

        const entryDate = document.createElement("span");
        entryDate.textContent = formatDate(entry.date, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        const entryText = document.createElement("span");
        entryText.textContent = buildSnippet(entry.contentHtml);

        item.append(entryTitle, entryDate, entryText);
        item.addEventListener("click", () => openEntryModal(entry));
        list.append(item);
      });

      card.append(title, list);

      if (entriesSorted.length > 2) {
        card.classList.add("is-collapsed");
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "author-toggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Show more entries");
        toggle.innerHTML = `
          <span class="author-toggle__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="author-toggle__label">More entries</span>
        `;
        toggle.addEventListener("click", () => {
          const isCollapsed = card.classList.toggle("is-collapsed");
          toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
          toggle.setAttribute(
            "aria-label",
            isCollapsed ? "Show more entries" : "Show fewer entries"
          );
          toggle.querySelector(".author-toggle__label").textContent = isCollapsed
            ? "More entries"
            : "Fewer entries";
        });
        card.append(toggle);
      }

      authorsEl.append(card);
    });
}

function render() {
  const visibleEntries = getVisibleEntries();
  buildTimeline(visibleEntries);
  buildAuthors(visibleEntries);

  if (entryModal.classList.contains("is-active")) {
    const entry = getEntryById(entryModal.dataset.entryId);
    if (entry) {
      updateReadButton(entry);
      updateNavButtons(entry);
    }
  }
}

function setView(viewName) {
  Object.values(views).forEach((view) => view.classList.remove("is-active"));
  views[viewName].classList.add("is-active");

  viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });
}

function resetEntryForm() {
  entryIdField.value = "";
  entryFormTitle.textContent = "New Journal Entry";
  entrySubmitButton.textContent = "Add to archive";
  form.reset();
  contentEditor.innerHTML = "";
}

function populateEntryForm(entry) {
  entryIdField.value = entry.id;
  entryFormTitle.textContent = "Edit Journal Entry";
  entrySubmitButton.textContent = "Save changes";
  form.querySelector("#name").value = entry.name;
  form.querySelector("#date").value = entry.date;
  form.querySelector("#title").value = entry.title;
  contentEditor.innerHTML = entry.contentHtml;
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const entryId = String(formData.get("entry-id") || "").trim();
  const name = String(formData.get("name")).trim();
  const date = String(formData.get("date")).trim();
  const title = String(formData.get("title")).trim();
  const contentHtml = contentEditor.innerHTML.trim();
  const plainText = contentEditor.innerText.trim();

  if (!name || !date || !title || !plainText) {
    return;
  }

  if (entryId) {
    const existingIndex = state.entries.findIndex((entry) => entry.id === entryId);
    if (existingIndex !== -1) {
      const previous = { ...state.entries[existingIndex] };
      const updated = {
        ...previous,
        name,
        date,
        title,
        contentHtml,
      };
      state.entries[existingIndex] = updated;
      pushLog("update", { before: previous, after: updated });
    }
  } else {
    const newEntry = {
      id: `entry-${Date.now()}`,
      name,
      date,
      title,
      contentHtml,
      read: false,
    };
    state.entries.push(newEntry);
    pushLog("create", { entry: newEntry });
  }

  saveEntries();
  render();
  resetEntryForm();
  closeModal(addModal);
}

function formatDate(dateString, options) {
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function buildNamesTooltip(entries) {
  const names = [...new Set(entries.map((entry) => entry.name))];
  if (names.length <= 3) {
    return names.join(", ");
  }
  const moreCount = names.length - 3;
  return `${names.slice(0, 3).join(", ")} +${moreCount} more`;
}

function buildSnippet(html) {
  const text = htmlToText(html);
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function htmlToText(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || "";
}

function openDateModal(date, entries) {
  dateModalTitle.textContent = formatDate(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  dateEntryList.innerHTML = "";
  entries.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "date-entry";
    card.classList.toggle("is-unread", !entry.read);

    const title = document.createElement("strong");
    title.textContent = entry.title;

    const meta = document.createElement("span");
    meta.textContent = `${entry.name} - ${formatDate(entry.date, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    const preview = document.createElement("span");
    preview.textContent = buildSnippet(entry.contentHtml);

    card.append(title, meta, preview);
    card.addEventListener("click", () => openEntryModal(entry));
    dateEntryList.append(card);
  });

  openModal(dateModal);
}

function openEntryModal(entry) {
  closeModal(dateModal);
  entryModal.dataset.entryId = entry.id;
  entryTitle.textContent = entry.title;
  entryMeta.innerHTML = "";

  const name = document.createElement("span");
  name.textContent = entry.name;
  const date = document.createElement("span");
  date.textContent = formatDate(entry.date, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  entryMeta.append(name, date);
  entryBody.innerHTML = entry.contentHtml;

  if (!entry.read) {
    const previous = { ...entry };
    entry.read = true;
    pushLog("update", { before: previous, after: { ...entry } });
    saveEntries();
    render();
  }

  updateReadButton(entry);
  updateNavButtons(entry);
  closeEntryMenu();
  openModal(entryModal);
}

function updateReadButton(entry) {
  toggleReadButton.classList.toggle("is-read", entry.read);
  toggleReadButton.setAttribute(
    "aria-label",
    entry.read ? "Mark as unread" : "Mark as read"
  );
}

function updateNavButtons(entry) {
  const navEntries = getNavEntries();
  const index = navEntries.findIndex((item) => item.id === entry.id);
  prevEntryButton.disabled = index <= 0;
  nextEntryButton.disabled = index === -1 || index >= navEntries.length - 1;
}

function navigateEntry(direction) {
  const navEntries = getNavEntries();
  const currentId = entryModal.dataset.entryId;
  const index = navEntries.findIndex((item) => item.id === currentId);
  if (index === -1) {
    return;
  }
  const target = navEntries[index + direction];
  if (target) {
    openEntryModal(target);
  }
}

function getEntryById(entryId) {
  return state.entries.find((entry) => entry.id === entryId);
}

function toggleUnreadFilter() {
  state.filterUnread = !state.filterUnread;
  filterButton.classList.toggle("is-active", state.filterUnread);
  filterButton.textContent = state.filterUnread ? "Unread" : "Read";
  render();
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
  themeToggleButton.classList.toggle("is-active", theme === "dark");
  themeToggleButton.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
  state.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  applyTheme(state.theme === "dark" ? "light" : "dark");
}

function closeEntryMenu() {
  entryMenu.classList.remove("is-open");
  entryMenuToggle.setAttribute("aria-expanded", "false");
}

function toggleEntryMenu() {
  const isOpen = entryMenu.classList.toggle("is-open");
  entryMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

openAddButton.addEventListener("click", () => {
  resetEntryForm();
  openModal(addModal);
});

filterButton.addEventListener("click", toggleUnreadFilter);
form.addEventListener("submit", handleSubmit);

themeToggleButton.addEventListener("click", toggleTheme);

prevEntryButton.addEventListener("click", () => navigateEntry(-1));
nextEntryButton.addEventListener("click", () => navigateEntry(1));

entryMenuToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleEntryMenu();
});

document.addEventListener("click", (event) => {
  if (!entryMenu.contains(event.target)) {
    closeEntryMenu();
  }
});

toolbarButtons.forEach((button) => {
  if (button.tagName === "SELECT") {
    button.addEventListener("change", (event) => {
      document.execCommand("fontSize", false, event.target.value);
      contentEditor.focus();
    });
    return;
  }
  button.addEventListener("click", () => {
    document.execCommand(button.dataset.command, false, null);
    contentEditor.focus();
  });
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", (event) => {
    const targetId = event.currentTarget.dataset.close;
    const modal = document.querySelector(`#${targetId}`);
    closeModal(modal);
  });
});

toggleReadButton.addEventListener("click", () => {
  const entry = getEntryById(entryModal.dataset.entryId);
  if (!entry) {
    return;
  }
  const previous = { ...entry };
  entry.read = !entry.read;
  pushLog("update", { before: previous, after: { ...entry } });
  saveEntries();
  updateReadButton(entry);
  updateNavButtons(entry);
  render();
});

editEntryButton.addEventListener("click", () => {
  const entry = getEntryById(entryModal.dataset.entryId);
  if (!entry) {
    return;
  }
  populateEntryForm(entry);
  closeModal(entryModal);
  closeEntryMenu();
  openModal(addModal);
});

deleteEntryButton.addEventListener("click", () => {
  const entry = getEntryById(entryModal.dataset.entryId);
  if (!entry) {
    return;
  }
  closeEntryMenu();
  const shouldDelete = window.confirm("Delete this entry? It will stay in the archive log.");
  if (!shouldDelete) {
    return;
  }
  state.entries = state.entries.filter((item) => item.id !== entry.id);
  pushLog("delete", { entry });
  saveEntries();
  render();
  closeModal(entryModal);
});

function openModal(modal) {
  modal.classList.add("is-active");
  modal.setAttribute("aria-hidden", "false");
  if (modal === addModal) {
    const dateField = form.querySelector("#date");
    if (!dateField.value) {
      dateField.value = new Date().toISOString().split("T")[0];
    }
  }
}

function closeModal(modal) {
  modal.classList.remove("is-active");
  modal.setAttribute("aria-hidden", "true");
}

applyTheme(state.theme);
filterButton.textContent = state.filterUnread ? "Unread" : "Read";
render();
