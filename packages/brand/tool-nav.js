/*
 * Sidebar behaviour for the cross-tool nav (packages/brand/tool-nav.css).
 * Inlined into every entry page by scripts/lib/tool-nav.mjs.
 * The list itself is plain links, so this is progressive enhancement:
 * collapse, a name filter, and Escape to close.
 * Meaning-based search is not implemented here.
 */
(function () {
  var nav = document.querySelector(".tool-nav");
  if (!nav) return;

  var search = nav.querySelector(".tool-nav-search");
  var empty = nav.querySelector(".tool-nav-empty");
  var collapseBtn = nav.querySelector(".tool-nav-collapse");
  var reopenBtn = document.querySelector(".tool-nav-reopen");
  var backdrop = document.querySelector(".tool-nav-backdrop");
  var links = Array.prototype.slice.call(nav.querySelectorAll("a.tool-nav-link"));
  var root = document.documentElement;
  var header = document.querySelector(".header");

  function syncHeaderOffset() {
    var height = header ? header.getBoundingClientRect().height : 0;
    root.style.setProperty("--tool-nav-offset", Math.round(height) + "px");
  }

  syncHeaderOffset();
  window.addEventListener("resize", syncHeaderOffset);

  function isCollapsed() {
    return root.classList.contains("tool-nav-collapsed");
  }

  function setCollapsed(collapsed) {
    root.classList.toggle("tool-nav-collapsed", collapsed);
    if (collapseBtn) collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (reopenBtn) reopenBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }

  setCollapsed(isCollapsed());

  if (collapseBtn) {
    collapseBtn.addEventListener("click", function () {
      setCollapsed(true);
      if (reopenBtn) reopenBtn.focus();
    });
  }

  if (reopenBtn) {
    reopenBtn.addEventListener("click", function () {
      setCollapsed(false);
      if (search) search.focus();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      setCollapsed(true);
    });
  }

  function applyFilter() {
    var query = search ? search.value.trim().toLowerCase() : "";
    var shown = 0;
    links.forEach(function (link) {
      var label = (link.textContent || "").toLowerCase();
      var match = !query || label.indexOf(query) !== -1;
      if (match) {
        link.removeAttribute("hidden");
        shown += 1;
      } else {
        link.setAttribute("hidden", "");
      }
    });
    if (!empty) return;
    if (query && shown === 0) empty.removeAttribute("hidden");
    else empty.setAttribute("hidden", "");
  }

  if (search) {
    search.addEventListener("input", applyFilter);
    search.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!search.value) return;
      search.value = "";
      applyFilter();
      event.stopPropagation();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || isCollapsed()) return;
    var target = event.target;
    if (target && target.closest && target.closest("iframe")) return;
    setCollapsed(true);
  });

  nav.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a.tool-nav-link") : null;
    if (!link) return;
    if (window.matchMedia("(max-width: 768px)").matches) setCollapsed(true);
  });

  var current = nav.querySelector(".tool-nav-link[aria-current='page']");
  if (current && current.scrollIntoView) current.scrollIntoView({ block: "nearest" });
})();
