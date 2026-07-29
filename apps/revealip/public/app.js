const ipLabel = document.getElementById("ip-label");
const primaryIp = document.getElementById("primary-ip");
const secondaryWrap = document.getElementById("secondary-wrap");
const secondaryLabel = document.getElementById("secondary-label");
const secondaryIp = document.getElementById("secondary-ip");
const errorBox = document.getElementById("error-box");
const copyBtn = document.getElementById("copy-btn");
const copyStatus = document.getElementById("copy-status");

let currentPreferred = "";
let isLoadingIp = false;

async function loadIp() {
  if (isLoadingIp) return;
  isLoadingIp = true;
  try {
    const response = await fetch(`/api/ip?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();

    if (!payload.preferred) {
      primaryIp.textContent = "Not found";
      ipLabel.textContent = "IP address";
      errorBox.classList.remove("hidden");
      copyBtn.disabled = true;
      isLoadingIp = false;
      return;
    }

    errorBox.classList.add("hidden");
    currentPreferred = payload.preferred;
    primaryIp.textContent = payload.preferred;

    if (payload.ipv4) {
      ipLabel.textContent = "IPv4 Address";
      if (payload.ipv6) {
        secondaryWrap.classList.remove("hidden");
        secondaryLabel.textContent = "IPv6 Address";
        secondaryIp.textContent = payload.ipv6;
      } else {
        secondaryWrap.classList.add("hidden");
      }
    } else {
      ipLabel.textContent = "IPv6 Address";
      secondaryWrap.classList.add("hidden");
    }

    copyBtn.disabled = false;
  } catch (error) {
    primaryIp.textContent = "Not found";
    ipLabel.textContent = "IP address";
    errorBox.classList.remove("hidden");
    copyBtn.disabled = true;
  } finally {
    isLoadingIp = false;
  }
}

copyBtn.addEventListener("click", async () => {
  if (!currentPreferred) return;
  try {
    await navigator.clipboard.writeText(currentPreferred);
    copyStatus.textContent = "Copied to clipboard";
    setTimeout(() => {
      copyStatus.textContent = "";
    }, 1500);
  } catch (error) {
    copyStatus.textContent = "Copy failed";
  }
});

loadIp();
setInterval(loadIp, 10000);
window.addEventListener("online", loadIp);
window.addEventListener("focus", loadIp);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadIp();
});
