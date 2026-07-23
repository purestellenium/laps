const revealGate = () => document.body.classList.add("ready");
const stageForGate = document.querySelector(".stage");

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  revealGate();
} else {
  if (stageForGate) {
    stageForGate.addEventListener("animationend", revealGate, { once: true });
  }
  setTimeout(revealGate, 2200);
}

window.addEventListener("pageshow", (e) => {
  if (e.persisted) revealGate();
});

const tabs = [...document.querySelectorAll(".tabs a")];
const panels = [...document.querySelectorAll(".panel")];
const byTab = (name) => panels.find((p) => p.dataset.tab === name);

const SLIDE_MS = 500;
let current = 0;
let animating = false;

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
    if (isBlogTab && i === current) {
      showBlogList();
      return;
    }
    if (animating || i === current) return;
    switchTo(i);
    if (isBlogTab) showBlogListInstant();
  });
});

function switchTo(next, forcedDir) {
  animating = true;

  const dir = forcedDir ?? (next > current ? 1 : -1);
  const incoming = byTab(tabs[next].dataset.tab);
  const outgoing = byTab(tabs[current].dataset.tab);

  incoming.style.transition = "none";
  incoming.style.transform = `translateX(${dir * 100}%)`;
  incoming.style.opacity = "0";
  incoming.classList.add("active");
  void incoming.offsetWidth;

  incoming.style.transition = "";
  incoming.style.transform = "";
  incoming.style.opacity = "";

  outgoing.classList.remove("active");
  outgoing.style.transform = `translateX(${-dir * 100}%)`;
  outgoing.style.opacity = "0";

  tabs[current].classList.remove("active");
  tabs[next].classList.add("active");
  current = next;

  history.replaceState(null, "", `#${tabs[next].dataset.tab}`);

  setTimeout(() => {
    outgoing.style.transition = "none";
    outgoing.style.transform = "";
    outgoing.style.opacity = "";
    void outgoing.offsetWidth;
    outgoing.style.transition = "";
    animating = false;
  }, SLIDE_MS + 20);
}

document.querySelectorAll(".tab-arrow").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (animating) return;
    const dir = Number(btn.dataset.dir);
    const next = (current + dir + tabs.length) % tabs.length;
    switchTo(next, dir);
    if (tabs[next].dataset.tab === "blog") showBlogListInstant();
  });
});

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

document.querySelectorAll(".copy-email").forEach((el) => {
  const label = el.dataset.copy;
  const original = el.textContent.trim();
  let resetTimer;

  el.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(label);
    } catch {
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

function crossfadeBlog(hideEl, showEl) {
  if (!hideEl || !showEl || hideEl.hidden) return;
  hideEl.classList.add("blog-fade-out");
  setTimeout(() => {
    hideEl.hidden = true;
    hideEl.classList.remove("blog-fade-out");
    showEl.hidden = false;
    showEl.classList.add("blog-fade-out");
    void showEl.offsetWidth;
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
    const [tabName, slug] = location.hash.slice(1).split("/");
    if (tabName === "blog" && slug) showBlogPostInstant(slug);
  })
  .catch(() => {
    renderBlogList();
  });

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const cursorEl = document.getElementById("cursor");
  const cursorInnerEl = document.getElementById("cursor-inner");

  if (cursorEl && cursorInnerEl) {
    document.addEventListener("mousemove", (e) => {
      cursorEl.style.left = `${e.clientX}px`;
      cursorEl.style.top = `${e.clientY}px`;
    });

    const DEGREES_PER_MS = 360 / 1600;
    const CURSOR_OVERSHOOT = 5;
    let angle = 0;
    let spinning = true;
    let lastTime = null;

    function tick(time) {
      if (lastTime === null) lastTime = time;
      const dt = time - lastTime;
      lastTime = time;

      if (spinning) {
        angle = (angle + dt * DEGREES_PER_MS) % 360;
        cursorInnerEl.style.transform = `rotate(${angle}deg)`;
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    let hoveredEl = null;

    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("a, button");
      if (!el || el === hoveredEl) return;
      hoveredEl = el;

      const rect = el.getBoundingClientRect();
      cursorEl.style.width = `${rect.width + CURSOR_OVERSHOOT * 2}px`;
      cursorEl.style.height = `${rect.height + CURSOR_OVERSHOOT * 2}px`;
      cursorEl.style.filter = "brightness(60%)";
      spinning = false;
      angle = 0;
      cursorInnerEl.style.transform = "rotate(0deg)";
    });

    document.addEventListener("mouseout", (e) => {
      if (!hoveredEl || hoveredEl.contains(e.relatedTarget)) return;
      hoveredEl = null;

      cursorEl.style.width = "";
      cursorEl.style.height = "";
      cursorEl.style.filter = "";
      spinning = true;
    });
  }
}
