/*
 * Menu behaviour for the cross-tool nav (packages/brand/tool-nav.css).
 * Inlined into every entry page by scripts/lib/tool-nav.mjs. The menus are
 * <details> elements, so everything here is progressive enhancement: one open
 * at a time, close on outside click, close on Escape, close after picking a tool.
 */
(function () {
  var nav = document.querySelector(".tool-nav");
  if (!nav) return;

  var groups = Array.prototype.slice.call(nav.querySelectorAll("details.tool-nav-group"));

  function closeAll(except) {
    groups.forEach(function (group) {
      if (group !== except && group.open) group.open = false;
    });
  }

  groups.forEach(function (group) {
    group.addEventListener("toggle", function () {
      if (group.open) closeAll(group);
    });
  });

  document.addEventListener("click", function (event) {
    if (!nav.contains(event.target)) closeAll();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var open = groups.filter(function (group) {
      return group.open;
    })[0];
    if (!open) return;
    open.open = false;
    var summary = open.querySelector("summary");
    if (summary) summary.focus();
  });

  nav.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a.tool-nav-link") : null;
    if (link) closeAll();
  });
})();
