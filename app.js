// keep intro elements non-interactive until they've animated on-screen.
// the stage's fade-in is the last thing to finish; a timeout backstops it
// in case the animation never fires (e.g. reduced motion).
const revealGate = () => document.body.classList.add("ready");
const stageForGate = document.querySelector(".stage");
if (stageForGate) {
  stageForGate.addEventListener("animationend", revealGate, { once: true });
}
setTimeout(revealGate, 2200);

// tab switching with direction-aware sliding panels
const tabs = [...document.querySelectorAll(".tabs a")];
const panels = [...document.querySelectorAll(".panel")];
const byTab = (name) => panels.find((p) => p.dataset.tab === name);

const SLIDE_MS = 500;
let current = 0; // index of the active tab
let animating = false;

tabs.forEach((tab, i) => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    if (animating || i === current) return;
    switchTo(i);
  });
});

function switchTo(next, forcedDir) {
  animating = true;

  // direction: moving to a later tab slides content in from the right (+1),
  // an earlier tab slides in from the left (-1). the footer arrows pass an
  // explicit direction so wrap-around still slides the intuitive way.
  const dir = forcedDir ?? (next > current ? 1 : -1);
  const incoming = byTab(tabs[next].dataset.tab);
  const outgoing = byTab(tabs[current].dataset.tab);

  // park the incoming panel just off-screen on the entering side, no transition
  incoming.style.transition = "none";
  incoming.style.transform = `translateX(${dir * 100}%)`;
  incoming.style.opacity = "0";
  incoming.classList.add("active");
  void incoming.offsetWidth; // force reflow so the next change animates

  // release inline styles -> .active drives it to translateX(0)/opacity 1
  incoming.style.transition = "";
  incoming.style.transform = "";
  incoming.style.opacity = "";

  // slide the outgoing panel out the opposite side
  outgoing.classList.remove("active");
  outgoing.style.transform = `translateX(${-dir * 100}%)`;
  outgoing.style.opacity = "0";

  // update tab highlight
  tabs[current].classList.remove("active");
  tabs[next].classList.add("active");
  current = next;

  // reset the outgoing panel once it has left the stage
  setTimeout(() => {
    outgoing.style.transition = "none";
    outgoing.style.transform = "";
    outgoing.style.opacity = "";
    void outgoing.offsetWidth;
    outgoing.style.transition = "";
    animating = false;
  }, SLIDE_MS + 20);
}

// footer arrows step through the tabs (wrapping around at the ends)
document.querySelectorAll(".tab-arrow").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (animating) return;
    const dir = Number(btn.dataset.dir);
    const next = (current + dir + tabs.length) % tabs.length;
    switchTo(next, dir);
  });
});

// show the SHA of the actually-deployed commit (written by build.js at deploy)
const shaEl = document.getElementById("commit-sha");
if (shaEl) {
  fetch("/commit.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(({ sha }) => {
      if (!sha || sha === "unknown") throw new Error("no sha");
      shaEl.textContent = sha.slice(0, 7);
      shaEl.href = `https://github.com/purestellenium/laps/commit/${sha}`;
    })
    .catch(() => {
      shaEl.textContent = "unknown";
    });
}

// click any email link to copy it (with brackets) to the clipboard.
// there can be more than one (home + links tab), each restoring its own text.
document.querySelectorAll(".copy-email").forEach((el) => {
  const label = el.dataset.copy;
  const original = el.textContent.trim();
  let resetTimer;

  el.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(label);
    } catch {
      // fallback for insecure contexts / older browsers
      const ta = document.createElement("textarea");
      ta.value = label;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }

    el.textContent = "copied!";
    el.classList.add("copied");
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      el.textContent = original;
      el.classList.remove("copied");
    }, 1400);
  });
});
