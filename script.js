/* ==========================================================
   script.js – shared helpers + resident-side logic
   Loaded by BOTH index.html and admin.html.
   PART 1: constants, localStorage helpers, sample data (shared)
   PART 2: resident website behavior (runs only on index.html)
   ========================================================== */
"use strict";

/* ==========================================================
   PART 1 – SHARED
   ========================================================== */

// Names of the localStorage "boxes" where we keep data.
const KEYS = {
  reports: "bch_reports", // all concerns and requests
  announcements: "bch_announcements", // all announcements
  myRefs: "bch_my_refs", // reference numbers submitted on this device
  seeded: "bch_seeded_v1", // remembers that sample data was already added
  adminSession: "bch_admin_session", // demo login flag (sessionStorage)
};

const STATUSES = [
  "Submitted",
  "Under Review",
  "In Progress",
  "Resolved",
  "Rejected",
];
const CONCERN_CATEGORIES = [
  "Improper Garbage Disposal",
  "Damaged Roads",
  "Clogged Drainage",
  "Broken Streetlights",
  "Flooding",
  "Other Community Concerns",
];
const ASSISTANCE_TYPES = [
  "General Assistance",
  "Community Service Inquiry",
  "Other Barangay-Related Request",
];
const CONTACT_METHODS = [
  "Phone Call",
  "Text Message (SMS)",
  "Email",
  "Facebook Messenger",
  "No contact needed",
];
const ANNOUNCEMENT_CATEGORIES = [
  "Garbage Collection",
  "Clean-Up Activity",
  "Drainage Maintenance",
  "Community Information",
  "Other",
];

/* ----- localStorage helpers ----- */

// Read saved data. If nothing is saved (or it is broken), return the fallback.
function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

// Save data. Returns true when it worked.
function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast(
      "Could not save data. Your browser storage may be disabled or full.",
      "error",
    );
    return false;
  }
}

/* ----- small utility functions ----- */

// Turn text into safe HTML so user input cannot inject code.
function escapeHTML(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Returns a date as YYYY-MM-DD using the local time zone.
function isoFromDate(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}
function todayISO() {
  return isoFromDate(new Date());
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoFromDate(d);
}

// Make "2026-10-25" look like "October 25, 2026".
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// A colored status label. "Under Review" becomes the CSS class badge-under-review.
function statusBadge(status) {
  const slug = String(status).toLowerCase().replace(/\s+/g, "-");
  return (
    '<span class="badge badge-' + slug + '">' + escapeHTML(status) + "</span>"
  );
}

// Build a unique reference number such as RPT-261025-K7M2.
// prefix: "RPT" for concerns, "REQ" for requests.
function generateRef(prefix) {
  const reports = loadData(KEYS.reports, []);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  const datePart = todayISO().replace(/-/g, "").slice(2);
  let ref;
  do {
    let code = "";
    for (let i = 0; i < 4; i++)
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    ref = prefix + "-" + datePart + "-" + code;
  } while (
    reports.some(function (r) {
      return r.ref === ref;
    })
  ); // repeat if it already exists
  return ref;
}

// Fill a <select> with options.
function fillSelect(select, items, firstLabel) {
  if (!select) return;
  select.innerHTML = "";
  if (firstLabel !== undefined) {
    const first = document.createElement("option");
    first.value = "";
    first.textContent = firstLabel;
    select.appendChild(first);
  }
  items.forEach(function (item) {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

// Show or clear an error message under a form field.
// Convention: the error <p> has the id "err-" + the field's id.
function setError(input, message) {
  const box = document.getElementById("err-" + input.id);
  if (box) box.textContent = message || "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
  return !message; // true when there is no error
}

// Pop-up notification. type: success | warning | error | info
function showToast(message, type) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "info");
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 4500);
}

// "Are you sure?" dialog. Returns a Promise that resolves to true or false.
// Listeners are removed every time so they never pile up.
function confirmDialog(message, okLabel) {
  return new Promise(function (resolve) {
    const dialog = document.getElementById("confirm-dialog");
    const ok = document.getElementById("confirm-ok");
    const cancel = document.getElementById("confirm-cancel");
    document.getElementById("confirm-message").textContent = message;
    ok.textContent = okLabel || "Delete";

    function finish(result) {
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
      resolve(result);
    }
    function onOk() {
      finish(true);
    }
    function onCancel() {
      finish(false);
    }

    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel); // Esc key
    dialog.showModal();
  });
}

/* ----- sample (fictional) data ----- */

function getSampleReports() {
  return [
    {
      ref: "RPT-DEMO-0001",
      type: "concern",
      title: "Uncollected garbage near the sample basketball court",
      category: "Improper Garbage Disposal",
      description:
        "Sample data: Plastic bags and food waste have piled up beside the fictional basketball court and are attracting flies.",
      location: "Demo Purok 1, beside the Sample Basketball Court (fictional)",
      date: daysAgoISO(2),
      status: "Submitted",
      adminNote: "",
      history: [
        {
          status: "Submitted",
          date: daysAgoISO(2),
          note: "Report received (demo data).",
        },
      ],
      contactMethod: "",
      contact: "",
      isSample: true,
    },
    {
      ref: "RPT-DEMO-0002",
      type: "concern",
      title: "Large potholes on Sample Street",
      category: "Damaged Roads",
      description:
        "Sample data: Several deep potholes make it hard for tricycles and bicycles to pass safely, especially after rain.",
      location: "Sample Street, Demo Purok 2 (fictional)",
      date: daysAgoISO(6),
      status: "Under Review",
      adminNote: "Demo note: Site inspection is being scheduled.",
      history: [
        {
          status: "Submitted",
          date: daysAgoISO(6),
          note: "Report received (demo data).",
        },
        {
          status: "Under Review",
          date: daysAgoISO(4),
          note: "Report is being reviewed by the administrator (demo).",
        },
      ],
      contactMethod: "",
      contact: "",
      isSample: true,
    },
    {
      ref: "RPT-DEMO-0003",
      type: "concern",
      title: "Clogged drainage canal after heavy rain",
      category: "Clogged Drainage",
      description:
        "Sample data: Water stays on the road for hours because the canal is blocked by leaves and plastic.",
      location: "Demo Purok 3, near the Sample Chapel (fictional)",
      date: daysAgoISO(10),
      status: "In Progress",
      adminNote:
        "Demo note: Clearing work is ongoing. Please avoid dumping waste in the canal.",
      history: [
        {
          status: "Submitted",
          date: daysAgoISO(10),
          note: "Report received (demo data).",
        },
        {
          status: "Under Review",
          date: daysAgoISO(8),
          note: "Report is being reviewed by the administrator (demo).",
        },
        {
          status: "In Progress",
          date: daysAgoISO(5),
          note: "Clearing of the canal has started (demo).",
        },
      ],
      contactMethod: "",
      contact: "",
      isSample: true,
    },
    {
      ref: "RPT-DEMO-0004",
      type: "concern",
      title: "Broken streetlight at the sample crossing",
      category: "Broken Streetlights",
      description:
        "Sample data: The streetlight has not worked for two weeks, so the crossing is very dark at night.",
      location: "Sample Crossing, Demo Purok 4 (fictional)",
      date: daysAgoISO(20),
      status: "Resolved",
      adminNote: "Demo note: The lamp was replaced and tested.",
      history: [
        {
          status: "Submitted",
          date: daysAgoISO(20),
          note: "Report received (demo data).",
        },
        {
          status: "Under Review",
          date: daysAgoISO(18),
          note: "Report is being reviewed by the administrator (demo).",
        },
        {
          status: "In Progress",
          date: daysAgoISO(14),
          note: "Repair team assigned (demo).",
        },
        {
          status: "Resolved",
          date: daysAgoISO(11),
          note: "Streetlight replaced (demo).",
        },
      ],
      contactMethod: "",
      contact: "",
      isSample: true,
    },
    {
      ref: "REQ-DEMO-0005",
      type: "request",
      title: "Question about joining the community clean-up",
      category: "Community Service Inquiry",
      description:
        "Sample data: I would like to know how volunteers can join the next community clean-up activity.",
      location: "",
      date: daysAgoISO(1),
      status: "Submitted",
      adminNote: "",
      history: [
        {
          status: "Submitted",
          date: daysAgoISO(1),
          note: "Request received (demo data).",
        },
      ],
      contactMethod: "No contact needed",
      contact: "",
      isSample: true,
    },
  ];
}

function getSampleAnnouncements() {
  return [
    {
      id: "ann-demo-1",
      title: "Garbage Collection Schedule (Sample)",
      category: "Garbage Collection",
      date: daysAgoISO(1),
      isSample: true,
      summary:
        "Sample schedule for biodegradable and non-biodegradable waste pick-up.",
      body: "This is demonstration data.\n\nBiodegradable waste: Monday and Thursday mornings.\nNon-biodegradable waste: Tuesday and Friday mornings.\n\nPlease place segregated trash outside before 7:00 AM and avoid dumping waste in canals or roadsides.",
    },
    {
      id: "ann-demo-2",
      title: "Community Clean-Up Drive (Sample)",
      category: "Clean-Up Activity",
      date: daysAgoISO(3),
      isSample: true,
      summary:
        "Volunteers are invited to a fictional neighborhood clean-up this Saturday.",
      body: "This is demonstration data.\n\nJoin the sample community clean-up this Saturday at 6:00 AM at the Demo Plaza. Bring gloves, sacks, and drinking water. Everyone is welcome.",
    },
    {
      id: "ann-demo-3",
      title: "Drainage Maintenance Notice (Sample)",
      category: "Drainage Maintenance",
      date: daysAgoISO(5),
      isSample: true,
      summary:
        "Sample notice about cleaning of drainage canals before the rainy season.",
      body: "This is demonstration data.\n\nDrainage canals in the fictional Demo Purok areas will be cleaned this week. Residents are reminded not to throw garbage into canals to help prevent flooding.",
    },
    {
      id: "ann-demo-4",
      title: "How to Use the Help Desk (Sample)",
      category: "Community Information",
      date: daysAgoISO(8),
      isSample: true,
      summary:
        "A short guide to submitting and tracking concerns in this prototype.",
      body: "This is demonstration data.\n\nSubmit a concern or request, keep the reference number you receive, and use Track My Report to see its status. Remember: this prototype is not an official reporting channel.",
    },
    {
      id: "ann-demo-5",
      title: "Streetlight Repair Update (Sample)",
      category: "Community Information",
      date: daysAgoISO(11),
      isSample: true,
      summary: "Sample update about repaired streetlights in fictional areas.",
      body: "This is demonstration data.\n\nThe broken streetlight at the Sample Crossing has been replaced. Residents may report other broken streetlights through the Submit a Concern page.",
    },
  ];
}

// Add the sample data ONLY the first time. After that we never overwrite
// what the user (or the admin) saved, even if everything is later deleted.
function seedIfNeeded() {
  try {
    if (localStorage.getItem(KEYS.seeded)) return;
    saveData(KEYS.reports, getSampleReports());
    saveData(KEYS.announcements, getSampleAnnouncements());
    localStorage.setItem(KEYS.seeded, "yes");
  } catch (error) {
    /* storage unavailable – the pages will simply show empty states */
  }
}

// Used by the admin "Reset Demo Data" button.
function resetDemoData() {
  localStorage.removeItem(KEYS.reports);
  localStorage.removeItem(KEYS.announcements);
  localStorage.removeItem(KEYS.myRefs);
  localStorage.removeItem(KEYS.seeded);
  seedIfNeeded();
}

// Newest announcements first.
function sortedAnnouncements() {
  return loadData(KEYS.announcements, [])
    .slice()
    .sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
}

/* ==========================================================
   PART 2 – RESIDENT WEBSITE (index.html only)
   ========================================================== */
if (document.body.dataset.page === "resident") {
  initResident();
}

function initResident() {
  seedIfNeeded();

  const SECTIONS = [
    "home",
    "submit",
    "request",
    "track",
    "announcements",
    "about",
  ];

  /* ---------- Fill the drop-down lists ---------- */
  // The third value is the first "empty" option (the placeholder text).
  fillSelect(
    document.getElementById("concern-category"),
    CONCERN_CATEGORIES,
    "Select a category",
  );
  fillSelect(
    document.getElementById("request-type"),
    ASSISTANCE_TYPES,
    "Select a type",
  );
  fillSelect(
    document.getElementById("request-method"),
    CONTACT_METHODS,
    "Select a contact method",
  );
  fillSelect(
    document.getElementById("ann-filter"),
    ANNOUNCEMENT_CATEGORIES,
    "All categories",
  );

  /* ---------- Navigation between sections ---------- */
  // Each link uses href="#submit" etc. When the address changes, we show that section.
  function showSection() {
    let name = window.location.hash.replace("#", "") || "home";
    if (SECTIONS.indexOf(name) === -1) name = "home";

    document.querySelectorAll(".page-section").forEach(function (section) {
      section.classList.toggle("active", section.id === name);
    });
    document.querySelectorAll('.nav-link[href^="#"]').forEach(function (link) {
      const isCurrent = link.getAttribute("href") === "#" + name;
      link.classList.toggle("active", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    closeMenu();
    window.scrollTo(0, 0);

    // Refresh the content of the section we are about to show
    if (name === "home") renderHome();
    if (name === "announcements") renderAnnouncements();
    if (name === "track") renderMySubmissions();
  }
  window.addEventListener("hashchange", showSection);

  /* ---------- Mobile menu ---------- */
  const menuButton = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");
  function closeMenu() {
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  }
  menuButton.addEventListener("click", function () {
    const open = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ---------- HOME: announcements + example concerns ---------- */
  function renderHome() {
    const annBox = document.getElementById("home-announcements");
    const latest = sortedAnnouncements().slice(0, 3);
    if (latest.length === 0) {
      annBox.innerHTML =
        '<div class="empty-state"><strong>No announcements yet</strong>Check back later.</div>';
    } else {
      annBox.innerHTML = latest
        .map(function (a) {
          return (
            '<article class="mini-card">' +
            '<div class="card-meta"><span class="tag">' +
            escapeHTML(a.category) +
            "</span><span>" +
            formatDate(a.date) +
            "</span>" +
            (a.isSample ? '<span class="tag tag-demo">Demo data</span>' : "") +
            "</div>" +
            "<h3>" +
            escapeHTML(a.title) +
            "</h3>" +
            '<p class="small">' +
            escapeHTML(a.summary) +
            "</p>" +
            '<button type="button" class="link-btn" data-ann-id="' +
            escapeHTML(a.id) +
            '">Read full announcement</button>' +
            "</article>"
          );
        })
        .join("");
    }

    // Only the fictional sample concerns are shown publicly, so no resident's own report is exposed.
    const concernBox = document.getElementById("home-concerns");
    const examples = loadData(KEYS.reports, [])
      .filter(function (r) {
        return r.isSample && r.type === "concern";
      })
      .slice(0, 4);
    if (examples.length === 0) {
      concernBox.innerHTML =
        '<div class="empty-state"><strong>No example concerns</strong>Submit a concern to get started.</div>';
    } else {
      concernBox.innerHTML = examples
        .map(function (r) {
          return (
            '<article class="mini-card">' +
            '<div class="card-meta"><span class="tag">' +
            escapeHTML(r.category) +
            "</span>" +
            statusBadge(r.status) +
            "</div>" +
            "<h3>" +
            escapeHTML(r.title) +
            "</h3>" +
            '<p class="small muted">Reference: ' +
            escapeHTML(r.ref) +
            ' · <button type="button" class="link-btn" data-track-ref="' +
            escapeHTML(r.ref) +
            '">View progress</button></p>' +
            "</article>"
          );
        })
        .join("");
    }
  }

  /* ---------- ANNOUNCEMENTS page ---------- */
  function renderAnnouncements() {
    const filter = document.getElementById("ann-filter").value;
    const list = sortedAnnouncements().filter(function (a) {
      return !filter || a.category === filter;
    });
    const box = document.getElementById("announcement-list");
    if (list.length === 0) {
      box.innerHTML =
        '<div class="empty-state"><strong>No announcements found</strong>Try a different category.</div>';
      return;
    }
    box.innerHTML = list
      .map(function (a) {
        return (
          '<article class="card">' +
          '<div class="card-meta"><span class="tag">' +
          escapeHTML(a.category) +
          "</span><span>" +
          formatDate(a.date) +
          "</span>" +
          (a.isSample ? '<span class="tag tag-demo">Demo data</span>' : "") +
          "</div>" +
          "<h2>" +
          escapeHTML(a.title) +
          "</h2>" +
          "<p>" +
          escapeHTML(a.summary) +
          "</p>" +
          '<button type="button" class="btn btn-small btn-outline" data-ann-id="' +
          escapeHTML(a.id) +
          '">Read full announcement</button>' +
          "</article>"
        );
      })
      .join("");
  }
  document
    .getElementById("ann-filter")
    .addEventListener("change", renderAnnouncements);

  // Full announcement pop-up
  const annDialog = document.getElementById("ann-dialog");
  function openAnnouncement(id) {
    const a = loadData(KEYS.announcements, []).find(function (item) {
      return item.id === id;
    });
    if (!a) {
      showToast("That announcement could not be found.", "warning");
      return;
    }
    document.getElementById("ann-dialog-meta").textContent =
      a.category +
      " · " +
      formatDate(a.date) +
      (a.isSample ? " · Demo data" : "");
    document.getElementById("ann-dialog-title").textContent = a.title;
    // Keep line breaks, but still escape the text for safety
    document.getElementById("ann-dialog-text").innerHTML = escapeHTML(
      a.body,
    ).replace(/\n/g, "<br>");
    annDialog.showModal();
  }
  document
    .getElementById("ann-dialog-close")
    .addEventListener("click", function () {
      annDialog.close();
    });
  annDialog.addEventListener("click", function (e) {
    if (e.target === annDialog) annDialog.close();
  }); // click outside

  /* ---------- One click listener for buttons created by JavaScript ---------- */
  // "Event delegation": we listen once on the whole page instead of on every button.
  document.addEventListener("click", function (e) {
    const annBtn = e.target.closest("[data-ann-id]");
    if (annBtn) {
      openAnnouncement(annBtn.getAttribute("data-ann-id"));
      return;
    }
    const trackBtn = e.target.closest("[data-track-ref]");
    if (trackBtn) openTracking(trackBtn.getAttribute("data-track-ref"));
  });

  /* ---------- SUBMIT A CONCERN ---------- */
  const concernForm = document.getElementById("concern-form");
  const cTitle = document.getElementById("concern-title");
  const cCategory = document.getElementById("concern-category");
  const cDescription = document.getElementById("concern-description");
  const cLocation = document.getElementById("concern-location");
  const cDate = document.getElementById("concern-date");
  const cImage = document.getElementById("concern-image");
  const previewWrap = document.getElementById("image-preview-wrap");
  const previewImg = document.getElementById("image-preview");
  let previewURL = null;

  cDate.value = todayISO(); // automatically filled

  function validateConcern() {
    // Run every check (no early exit) so all messages appear at once.
    const results = [
      setError(
        cTitle,
        cTitle.value.trim().length < 5
          ? "Please enter a report title (at least 5 characters)."
          : "",
      ),
      setError(cCategory, !cCategory.value ? "Please choose a category." : ""),
      setError(
        cDescription,
        cDescription.value.trim().length < 15
          ? "Please describe the problem (at least 15 characters)."
          : "",
      ),
      setError(
        cLocation,
        cLocation.value.trim().length < 3
          ? "Please enter the location or area affected."
          : "",
      ),
    ];
    return results.every(Boolean);
  }

  concernForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateConcern()) {
      showToast("Please fix the highlighted fields.", "warning");
      const firstBad = concernForm.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    const ref = generateRef("RPT");
    const record = {
      ref: ref,
      type: "concern",
      title: cTitle.value.trim(),
      category: cCategory.value,
      description: cDescription.value.trim(),
      location: cLocation.value.trim(),
      date: cDate.value || todayISO(),
      status: "Submitted",
      adminNote: "",
      history: [
        {
          status: "Submitted",
          date: todayISO(),
          note: "Report saved in this demo.",
        },
      ],
      contactMethod: "",
      contact: "",
      isSample: false,
    };
    if (!saveRecord(record)) return;

    concernForm.reset();
    cDate.value = todayISO();
    clearImagePreview();
    [cTitle, cCategory, cDescription, cLocation].forEach(function (f) {
      setError(f, "");
    });

    document.getElementById("concern-success-ref").textContent = ref;
    document
      .getElementById("concern-track-btn")
      .setAttribute("data-track-ref", ref);
    concernForm.hidden = true;
    const panel = document.getElementById("concern-success");
    panel.hidden = false;
    panel.focus();
    showToast("Concern saved! Reference number: " + ref, "success");
  });

  // Clear errors as the user fixes a field
  [cTitle, cCategory, cDescription, cLocation].forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.getAttribute("aria-invalid") === "true") setError(field, "");
    });
    field.addEventListener("change", function () {
      if (field.getAttribute("aria-invalid") === "true") setError(field, "");
    });
  });

  document
    .getElementById("concern-clear-btn")
    .addEventListener("click", function () {
      concernForm.reset();
      cDate.value = todayISO();
      clearImagePreview();
      [cTitle, cCategory, cDescription, cLocation, cImage].forEach(
        function (f) {
          setError(f, "");
        },
      );
    });
  document
    .getElementById("concern-another-btn")
    .addEventListener("click", function () {
      document.getElementById("concern-success").hidden = true;
      concernForm.hidden = false;
      cTitle.focus();
    });

  // Optional image preview (demonstration only – not uploaded or saved)
  function clearImagePreview() {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
    previewImg.removeAttribute("src");
    previewWrap.hidden = true;
    cImage.value = "";
  }
  cImage.addEventListener("change", function () {
    const file = cImage.files[0];
    if (!file) {
      clearImagePreview();
      setError(cImage, "");
      return;
    }
    if (file.type.indexOf("image/") !== 0) {
      clearImagePreview();
      setError(cImage, "Please choose an image file (JPG, PNG, etc.).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      clearImagePreview();
      setError(cImage, "Please choose an image smaller than 2 MB.");
      return;
    }
    setError(cImage, "");
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);
    previewImg.src = previewURL;
    previewWrap.hidden = false;
  });
  document
    .getElementById("image-remove-btn")
    .addEventListener("click", clearImagePreview);

  /* ---------- REQUEST ASSISTANCE ---------- */
  const requestForm = document.getElementById("request-form");
  const rTitle = document.getElementById("request-title-input");
  const rType = document.getElementById("request-type");
  const rDescription = document.getElementById("request-description");
  const rMethod = document.getElementById("request-method");
  const rContact = document.getElementById("request-contact");

  // Optional contact info: check it loosely, based on the chosen method.
  function contactError() {
    const value = rContact.value.trim();
    if (!value || rMethod.value === "No contact needed") return "";
    if (rMethod.value === "Email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "Please enter a valid email address (fictional is fine).";
    if (
      (rMethod.value === "Phone Call" ||
        rMethod.value === "Text Message (SMS)") &&
      !/^[0-9+\-\s()]{7,20}$/.test(value)
    )
      return "Please enter a valid phone number (fictional is fine).";
    return "";
  }

  function validateRequest() {
    const results = [
      setError(
        rTitle,
        rTitle.value.trim().length < 5
          ? "Please enter a request title (at least 5 characters)."
          : "",
      ),
      setError(
        rType,
        !rType.value ? "Please choose a type of assistance." : "",
      ),
      setError(
        rDescription,
        rDescription.value.trim().length < 15
          ? "Please describe your request (at least 15 characters)."
          : "",
      ),
      setError(
        rMethod,
        !rMethod.value ? "Please choose a preferred contact method." : "",
      ),
      setError(rContact, contactError()),
    ];
    return results.every(Boolean);
  }

  requestForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateRequest()) {
      showToast("Please fix the highlighted fields.", "warning");
      const firstBad = requestForm.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    const ref = generateRef("REQ");
    const record = {
      ref: ref,
      type: "request",
      title: rTitle.value.trim(),
      category: rType.value,
      description: rDescription.value.trim(),
      location: "",
      date: todayISO(),
      status: "Submitted",
      adminNote: "",
      history: [
        {
          status: "Submitted",
          date: todayISO(),
          note: "Request saved in this demo. Not received by any real office.",
        },
      ],
      contactMethod: rMethod.value,
      contact: rContact.value.trim(),
      isSample: false,
    };
    if (!saveRecord(record)) return;

    requestForm.reset();
    [rTitle, rType, rDescription, rMethod, rContact].forEach(function (f) {
      setError(f, "");
    });

    document.getElementById("request-success-ref").textContent = ref;
    document
      .getElementById("request-track-btn")
      .setAttribute("data-track-ref", ref);
    requestForm.hidden = true;
    const panel = document.getElementById("request-success");
    panel.hidden = false;
    panel.focus();
    showToast("Request saved (demo only). Reference number: " + ref, "success");
  });

  [rTitle, rType, rDescription, rMethod, rContact].forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.getAttribute("aria-invalid") === "true") setError(field, "");
    });
    field.addEventListener("change", function () {
      if (field.getAttribute("aria-invalid") === "true") setError(field, "");
    });
  });
  document
    .getElementById("request-clear-btn")
    .addEventListener("click", function () {
      requestForm.reset();
      [rTitle, rType, rDescription, rMethod, rContact].forEach(function (f) {
        setError(f, "");
      });
    });
  document
    .getElementById("request-another-btn")
    .addEventListener("click", function () {
      document.getElementById("request-success").hidden = true;
      requestForm.hidden = false;
      rTitle.focus();
    });

  // Save a new record AND remember its reference number on this device.
  function saveRecord(record) {
    const reports = loadData(KEYS.reports, []);
    reports.push(record);
    if (!saveData(KEYS.reports, reports)) return false;
    const mine = loadData(KEYS.myRefs, []);
    mine.push(record.ref);
    saveData(KEYS.myRefs, mine);
    return true;
  }

  /* ---------- TRACK MY REPORT ---------- */
  const trackForm = document.getElementById("track-form");
  const trackInput = document.getElementById("track-ref");
  const trackResult = document.getElementById("track-result");

  trackForm.addEventListener("submit", function (e) {
    e.preventDefault();
    trackReference(trackInput.value);
  });

  // Go to the tracking section and show one reference number.
  function openTracking(ref) {
    trackInput.value = ref;
    if (window.location.hash !== "#track") {
      window.location.hash = "#track"; // triggers showSection()
    } else {
      showSection();
    }
    trackReference(ref);
  }

  function trackReference(rawRef) {
    const ref = rawRef.trim().toUpperCase();
    if (!ref) {
      trackResult.innerHTML =
        '<div class="notice notice-warn">Please type a reference number first.</div>';
      trackInput.focus();
      return;
    }
    const record = loadData(KEYS.reports, []).find(function (r) {
      return r.ref.toUpperCase() === ref;
    });
    if (!record) {
      trackResult.innerHTML =
        '<div class="empty-state"><strong>No report found for "' +
        escapeHTML(ref) +
        '"</strong>' +
        "Check the number for typing mistakes. Reference numbers look like RPT-261025-K7M2 or REQ-261025-K7M2. " +
        "Remember that this demo only finds reports saved in this browser.</div>";
      return;
    }
    trackResult.innerHTML = renderRecord(record);
  }

  // Build the result card. Contact details are intentionally NOT shown here.
  function renderRecord(r) {
    const isConcern = r.type === "concern";
    const history = (r.history || [])
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
    return (
      '<article class="card">' +
      '<div class="result-head"><div><p class="small muted">' +
      (isConcern ? "Concern" : "Assistance request") +
      (r.isSample ? " · Demo data" : "") +
      "</p><h2>" +
      escapeHTML(r.title) +
      "</h2></div>" +
      statusBadge(r.status) +
      "</div>" +
      '<dl class="details-grid">' +
      "<div><dt>Reference number</dt><dd>" +
      escapeHTML(r.ref) +
      "</dd></div>" +
      "<div><dt>Category</dt><dd>" +
      escapeHTML(r.category) +
      "</dd></div>" +
      "<div><dt>Submission date</dt><dd>" +
      formatDate(r.date) +
      "</dd></div>" +
      "<div><dt>Location</dt><dd>" +
      (isConcern ? escapeHTML(r.location) : "Not applicable") +
      "</dd></div>" +
      "<div><dt>Current status</dt><dd>" +
      escapeHTML(r.status) +
      "</dd></div>" +
      "</dl>" +
      "<h3>Description</h3><p>" +
      escapeHTML(r.description) +
      "</p>" +
      (r.adminNote
        ? '<div class="admin-note"><strong>Note from administrator (demo):</strong> ' +
          escapeHTML(r.adminNote) +
          "</div>"
        : "") +
      '<h3>Progress timeline</h3><ol class="timeline">' +
      history +
      "</ol>" +
      '<p class="small muted">Prototype only. This record is stored in your browser and is not part of any official system.</p>' +
      "</article>"
    );
  }

  // List of everything submitted on this device
  function renderMySubmissions() {
    const box = document.getElementById("my-submissions");
    const mine = loadData(KEYS.myRefs, []);
    const all = loadData(KEYS.reports, []);
    const items = mine
      .map(function (ref) {
        return all.find(function (r) {
          return r.ref === ref;
        });
      })
      .filter(Boolean)
      .reverse();
    if (items.length === 0) {
      box.innerHTML =
        '<div class="empty-state"><strong>Nothing submitted yet</strong>Reports you submit on this device will appear here.</div>';
      return;
    }
    box.innerHTML = items
      .map(function (r) {
        return (
          '<article class="mini-card">' +
          '<div class="card-meta"><span class="tag">' +
          escapeHTML(r.category) +
          "</span>" +
          statusBadge(r.status) +
          "<span>" +
          formatDate(r.date) +
          "</span></div>" +
          "<h3>" +
          escapeHTML(r.title) +
          "</h3>" +
          '<p class="small muted">' +
          escapeHTML(r.ref) +
          ' · <button type="button" class="link-btn" data-track-ref="' +
          escapeHTML(r.ref) +
          '">View details</button></p>' +
          "</article>"
        );
      })
      .join("");
  }

  /* ---------- Start the page ---------- */
  showSection();
}
