const tabList = document.getElementById("tool-tabs");
const toolPanel = document.getElementById("tool-panel");

/** @type {{ defaultTool: string; tools: { id: string; label: string; path: string }[] } | null} */
let hubConfig = null;

/** @type {Map<string, HTMLIFrameElement>} */
const iframeByToolId = new Map();

/** @type {Map<string, ResizeObserver>} */
const resizeObserverByToolId = new Map();

/** @type {string | null} */
let activeToolId = null;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatIntervalId = null;

function getToolById(id) {
  return hubConfig?.tools.find((tool) => tool.id === id) ?? null;
}

function getDefaultToolId() {
  if (!hubConfig?.tools?.length) return null;
  if (getToolById(hubConfig.defaultTool)) return hubConfig.defaultTool;
  return hubConfig.tools[0].id;
}

function getToolIdFromHash() {
  const match = location.hash.match(/^#\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function pathForTool(toolId) {
  return `/${encodeURIComponent(toolId)}/`;
}

function setActiveTab(toolId) {
  if (!hubConfig) return;

  const tool = getToolById(toolId);
  if (!tool) return;

  const tabs = tabList.querySelectorAll(".hub-tab");
  tabs.forEach((tab) => {
    const isActive = tab.dataset.toolId === toolId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  showToolFrame(toolId);
}

function resizeToolFrame(frame) {
  const doc = frame.contentDocument;
  if (!doc) return;

  const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
  frame.style.height = `${height}px`;
}

function observeToolFrame(frame, toolId) {
  const existing = resizeObserverByToolId.get(toolId);
  if (existing) existing.disconnect();

  const doc = frame.contentDocument;
  if (!doc?.body) return;

  const observer = new ResizeObserver(() => resizeToolFrame(frame));
  observer.observe(doc.body);
  resizeObserverByToolId.set(toolId, observer);
}

function notifyToolShown(frame) {
  try {
    frame.contentWindow?.postMessage(
      { source: "neonema-hub", type: "tool-shown" },
      window.location.origin,
    );
  } catch {
    // Cross-origin or unloaded frame — ignore.
  }
}

/**
 * Drive live tools from the parent page. Same-origin iframes often have
 * timers frozen (height:0 / display:none / background throttling); calling
 * into the child from the hub interval keeps clocks ticking.
 */
function pulseActiveTool() {
  if (!activeToolId) return;
  const frame = iframeByToolId.get(activeToolId);
  if (!frame || frame.hidden) return;

  const win = frame.contentWindow;
  if (!win) return;

  try {
    if (typeof win.neonemaToolHeartbeat === "function") {
      win.neonemaToolHeartbeat();
      return;
    }
  } catch {
    // Fall through to postMessage.
  }

  try {
    win.postMessage({ source: "neonema-hub", type: "heartbeat" }, window.location.origin);
  } catch {
    // Unloaded frame — ignore.
  }
}

function startHubHeartbeat() {
  if (heartbeatIntervalId != null) return;
  heartbeatIntervalId = setInterval(pulseActiveTool, 250);
}

function showToolFrame(toolId) {
  const tool = getToolById(toolId);
  if (!tool) return;

  activeToolId = toolId;

  for (const [id, frame] of iframeByToolId) {
    frame.hidden = id !== toolId;
  }

  let frame = iframeByToolId.get(toolId);
  if (!frame) {
    frame = document.createElement("iframe");
    frame.className = "tool-iframe";
    frame.title = tool.label;
    frame.src = tool.path;
    frame.dataset.toolId = toolId;
    frame.addEventListener("load", () => {
      resizeToolFrame(frame);
      observeToolFrame(frame, toolId);
      if (!frame.hidden) {
        notifyToolShown(frame);
        pulseActiveTool();
      }
    });
    toolPanel.appendChild(frame);
    iframeByToolId.set(toolId, frame);
  }

  frame.hidden = false;
  resizeToolFrame(frame);
  notifyToolShown(frame);
  pulseActiveTool();
  startHubHeartbeat();
}

/**
 * In-session hub UX: switch the iframe without leaving `/`.
 * Tab `href`s point at path URLs so crawlers, middle-click, and open-in-new-tab
 * hit the indexable tool page.
 */
function activateToolInHub(toolId) {
  if (!hubConfig || !getToolById(toolId)) return;
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  setActiveTab(toolId);
}

function applyInitialRoute() {
  const hashToolId = getToolIdFromHash();
  if (hashToolId && getToolById(hashToolId)) {
    // Legacy /#/<tool-id> bookmarks: stay on the hub and clear the hash.
    // Do not location.replace to /<tool-id>/ here — a stale edge 301 or
    // cached tool page that still redirects path → hash would loop forever.
    activateToolInHub(hashToolId);
    return;
  }

  const fallbackId = getDefaultToolId();
  if (fallbackId) {
    setActiveTab(fallbackId);
  }
}

function renderTabs(config) {
  tabList.replaceChildren();

  for (const tool of config.tools) {
    const tab = document.createElement("a");
    tab.className = "hub-tab";
    tab.href = pathForTool(tool.id);
    tab.role = "tab";
    tab.dataset.toolId = tool.id;
    tab.textContent = tool.label;
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("aria-controls", "tool-panel");
    tab.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      activateToolInHub(tool.id);
    });
    tabList.appendChild(tab);
  }
}

async function initHub() {
  try {
    const response = await fetch("./hub.config.json");
    if (!response.ok) {
      throw new Error(`Failed to load hub config (${response.status})`);
    }

    hubConfig = await response.json();
    if (!hubConfig?.tools?.length) {
      throw new Error("Hub config is missing tools");
    }

    renderTabs(hubConfig);
    applyInitialRoute();
  } catch (error) {
    tabList.replaceChildren();
    const message = document.createElement("p");
    message.className = "hub-error";
    message.textContent = "Could not load tool list. Refresh the page or try again later.";
    tabList.appendChild(message);
    console.error("hub init failed:", error);
  }
}

initHub();
