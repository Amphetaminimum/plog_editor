const story = document.querySelector(".landing-story");
const chapters = [...document.querySelectorAll("[data-story-chapter]")];
const frames = [...document.querySelectorAll("[data-story-frame]")];
const current = document.querySelector("[data-story-current]");
const label = document.querySelector("[data-story-label]");
const labels = ["Compose", "Draft with GPT‑5.6", "Export"];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const continuity = document.querySelector(".landing-continuity");
const revealSections = [...document.querySelectorAll("[data-landing-reveal]")];
let activeIndex = 0;
let ticking = false;

function showChapter(index) {
  const next = Math.max(0, Math.min(chapters.length - 1, index));
  if (next === activeIndex && frames[next]?.classList.contains("is-active")) return;
  activeIndex = next;
  chapters.forEach((chapter, chapterIndex) => {
    const active = chapterIndex === next;
    chapter.classList.toggle("is-active", active);
    chapter.setAttribute("aria-selected", String(active));
  });
  frames.forEach((frame, frameIndex) => frame.classList.toggle("is-active", frameIndex === next));
  if (current) current.textContent = String(next + 1).padStart(2, "0");
  if (label) label.textContent = labels[next];
}

function updateFromScroll() {
  ticking = false;
  if (story && !reducedMotion.matches && window.innerWidth >= 768) {
    const rect = story.getBoundingClientRect();
    const travel = Math.max(1, story.offsetHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(0.999, -rect.top / travel));
    showChapter(Math.floor(progress * chapters.length));
  }
  if (continuity && !reducedMotion.matches) {
    const rect = continuity.getBoundingClientRect();
    const travel = Math.max(1, rect.height - window.innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / travel));
    const stage = continuity.querySelector(".landing-continuity-stage");
    const canvas = continuity.querySelector(".landing-long-canvas");
    const canvasTravel = Math.max(520, (canvas?.offsetHeight || 0) - (stage?.clientHeight || 0) + 160);
    continuity.style.setProperty("--continuity-progress", progress.toFixed(3));
    continuity.style.setProperty("--continuity-shift", `${Math.round(110 - progress * canvasTravel)}px`);
  }
}

function requestUpdate() {
  if (document.hidden) {
    updateFromScroll();
    return;
  }
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(updateFromScroll);
}

chapters.forEach((chapter, index) => {
  chapter.addEventListener("click", () => {
    showChapter(index);
    if (!story || reducedMotion.matches || window.innerWidth < 768) return;
    const travel = story.offsetHeight - window.innerHeight;
    const target = story.offsetTop + travel * ((index + 0.12) / chapters.length);
    window.scrollTo({ top: target, behavior: "smooth" });
  });
});

window.addEventListener("scroll", requestUpdate, { passive: true });
window.addEventListener("resize", requestUpdate);
window.addEventListener("load", requestUpdate);
reducedMotion.addEventListener?.("change", requestUpdate);
document.querySelector(".landing-long-export")?.addEventListener("load", requestUpdate);
showChapter(0);
requestUpdate();

if ("IntersectionObserver" in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { threshold: 0.18 });
  revealSections.forEach((section) => observer.observe(section));
} else {
  revealSections.forEach((section) => section.classList.add("is-visible"));
}
