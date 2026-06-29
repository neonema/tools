const tabList = document.getElementById("tool-tabs");
const toolPanel = document.getElementById("tool-panel");

/** @type {{ defaultTool: string; tools: { id: string; label: string; path: string }[] } | null} */
let hubConfig = null;

/** @type {Map<string, HTMLIFrameElement>} */
const iframeByToolId = new Map();

/** @type {Map<string, ResizeObserver>} */
const resizeObserverByToolId = new Map();

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

function hashForTool(toolId) {
  return `#/${encodeURIComponent(toolId)}`;
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

function showToolFrame(toolId) {
  const tool = getToolById(toolId);
  if (!tool) return;

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
    });
    toolPanel.appendChild(frame);
    iframeByToolId.set(toolId, frame);
  }

  frame.hidden = false;
  resizeToolFrame(frame);
}

function navigateToTool(toolId, { replace = false } = {}) {
  if (!hubConfig || !getToolById(toolId)) return;

  const nextHash = hashForTool(toolId);

  if (location.hash === nextHash) {
    setActiveTab(toolId);
    return;
  }

  if (replace) {
    history.replaceState({ toolId }, "", nextHash);
    setActiveTab(toolId);
    return;
  }

  location.hash = nextHash;
}

function applyRouteFromHash() {
  const toolId = getToolIdFromHash();
  if (toolId && getToolById(toolId)) {
    setActiveTab(toolId);
    return;
  }

  const fallbackId = getDefaultToolId();
  if (fallbackId) {
    navigateToTool(fallbackId, { replace: true });
  }
}

function renderTabs(config) {
  tabList.replaceChildren();

  for (const tool of config.tools) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "hub-tab";
    tab.role = "tab";
    tab.dataset.toolId = tool.id;
    tab.textContent = tool.label;
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("aria-controls", "tool-panel");
    tab.addEventListener("click", () => navigateToTool(tool.id));
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
    applyRouteFromHash();
    window.addEventListener("hashchange", applyRouteFromHash);
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
