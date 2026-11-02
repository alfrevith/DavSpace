/* Six directed passages, with a bounded cross-document handoff. Ordinary links
   remain the source of truth; portal artwork is a progressive enhancement. */
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.init(root, root.document);
})(globalThis, () => {
  function init(win, doc) {
    const api = win.CreativePassage;
    if (!api) return;
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const script = doc.querySelector('script[src$="creative-transitions.js"]');
    const base = new URL('../../', script.src);
    const enabled = () => !motion.matches && !doc.hidden && typeof doc.documentElement.animate === 'function';
    const animations = new Set(), doorAnimations = new Set(), seen = new WeakSet();
    let overlay = null, timer = 0, navigation = null;
    const ease = 'cubic-bezier(.22,.7,.22,1)';
    const play = (target, frames, options, owner = animations) => {
      if (!target?.animate || !enabled()) return null;
      const animation = target.animate(frames, { duration: 600, easing: ease, fill: 'backwards', ...options });
      owner.add(animation); animation.finished.then(() => owner.delete(animation), () => owner.delete(animation));
      return animation;
    };
    function clear() {
      const arrived = overlay?.dataset.phase === 'in';
      win.clearTimeout(timer); timer = 0; navigation = null;
      for (const animation of animations) animation.cancel(); animations.clear();
      overlay?.remove(); overlay = null;
      win.clearTimeout(win.__creativePassageFallback);
      doc.documentElement.removeAttribute('data-world-arriving');
      doc.documentElement.removeAttribute('data-passage-ready');
      if (arrived) win.dispatchEvent(new win.Event('creative:arrived'));
    }
    function cancelDoors() { for (const animation of doorAnimations) animation.cancel(); doorAnimations.clear(); }
    // A single compositor-friendly veil replaces the SVG masks and captions.
    function passage(plan, phase) {
      const root = doc.createElement('div'); root.className = 'world-passage';
      Object.assign(root.dataset, { passageRoute: plan.id, to: plan.to, phase });
      root.setAttribute('aria-hidden','true'); root.setAttribute('inert','');
      doc.body.append(root); overlay = root;
      const incoming = phase === 'in';
      root.style.opacity = incoming ? '0' : '1';
      play(root, incoming ? [{opacity:1},{opacity:0}] : [{opacity:0},{opacity:1}], {
        duration: incoming ? plan.arrivalDuration : plan.duration, easing: 'ease-out', fill: 'both'
      });
    }
    let incoming;
    try { incoming = api.pending(win.sessionStorage, win.location.pathname, Date.now()); win.sessionStorage.removeItem(api.key); } catch {}
    if (incoming && enabled()) {
      passage(api.route(incoming.from, incoming.to), 'in');
      doc.documentElement.setAttribute('data-passage-ready','');
      timer = win.setTimeout(clear, api.route(incoming.from, incoming.to).arrivalDuration + 20);
    } else clear();
    function navigate() {
      if (!navigation) return;
      const { url, plan } = navigation;
      try { win.sessionStorage.setItem(api.key, JSON.stringify({ from: plan.from, to: plan.to, path: url.pathname, at: Date.now() })); } catch {}
      navigation = null; win.location.assign(url.href);
    }
    doc.addEventListener('click', event => {
      const link = event.target.closest?.('[data-world-link]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download') || !enabled()) return;
      const plan = api.route(doc.body.dataset.world || 'portfolio', link.dataset.worldLink);
      if (!plan) return;
      const url = new URL(link.getAttribute('href'), win.location.href);
      if (url.origin !== base.origin || url.pathname !== new URL(plan.to + '.html', base).pathname) return;
      event.preventDefault(); clear(); passage(plan, 'out'); navigation = { url, plan };
      timer = win.setTimeout(navigate, plan.duration);
    });
    function revealDoor(door) {
      if (seen.has(door) || !enabled()) return; seen.add(door);
      const animate = (selector, keyframes, options) => play(door.querySelector(selector), keyframes, options, doorAnimations);
      if (door.classList.contains('entrance-photography')) {
        animate('[data-door-part=print]', [{ opacity:.6, transform:'rotate(-10deg) scale(.98)' }, { opacity:1, transform:'rotate(-7deg) scale(1)' }], { duration:850 });
        animate('[data-door-part=companion]', [{ opacity:.5,transform:'rotate(9deg) translateY(8px)' },{ opacity:1,transform:'rotate(5deg)' }],{ duration:800,delay:100 });
      } else if (door.classList.contains('entrance-drawings')) {
        animate('[data-door-part=paper]', [{ transform:'perspective(900px) rotateY(-13deg) rotate(-4deg)' },{ transform:'rotate(-3deg)' }],{ duration:1100 });
      } else {
        animate('[data-door-part=manuscript]', [{ transform:'rotate(-10deg) translateY(9px)' },{ transform:'rotate(-6deg)' }],{ duration:1000 });
        animate('[data-door-part=quill]', [{ transform:'rotate(21deg) translateY(-6px)' },{ transform:'rotate(11deg)',offset:.6 },{ transform:'rotate(14deg)' }],{ duration:1500,delay:250 });
        animate('.door-writing-words', [{ clipPath:'inset(0 100% 0 0)' },{ clipPath:'inset(0 -4% 0 0)' }],{ duration:1200,delay:200 });
      }
      door.querySelectorAll('[data-door-stroke]').forEach((path,i) => play(path,[{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDasharray:'1 1',strokeDashoffset:0}],{duration:1000,delay:200+i*70},doorAnimations));
    }
    if ('IntersectionObserver' in win) {
      const observer = new win.IntersectionObserver(entries => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-portal-visible',entry.isIntersecting);
          if (entry.isIntersecting) revealDoor(entry.target);
          else for (const animation of doorAnimations) if (entry.target.contains(animation.effect?.target)) { animation.cancel(); doorAnimations.delete(animation); }
        }
      }, { threshold:.18 });
      doc.querySelectorAll('.creative-entrance').forEach(door => observer.observe(door));
    }
    motion.addEventListener?.('change', () => { cancelDoors(); if (motion.matches) { if (navigation) navigate(); clear(); } });
    doc.addEventListener('visibilitychange', () => {
      doc.documentElement.toggleAttribute('data-portals-paused',doc.hidden);
      if (doc.hidden) { cancelDoors(); if (navigation) navigate(); clear(); }
    });
    win.addEventListener('pagehide', () => { clear(); cancelDoors(); });
    win.addEventListener('pageshow', event => { if (event.persisted) clear(); });
    win.CreativeTransitions = { get state() { return { route: overlay?.dataset.passageRoute || null, phase: overlay?.dataset.phase || null, doors: doorAnimations.size }; } };
  }
  return { init };
});
