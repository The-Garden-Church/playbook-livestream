(function () {
  "use strict";

  var STORAGE_PREFIX = "tgc-playbook-checklist:";
  var midnightTimer = null;

  function storageKey() {
    return STORAGE_PREFIX + window.location.pathname;
  }

  // Local-time YYYY-MM-DD so "today" matches the user's calendar day,
  // not UTC.
  function todayStamp() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // State shape: { date: "YYYY-MM-DD", items: { "<key>": true, ... } }
  // If a stored payload is from a previous day, treat it as empty.
  function loadState() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return { date: todayStamp(), items: {} };
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.date !== todayStamp()) {
        localStorage.removeItem(storageKey());
        return { date: todayStamp(), items: {} };
      }
      if (!parsed.items || typeof parsed.items !== "object") {
        parsed.items = {};
      }
      return parsed;
    } catch (e) {
      return { date: todayStamp(), items: {} };
    }
  }

  function saveState(state) {
    try {
      state.date = todayStamp();
      localStorage.setItem(storageKey(), JSON.stringify(state));
    } catch (e) {
      // Private browsing or storage quota; silently ignore.
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(storageKey());
    } catch (e) {
      // ignore
    }
  }

  function getCheckboxes() {
    return Array.prototype.slice.call(
      document.querySelectorAll(
        '.md-content .task-list-item input[type="checkbox"]'
      )
    );
  }

  function itemKey(checkbox, idx) {
    var li = checkbox.closest("li");
    var text = li ? li.textContent.trim().replace(/\s+/g, " ").slice(0, 240) : "";
    return text || "idx-" + idx;
  }

  function uncheckAll() {
    getCheckboxes().forEach(function (cb) {
      cb.checked = false;
    });
  }

  function restoreState() {
    var state = loadState();
    getCheckboxes().forEach(function (cb, idx) {
      cb.disabled = false;
      cb.removeAttribute("disabled");
      if (state.items[itemKey(cb, idx)] === true) {
        cb.checked = true;
      }
    });
  }

  function attachListeners() {
    getCheckboxes().forEach(function (cb, idx) {
      cb.addEventListener("change", function () {
        var state = loadState();
        var key = itemKey(cb, idx);
        if (cb.checked) {
          state.items[key] = true;
        } else {
          delete state.items[key];
        }
        saveState(state);
        updateSectionCounts();
      });
    });
  }

  // Walk siblings of an H2 until the next H2 (or end of section) and
  // tally how many task-list-items live there and how many are checked.
  function sectionStats(h2) {
    var total = 0;
    var checked = 0;
    var node = h2.nextElementSibling;
    while (node && node.tagName !== "H2") {
      if (node.querySelectorAll) {
        Array.prototype.forEach.call(
          node.querySelectorAll(".task-list-item"),
          function (li) {
            var cb = li.querySelector('input[type="checkbox"]');
            if (!cb) return;
            total++;
            if (cb.checked) checked++;
          }
        );
      }
      node = node.nextElementSibling;
    }
    return { total: total, checked: checked };
  }

  // Append "(X/Y)" to every H2 that has checklist items in its section.
  // Removes the counter again if the section has no items (e.g. after a
  // page navigation under Material's instant loading).
  function updateSectionCounts() {
    var headings = Array.prototype.slice.call(
      document.querySelectorAll(".md-content h2")
    );
    headings.forEach(function (h2) {
      var stats = sectionStats(h2);
      var counter = h2.querySelector(".tgc-section-count");
      if (stats.total === 0) {
        if (counter) counter.remove();
        return;
      }
      if (!counter) {
        counter = document.createElement("span");
        counter.className = "tgc-section-count";
        var headerlink = h2.querySelector(".headerlink");
        if (headerlink) {
          h2.insertBefore(counter, headerlink);
        } else {
          h2.appendChild(counter);
        }
      }
      counter.textContent = "(" + stats.checked + "/" + stats.total + ")";
      counter.classList.toggle(
        "tgc-section-count--done",
        stats.checked === stats.total
      );
    });
  }

  // Make the whole task-list row clickable. Clicks anywhere on the <li>
  // (except on actual interactive children like links) toggle the
  // checkbox and dispatch a synthetic change event so the listeners
  // above persist the new state.
  function makeRowsClickable() {
    var rows = Array.prototype.slice.call(
      document.querySelectorAll(".md-content .task-list-item")
    );
    rows.forEach(function (li) {
      if (li.dataset.tgcClickable === "1") return;
      li.dataset.tgcClickable = "1";
      li.classList.add("tgc-task-row");
      li.addEventListener("click", function (e) {
        // Let real interactive children handle their own clicks.
        if (e.target.closest("input, a, button, label, summary")) return;
        var cb = li.querySelector('input[type="checkbox"]');
        if (!cb) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  // Schedule a single timer to fire at the next local midnight. When it
  // fires, clear state, uncheck the live page, and re-arm for the day
  // after. This handles the "tab left open overnight" case; the load-time
  // date check handles every other case.
  function scheduleMidnightClear() {
    if (midnightTimer !== null) {
      clearTimeout(midnightTimer);
      midnightTimer = null;
    }
    var now = new Date();
    var nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      5 // 5s past midnight to avoid edge-of-day rounding
    );
    var msUntilMidnight = nextMidnight.getTime() - now.getTime();
    midnightTimer = setTimeout(function () {
      clearState();
      uncheckAll();
      updateSectionCounts();
      scheduleMidnightClear();
    }, msUntilMidnight);
  }

  function injectControls() {
    var checkboxes = getCheckboxes();
    if (checkboxes.length === 0) return;

    var content =
      document.querySelector(".md-content article") ||
      document.querySelector(".md-content");
    if (!content) return;
    if (content.querySelector(".tgc-checklist-controls")) return;

    var wrapper = document.createElement("aside");
    wrapper.className = "tgc-checklist-controls";

    var note = document.createElement("p");
    note.className = "tgc-checklist-note";
    note.innerHTML =
      "<strong>Working through this checklist?</strong> " +
      "Tick boxes as you go. Progress is saved on this device and " +
      "clears automatically at midnight, so each day starts fresh. " +
      "Hit <em>Reset</em> any time to clear it now.";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "tgc-checklist-reset";
    button.textContent = "Reset checklist";
    button.addEventListener("click", function () {
      var ok = window.confirm("Reset every checkbox on this page?");
      if (!ok) return;
      clearState();
      uncheckAll();
      updateSectionCounts();
    });

    wrapper.appendChild(note);
    wrapper.appendChild(button);

    var h1 = content.querySelector("h1");
    if (h1 && h1.parentNode) {
      h1.parentNode.insertBefore(wrapper, h1.nextSibling);
    } else {
      content.insertBefore(wrapper, content.firstChild);
    }
  }

  function init() {
    restoreState();
    attachListeners();
    makeRowsClickable();
    injectControls();
    updateSectionCounts();
    if (getCheckboxes().length > 0) {
      scheduleMidnightClear();
    }
  }

  // Material for MkDocs exposes a `document$` observable that fires on
  // each navigation (instant loading or otherwise). Use it when present;
  // otherwise fall back to standard DOM events.
  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(init);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
