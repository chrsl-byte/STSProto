/* ==========================================================
   admin.js – administrator dashboard logic (admin.html only)
   Uses helpers from script.js (loadData, saveData, escapeHTML,
   showToast, confirmDialog, sample data, etc.), so script.js
   must be loaded BEFORE this file.
   IMPORTANT: this demo login is NOT secure authentication.
   ========================================================== */
"use strict";

if (document.body.dataset.page === "admin") {
  initAdmin();
}

function initAdmin() {
  seedIfNeeded();

  // Demo credentials (shown on the login screen on purpose)
  const DEMO_USER = "admin";
  const DEMO_PASS = "barangay123";

  // Page elements we use many times
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  const logoutBtn = document.getElementById("logout-btn");

  /* ---------- Fill the drop-down lists once ---------- */
  fillSelect(
    document.getElementById("f-category"),
    CONCERN_CATEGORIES.concat(ASSISTANCE_TYPES),
    "All categories",
  );
  fillSelect(document.getElementById("f-status"), STATUSES, "All statuses");
  fillSelect(
    document.getElementById("a-category"),
    ANNOUNCEMENT_CATEGORIES,
    "Select a category",
  );
  fillSelect(document.getElementById("detail-status"), STATUSES);

  /* ==========================================================
     LOGIN / LOGOUT (demonstration only)
     ========================================================== */
  function isLoggedIn() {
    try {
      return sessionStorage.getItem(KEYS.adminSession) === "yes";
    } catch (e) {
      return false;
    }
  }

  // Show the dashboard or the login screen depending on the login flag.
  function applyAuthState() {
    const loggedIn = isLoggedIn();
    loginView.hidden = loggedIn;
    dashboardView.hidden = !loggedIn;
    logoutBtn.hidden = !loggedIn;
    if (loggedIn) refreshAll();
  }

  document
    .getElementById("login-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      const user = document.getElementById("login-user");
      const pass = document.getElementById("login-pass");
      const error = document.getElementById("login-error");
      if (user.value.trim() === DEMO_USER && pass.value === DEMO_PASS) {
        try {
          sessionStorage.setItem(KEYS.adminSession, "yes");
        } catch (err) {
          /* ignore */
        }
        error.textContent = "";
        user.value = "";
        pass.value = "";
        applyAuthState();
        showToast("Logged in to the demo dashboard.", "success");
      } else {
        error.textContent =
          "Incorrect username or password. Use the demo credentials shown above.";
        showToast("Login failed.", "error");
        pass.value = "";
        pass.focus();
      }
    });

  logoutBtn.addEventListener("click", function () {
    try {
      sessionStorage.removeItem(KEYS.adminSession);
    } catch (err) {
      /* ignore */
    }
    applyAuthState();
    showTab("overview");
    showToast("You have been logged out.", "info");
  });

  /* ==========================================================
     TABS
     ========================================================== */
  function showTab(name) {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      const active = btn.getAttribute("data-tab") === name;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.id !== "tab-" + name;
    });
  }
  document.querySelector(".tabs").addEventListener("click", function (e) {
    const btn = e.target.closest(".tab-btn");
    if (btn) showTab(btn.getAttribute("data-tab"));
  });

  // Redraw everything from the saved data
  function refreshAll() {
    renderOverview();
    renderReports();
    renderAdminAnnouncements();
  }

  /* ==========================================================
     OVERVIEW (statistics are calculated from saved data)
     ========================================================== */
  function countStatus(reports, status) {
    return reports.filter(function (r) {
      return r.status === status;
    }).length;
  }

  // Newest first: reverse the saved order, then sort by date (sort keeps ties in that order)
  function newestFirst(list) {
    return list
      .slice()
      .reverse()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
  }

  // Build a table of reports. Shared by the Overview and Manage Reports tabs.
  function buildTable(list) {
    const rows = list
      .map(function (r) {
        return (
          "<tr>" +
          '<td data-label="Reference"><strong>' +
          escapeHTML(r.ref) +
          "</strong></td>" +
          '<td data-label="Title">' +
          escapeHTML(r.title) +
          "</td>" +
          '<td data-label="Type">' +
          (r.type === "concern" ? "Concern" : "Request") +
          "</td>" +
          '<td data-label="Category">' +
          escapeHTML(r.category) +
          "</td>" +
          '<td data-label="Date">' +
          formatDate(r.date) +
          "</td>" +
          '<td data-label="Status">' +
          statusBadge(r.status) +
          "</td>" +
          '<td data-label="Action"><button type="button" class="btn btn-small btn-outline" data-view-ref="' +
          escapeHTML(r.ref) +
          '">View / Update</button></td>' +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="table-wrap"><table class="responsive-table"><thead><tr>' +
      "<th>Reference</th><th>Title</th><th>Type</th><th>Category</th><th>Date</th><th>Status</th><th>Action</th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>"
    );
  }

  function renderOverview() {
    const reports = loadData(KEYS.reports, []);
    const pending =
      countStatus(reports, "Submitted") + countStatus(reports, "Under Review");
    document.getElementById("stats").innerHTML =
      statCard("Total reports", reports.length, "") +
      statCard("Pending (Submitted + Under Review)", pending, "gold") +
      statCard("In progress", countStatus(reports, "In Progress"), "blue") +
      statCard("Resolved", countStatus(reports, "Resolved"), "") +
      statCard("Rejected", countStatus(reports, "Rejected"), "red");

    const recent = newestFirst(reports).slice(0, 5);
    document.getElementById("recent-table-wrap").innerHTML = recent.length
      ? buildTable(recent)
      : '<div class="empty-state"><strong>No submissions yet</strong>Reports from residents will appear here.</div>';
  }

  function statCard(label, number, color) {
    return (
      '<div class="stat ' +
      color +
      '"><div class="stat-num">' +
      number +
      '</div><div class="stat-label">' +
      escapeHTML(label) +
      "</div></div>"
    );
  }

  /* ==========================================================
     MANAGE REPORTS: search, filters, table
     ========================================================== */
  const fSearch = document.getElementById("f-search");
  const fCategory = document.getElementById("f-category");
  const fStatus = document.getElementById("f-status");

  function renderReports() {
    const all = loadData(KEYS.reports, []);
    const term = fSearch.value.trim().toLowerCase();
    const filtered = newestFirst(all).filter(function (r) {
      const matchesSearch =
        !term ||
        r.ref.toLowerCase().indexOf(term) !== -1 ||
        r.title.toLowerCase().indexOf(term) !== -1;
      const matchesCategory =
        !fCategory.value || r.category === fCategory.value;
      const matchesStatus = !fStatus.value || r.status === fStatus.value;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    document.getElementById("result-count").textContent =
      "Showing " + filtered.length + " of " + all.length + " submissions.";
    document.getElementById("reports-table-wrap").innerHTML = filtered.length
      ? buildTable(filtered)
      : '<div class="empty-state"><strong>No matching submissions</strong>Try a different search or clear the filters.</div>';
  }

  // These listeners are added once, here, so they never duplicate.
  fSearch.addEventListener("input", renderReports);
  fCategory.addEventListener("change", renderReports);
  fStatus.addEventListener("change", renderReports);
  document.getElementById("f-clear").addEventListener("click", function () {
    fSearch.value = "";
    fCategory.value = "";
    fStatus.value = "";
    renderReports();
  });

  /* ==========================================================
     REPORT DETAILS DIALOG (update status + admin note)
     ========================================================== */
  const detailDialog = document.getElementById("detail-dialog");
  const detailStatus = document.getElementById("detail-status");
  const detailNote = document.getElementById("detail-note");
  let currentRef = null; // which report is open

  // One listener for every "View / Update" button, even ones created later
  dashboardView.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-view-ref]");
    if (btn) openDetails(btn.getAttribute("data-view-ref"));
  });

  function openDetails(ref) {
    const r = loadData(KEYS.reports, []).find(function (item) {
      return item.ref === ref;
    });
    if (!r) {
      showToast("That report could not be found.", "error");
      return;
    }
    currentRef = ref;

    const isConcern = r.type === "concern";
    document.getElementById("detail-title").textContent =
      r.ref + (r.isSample ? " (demo data)" : "");
    document.getElementById("detail-info").innerHTML =
      "<h3>" +
      escapeHTML(r.title) +
      "</h3>" +
      '<dl class="details-grid">' +
      "<div><dt>Type</dt><dd>" +
      (isConcern ? "Concern" : "Assistance request") +
      "</dd></div>" +
      "<div><dt>Category</dt><dd>" +
      escapeHTML(r.category) +
      "</dd></div>" +
      "<div><dt>Submitted</dt><dd>" +
      formatDate(r.date) +
      "</dd></div>" +
      "<div><dt>Location</dt><dd>" +
      (isConcern ? escapeHTML(r.location) : "Not applicable") +
      "</dd></div>" +
      "<div><dt>Current status</dt><dd>" +
      statusBadge(r.status) +
      "</dd></div>" +
      (!isConcern
        ? "<div><dt>Preferred contact (admin view only)</dt><dd>" +
          escapeHTML(r.contactMethod || "None") +
          (r.contact ? " – " + escapeHTML(r.contact) : "") +
          "</dd></div>"
        : "") +
      "</dl>" +
      "<p>" +
      escapeHTML(r.description) +
      "</p>";

    detailStatus.value = r.status;
    detailNote.value = r.adminNote || "";
    document.getElementById("detail-history").innerHTML = (r.history || [])
      .map(function (h) {
        return (
          "<li><strong>" +
          escapeHTML(h.status) +
          '</strong><div class="t-date">' +
          formatDate(h.date) +
          "</div>" +
          (h.note ? '<p class="t-note">' + escapeHTML(h.note) + "</p>" : "") +
          "</li>"
        );
      })
      .join("");
    detailDialog.showModal();
  }

  document
    .getElementById("detail-close")
    .addEventListener("click", function () {
      detailDialog.close();
    });

  document
    .getElementById("detail-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      const reports = loadData(KEYS.reports, []);
      const r = reports.find(function (item) {
        return item.ref === currentRef;
      });
      if (!r) {
        showToast("That report could not be found.", "error");
        return;
      }

      const newStatus = detailStatus.value;
      const newNote = detailNote.value.trim();
      const statusChanged = newStatus !== r.status;
      const noteChanged = newNote !== (r.adminNote || "");

      if (!statusChanged && !noteChanged) {
        showToast("No changes to save.", "info");
        return;
      }
      if (statusChanged) {
        r.status = newStatus;
        r.history = r.history || [];
        r.history.push({
          status: newStatus,
          date: todayISO(),
          note: newNote || "Status updated by the administrator (demo).",
        });
      }
      r.adminNote = newNote;

      if (saveData(KEYS.reports, reports)) {
        detailDialog.close();
        refreshAll();
        showToast(
          "Saved. Residents will see the update in Track My Report.",
          "success",
        );
      }
    });

  /* ==========================================================
     MANAGE ANNOUNCEMENTS (add / edit / delete)
     ========================================================== */
  const annForm = document.getElementById("ann-form");
  const aId = document.getElementById("a-id");
  const aTitle = document.getElementById("a-title");
  const aCategory = document.getElementById("a-category");
  const aDate = document.getElementById("a-date");
  const aSummary = document.getElementById("a-summary");
  const aBody = document.getElementById("a-body");
  const annFields = [aTitle, aCategory, aDate, aSummary, aBody];

  function resetAnnForm() {
    annForm.reset();
    aId.value = "";
    aDate.value = todayISO();
    annFields.forEach(function (f) {
      setError(f, "");
    });
    document.getElementById("ann-form-title").textContent =
      "Add a New Announcement";
    document.getElementById("ann-save-btn").textContent = "Post Announcement";
    document.getElementById("ann-cancel-btn").hidden = true;
  }
  aDate.value = todayISO();

  function validateAnnouncement() {
    const results = [
      setError(
        aTitle,
        aTitle.value.trim().length < 5
          ? "Please enter a title (at least 5 characters)."
          : "",
      ),
      setError(aCategory, !aCategory.value ? "Please choose a category." : ""),
      setError(aDate, !aDate.value ? "Please choose the date posted." : ""),
      setError(
        aSummary,
        aSummary.value.trim().length < 10
          ? "Please write a short description (at least 10 characters)."
          : "",
      ),
      setError(
        aBody,
        aBody.value.trim().length < 20
          ? "Please write the full announcement (at least 20 characters)."
          : "",
      ),
    ];
    return results.every(Boolean);
  }

  annForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateAnnouncement()) {
      showToast("Please fix the highlighted fields.", "warning");
      const firstBad = annForm.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    const list = loadData(KEYS.announcements, []);
    const data = {
      title: aTitle.value.trim(),
      category: aCategory.value,
      date: aDate.value,
      summary: aSummary.value.trim(),
      body: aBody.value.trim(),
    };

    if (aId.value) {
      // EDIT: find the existing announcement and update its fields
      const existing = list.find(function (a) {
        return a.id === aId.value;
      });
      if (!existing) {
        showToast("That announcement no longer exists.", "error");
        resetAnnForm();
        return;
      }
      Object.assign(existing, data);
      existing.isSample = false; // once edited by an admin, it is no longer plain demo text
      if (saveData(KEYS.announcements, list))
        showToast("Announcement updated.", "success");
    } else {
      // ADD: create a new announcement with a unique id
      list.push(
        Object.assign({ id: "ann-" + Date.now(), isSample: false }, data),
      );
      if (saveData(KEYS.announcements, list))
        showToast(
          "Announcement posted. It now appears on the resident site.",
          "success",
        );
    }
    resetAnnForm();
    renderAdminAnnouncements();
  });

  annFields.forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.getAttribute("aria-invalid") === "true") setError(field, "");
    });
    field.addEventListener("change", function () {
      if (field.getAttribute("aria-invalid") === "true") setError(field, "");
    });
  });
  document
    .getElementById("ann-cancel-btn")
    .addEventListener("click", resetAnnForm);

  function renderAdminAnnouncements() {
    const list = sortedAnnouncements();
    const box = document.getElementById("admin-ann-list");
    if (list.length === 0) {
      box.innerHTML =
        '<div class="empty-state"><strong>No announcements</strong>Use the form to post one.</div>';
      return;
    }
    box.innerHTML = list
      .map(function (a) {
        return (
          '<article class="ann-row">' +
          '<div class="card-meta"><span class="tag">' +
          escapeHTML(a.category) +
          "</span><span>" +
          formatDate(a.date) +
          "</span>" +
          (a.isSample ? '<span class="tag tag-demo">Demo data</span>' : "") +
          "</div>" +
          "<h4>" +
          escapeHTML(a.title) +
          "</h4>" +
          '<p class="small">' +
          escapeHTML(a.summary) +
          "</p>" +
          '<div class="btn-row">' +
          '<button type="button" class="btn btn-small btn-outline" data-edit-ann="' +
          escapeHTML(a.id) +
          '">Edit</button>' +
          '<button type="button" class="btn btn-small btn-danger" data-delete-ann="' +
          escapeHTML(a.id) +
          '">Delete</button>' +
          "</div></article>"
        );
      })
      .join("");
  }

  // One listener handles every Edit and Delete button
  document
    .getElementById("admin-ann-list")
    .addEventListener("click", async function (e) {
      const editBtn = e.target.closest("[data-edit-ann]");
      const deleteBtn = e.target.closest("[data-delete-ann]");

      if (editBtn) {
        const a = loadData(KEYS.announcements, []).find(function (item) {
          return item.id === editBtn.getAttribute("data-edit-ann");
        });
        if (!a) return;
        aId.value = a.id;
        aTitle.value = a.title;
        aCategory.value = a.category;
        aDate.value = a.date;
        aSummary.value = a.summary;
        aBody.value = a.body;
        annFields.forEach(function (f) {
          setError(f, "");
        });
        document.getElementById("ann-form-title").textContent =
          "Edit Announcement";
        document.getElementById("ann-save-btn").textContent = "Save Changes";
        document.getElementById("ann-cancel-btn").hidden = false;
        annForm.scrollIntoView({ behavior: "smooth", block: "start" });
        aTitle.focus();
      }

      if (deleteBtn) {
        const id = deleteBtn.getAttribute("data-delete-ann");
        const list = loadData(KEYS.announcements, []);
        const a = list.find(function (item) {
          return item.id === id;
        });
        if (!a) return;
        const confirmed = await confirmDialog(
          'Delete the announcement "' + a.title + '"? This cannot be undone.',
          "Delete",
        );
        if (!confirmed) return;
        const updated = list.filter(function (item) {
          return item.id !== id;
        });
        if (saveData(KEYS.announcements, updated)) {
          if (aId.value === id) resetAnnForm(); // we were editing the deleted item
          renderAdminAnnouncements();
          showToast("Announcement deleted.", "success");
        }
      }
    });

  /* ==========================================================
     RESET DEMO DATA
     ========================================================== */
  document
    .getElementById("reset-demo-btn")
    .addEventListener("click", async function () {
      const confirmed = await confirmDialog(
        "Reset all demo data? This removes every report, request, and announcement and restores the original samples.",
        "Reset",
      );
      if (!confirmed) return;
      resetDemoData();
      resetAnnForm();
      refreshAll();
      showToast("Demo data has been reset.", "success");
    });

  /* ---------- Start the page ---------- */
  applyAuthState();
}
