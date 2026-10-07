const measureBtn = document.getElementById("measure-btn");
const track = document.getElementById("sweep");
const bar = document.getElementById("sweep-bar");
const hzEl = document.getElementById("hz");
const detail = document.getElementById("detail");

let measuring = false;

function placeBar(frameIndex) {
  const span = Math.max(0, track.clientWidth - bar.offsetWidth);
  const phase = (frameIndex % 48) / 47;
  bar.style.transform = `translateX(${phase * span}px)`;
}

function resetBar() {
  bar.style.transform = "translateX(0)";
}

function showFailure(message) {
  measuring = false;
  measureBtn.disabled = false;
  measureBtn.textContent = "Measure";
  hzEl.textContent = "—";
  detail.textContent = message;
  resetBar();
}

function showResult(times) {
  measuring = false;
  measureBtn.disabled = false;
  measureBtn.textContent = "Measure again";
  resetBar();
  const hz = RefreshRate.hzFromFrameTimes(times);
  if (hz === null) {
    showFailure("Not enough frames to measure. Try again with this tab in front.");
    return;
  }
  const common = RefreshRate.nearestCommonRate(hz);
  const measured = hz.toFixed(1);
  if (common) {
    hzEl.textContent = String(common);
    detail.textContent = `Measured ${measured} frames per second over 2 seconds.`;
  } else {
    hzEl.textContent = measured;
    detail.textContent = `Measured ${measured} frames per second. That is not close to a common monitor rate.`;
  }
}

function measure() {
  if (measuring) return;
  if (document.hidden) {
    showFailure("Switch back to this tab, then measure again.");
    return;
  }
  measuring = true;
  measureBtn.disabled = true;
  measureBtn.textContent = "Measuring…";
  hzEl.textContent = "—";
  detail.textContent = "Measuring for 2 seconds. Keep this tab in front.";
  const times = [];
  const start = performance.now();

  function frame(now) {
    if (!measuring) return;
    if (document.hidden) {
      showFailure("The tab was hidden, so the measurement stopped. Measure again with this tab in front.");
      return;
    }
    times.push(now);
    placeBar(times.length);
    if (now - start < RefreshRate.SAMPLE_MS) {
      requestAnimationFrame(frame);
      return;
    }
    showResult(times);
  }

  requestAnimationFrame(frame);
}

measureBtn.addEventListener("click", measure);
