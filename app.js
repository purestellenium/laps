// keep intro elements non-interactive until they've animated on-screen.
// the stage's fade-in is the last thing to finish; a timeout backstops it
// in case the animation never fires.
const revealGate = () => document.body.classList.add("ready");
const stageForGate = document.querySelector(".stage");

// prefers-reduced-motion strips the intro animation entirely (see
// styles.css), so .stage never dispatches animationend — reveal right away
// instead of sitting through the full timeout with nothing on screen to
// show for it.
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  revealGate();
} else {
  if (stageForGate) {
    stageForGate.addEventListener("animationend", revealGate, { once: true });
  }
  setTimeout(revealGate, 2200);
}

// mobile browsers sometimes restore a reloaded page from the back-forward
// cache instead of doing a fresh load. if that happens mid-intro, the
// animationend/setTimeout above can both get eaten (timers and CSS
// animations freeze and resume inconsistently across the freeze), leaving
// the page stuck non-interactive. `persisted` means "this is a bfcache
// restore" — reveal immediately rather than waiting on either signal.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) revealGate();
});

// tab switching with direction-aware sliding panels
const tabs = [...document.querySelectorAll(".tabs a")];
const panels = [...document.querySelectorAll(".panel")];
const byTab = (name) => panels.find((p) => p.dataset.tab === name);

const SLIDE_MS = 500;
let current = 0; // index of the active tab
let animating = false;

// restore the tab from the url hash so a refresh doesn't bounce back to home.
// blog posts extend the hash to "blog/<slug>" (handled below, once posts.json
// has loaded), so only the part before the "/" identifies the tab here.
const [hashTabName] = location.hash.slice(1).split("/");
const hashTab = tabs.findIndex((t) => t.dataset.tab === hashTabName);
if (hashTab > 0) {
  tabs[current].classList.remove("active");
  panels[current].classList.remove("active");
  current = hashTab;
  tabs[current].classList.add("active");
  panels[current].classList.add("active");
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    const isBlogTab = tab.dataset.tab === "blog";
    // clicking "blog" while already there (even mid-post) resets to the list,
    // same as clicking a site's logo resets to its homepage
    if (isBlogTab && i === current) {
      showBlogList();
      return;
    }
    if (animating || i === current) return;
    switchTo(i);
    // the tab-slide already provides the motion here — resetting to the list
    // should be instant so it doesn't fight with that animation
    if (isBlogTab) showBlogListInstant();
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

  // keep the url in sync so a refresh lands back on this tab
  history.replaceState(null, "", `#${tabs[next].dataset.tab}`);

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
    if (tabs[next].dataset.tab === "blog") showBlogListInstant();
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

// blog: fetch the manifest build.js generates from posts/*.md, render a list
// in the blog tab, and swap to a single post's rendered HTML on click. posts
// are pre-rendered at build time, so no markdown parsing happens here.
const blogListEl = document.getElementById("blog-list");
const blogPostEl = document.getElementById("blog-post");
const blogTitleEl = blogPostEl?.querySelector(".blog-post-title");
const blogMetaEl = blogPostEl?.querySelector(".blog-post-meta");
const blogBodyEl = blogPostEl?.querySelector(".blog-post-body");
const blogBackEl = blogPostEl?.querySelector(".blog-back");

let posts = [];

function formatPostDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderBlogList() {
  if (!blogListEl) return;
  if (!posts.length) {
    blogListEl.innerHTML = `
      <div class="coming-soon">
        <p class="coming-soon-title">no posts yet</p>
        <p class="coming-soon-sub">check back soon.</p>
      </div>`;
    return;
  }
  blogListEl.innerHTML = `<ul class="index-list">${posts
    .map(
      (post, i) => `
      <li>
        <span class="idx">${String(i + 1).padStart(2, "0")}</span>
        <a class="name" href="#blog/${post.slug}" data-slug="${post.slug}">${post.title}</a>
        <span class="desc">${formatPostDate(post.date)} · ${post.readingMinutes} min read</span>
      </li>`,
    )
    .join("")}</ul>`;
}

function fillBlogPost(post) {
  blogTitleEl.textContent = post.title;
  blogMetaEl.textContent = `${formatPostDate(post.date)} · ${post.readingMinutes} min read`;
  blogBodyEl.innerHTML = post.html;
}

// instant, no animation — for establishing state on load, not for reacting
// to a click (that's showBlogList/showBlogPost below)
function showBlogListInstant() {
  if (blogListEl) blogListEl.hidden = false;
  if (blogPostEl) blogPostEl.hidden = true;
  history.replaceState(null, "", "#blog");
}

function showBlogPostInstant(slug) {
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    showBlogListInstant();
    return;
  }
  fillBlogPost(post);
  if (blogListEl) blogListEl.hidden = true;
  blogPostEl.hidden = false;
  history.replaceState(null, "", `#blog/${slug}`);
}

const BLOG_FADE_MS = 220;

// fades `hideEl` out, then swaps `hidden` and fades `showEl` in. a no-op if
// showEl is already the visible one (e.g. clicking "blog" while it's already
// showing the list shouldn't replay the animation).
function crossfadeBlog(hideEl, showEl) {
  if (!hideEl || !showEl || hideEl.hidden) return;
  hideEl.classList.add("blog-fade-out");
  setTimeout(() => {
    hideEl.hidden = true;
    hideEl.classList.remove("blog-fade-out");
    showEl.hidden = false;
    showEl.classList.add("blog-fade-out");
    void showEl.offsetWidth; // force reflow so removing the class transitions
    showEl.classList.remove("blog-fade-out");
  }, BLOG_FADE_MS);
}

function showBlogList() {
  history.replaceState(null, "", "#blog");
  crossfadeBlog(blogPostEl, blogListEl);
}

function showBlogPost(slug) {
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    showBlogList();
    return;
  }
  fillBlogPost(post);
  history.replaceState(null, "", `#blog/${slug}`);
  crossfadeBlog(blogListEl, blogPostEl);
}

// event delegation: the list's <a> tags are (re)built by renderBlogList, so
// one listener on the container covers all of them
blogListEl?.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-slug]");
  if (!link) return;
  e.preventDefault();
  showBlogPost(link.dataset.slug);
});

blogBackEl?.addEventListener("click", (e) => {
  e.preventDefault();
  showBlogList();
});

fetch("/posts.json", { cache: "no-store" })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((data) => {
    posts = data;
    renderBlogList();
    // a direct link to a post (e.g. #blog/some-post) opens straight to it —
    // instant, since this is establishing initial state, not reacting to a click
    const [tabName, slug] = location.hash.slice(1).split("/");
    if (tabName === "blog" && slug) showBlogPostInstant(slug);
  })
  .catch(() => {
    renderBlogList(); // falls back to the "no posts yet" empty state
  });
