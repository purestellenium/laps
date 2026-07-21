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

function switchTo(next) {
  animating = true;

  // direction: moving to a later tab slides content in from the right (+1),
  // an earlier tab slides in from the left (-1)
  const dir = next > current ? 1 : -1;
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
