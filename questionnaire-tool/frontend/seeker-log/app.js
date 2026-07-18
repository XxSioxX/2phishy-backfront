const elements = {
  search: document.querySelector("[data-search]"),
  refresh: document.querySelector("[data-refresh]"),
  meta: document.querySelector("[data-meta]"),
  table: document.querySelector("[data-table]"),
};

const state = {
  query: "",
  items: [],
  loading: false,
  error: "",
};

const escapeHTML = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const setMeta = () => {
  if (state.loading) {
    elements.meta.textContent = "Loading seeker records…";
    return;
  }

  if (state.error) {
    elements.meta.textContent = state.error;
    return;
  }

  elements.meta.textContent = `${state.items.length} record${state.items.length === 1 ? "" : "s"} shown`;
};

const copyText = async (value) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    window.prompt("Copy Seeker Mark", value);
  }
};

const renderRows = () => {
  if (!state.items.length) {
    return `
      <table class="seeker-log-table">
        <thead>
          <tr>
            <th>Seeker Mark</th>
            <th>Created</th>
            <th>Referrer</th>
            <th>User Agent</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr class="seeker-log-row--empty">
            <td colspan="5" class="seeker-log-empty">No seeker records found.</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  return `
    <table class="seeker-log-table">
      <thead>
        <tr>
          <th>Seeker Mark</th>
          <th>Created</th>
          <th>Referrer</th>
          <th>User Agent</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${state.items
          .map(
            (item, index) => `
              <tr>
                <td class="seeker-log-mark">${escapeHTML(item.seeker_mark)}</td>
                <td class="seeker-log-date">${escapeHTML(formatDate(item.created_at))}</td>
                <td class="seeker-log-referrer">${escapeHTML(item.referrer || "—")}</td>
                <td class="seeker-log-ua">${escapeHTML(item.user_agent || "—")}</td>
                <td>
                  <button type="button" class="secondary seeker-log-copy" data-copy-index="${index}">
                    Copy
                  </button>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const render = () => {
  setMeta();
  elements.table.innerHTML = renderRows();

  elements.table.querySelectorAll("[data-copy-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-copy-index"));
      const item = state.items[index];
      if (item) {
        void copyText(item.seeker_mark);
      }
    });
  });
};

const loadRecords = async () => {
  state.loading = true;
  state.error = "";
  render();

  try {
    const url = new URL("/api/seeker-marks", window.location.origin);
    if (state.query.trim()) {
      url.searchParams.set("q", state.query.trim());
    }
    url.searchParams.set("limit", "500");

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to load seeker records.");
    }

    const payload = await response.json();
    state.items = Array.isArray(payload.items) ? payload.items : [];
  } catch (error) {
    state.error = error?.message || "Failed to load seeker records.";
    state.items = [];
  } finally {
    state.loading = false;
    render();
  }
};

const boot = () => {
  document.title = "Guild of Seekers — Log";
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    window.clearTimeout(window.__seekerLogTimer);
    window.__seekerLogTimer = window.setTimeout(() => {
      void loadRecords();
    }, 250);
  });

  elements.refresh.addEventListener("click", () => {
    void loadRecords();
  });

  void loadRecords();
};

boot();
