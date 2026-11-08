/* A bounded, CSS-driven sky: no animation loop, scroll listeners or network assets. */
(() => {
  const root = document.querySelector("[data-home-atmosphere]");
  if (!root || root.dataset.ambientReady) return;
  const stars = root.querySelector("[data-ambient-stars]");
  const meteors = root.querySelector("[data-ambient-meteors]");
  if (!stars || !meteors) return;
  root.dataset.ambientReady = "true";

  const compact = window.matchMedia("(max-width: 700px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pageActive = true;

  function populateSky() {
    const starField = document.createDocumentFragment();
    const meteorField = document.createDocumentFragment();
    const count = compact.matches ? 34 : 72;
    // Irrational steps distribute points evenly without a repeating grid or random layout jumps.
    for (let index = 0; index < count; index += 1) {
      const star = document.createElement("i");
      star.className = index % 9 === 0 ? "ambient-star ambient-star--glint" : "ambient-star";
      star.style.setProperty("--star-x", `${((index * 61.8034 + 7) % 100).toFixed(2)}%`);
      star.style.setProperty("--star-y", `${((index * 41.4214 + 13) % 100).toFixed(2)}%`);
      star.style.setProperty("--star-size", `${index % 4 === 0 ? 2 : 1}px`);
      star.style.setProperty("--star-opacity", `${.3 + (index % 5) * .12}`);
      star.style.setProperty("--star-duration", `${5 + index % 7}s`);
      star.style.setProperty("--star-delay", `${-(index * 1.37).toFixed(2)}s`);
      star.style.setProperty("--glint-size", `${12 + index % 3 * 4}px`);
      starField.append(star);
    }

    if (!reduced.matches) {
      const positions = [[84, 4], [30, 26], [99, 49], [56, -8], [75, 72]];
      positions.slice(0, compact.matches ? 3 : 5).forEach(([x, y], index) => {
        const meteor = document.createElement("i");
        meteor.className = "ambient-meteor";
        meteor.style.setProperty("--meteor-x", `${x}%`);
        meteor.style.setProperty("--meteor-y", `${y}%`);
        meteor.style.setProperty("--meteor-length", `${compact.matches ? 80 : 120 + index * 14}px`);
        meteor.style.setProperty("--meteor-duration", `${16 + index * 3.7}s`);
        meteor.style.setProperty("--meteor-delay", `${-3 - index * 5.3}s`);
        meteorField.append(meteor);
      });
    }

    stars.replaceChildren(starField);
    meteors.replaceChildren(meteorField);
  }

  function syncMotion() {
    root.toggleAttribute("data-ambient-active", pageActive && !document.hidden && !reduced.matches);
  }

  function refresh() {
    populateSky();
    syncMotion();
  }

  compact.addEventListener("change", refresh);
  reduced.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", syncMotion);
  window.addEventListener("pagehide", () => { pageActive = false; syncMotion(); });
  window.addEventListener("pageshow", () => { pageActive = true; syncMotion(); });
  refresh();
})();
