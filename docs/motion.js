/** Motion belongs to the documentation site, not the SDK or API. */
export function createWordGarden(doc = document, win = window) {
  const garden = doc.getElementById('word-garden');
  if (!garden) return { updateMatches() {}, destroy() {} };
  const scene = doc.getElementById('garden-scene');
  const button = doc.getElementById('garden-motion');
  const icon = button.querySelector('.garden-motion-icon');
  const label = button.querySelector('.garden-motion-label');
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false, inView = true, destroyed = false, pointerFrame = 0, pendingPointer;
  let heroObserver, revealObserver;
  const cleanups = [];
  const listen = (target, name, handler, options) => { target.addEventListener(name, handler, options); cleanups.push(() => target.removeEventListener(name, handler, options)); };
  const available = () => !destroyed && !paused && !motion.matches && !doc.hidden;
  const revealTargets = [...doc.querySelectorAll('.section-title, .query-panel, .response-panel, .endpoint, .sdk-grid, .data-cards article, .closing')];
  const revealAll = () => revealTargets.forEach((target) => target.classList.add('is-revealed'));
  function resetPointer() {
    if (pointerFrame) win.cancelAnimationFrame(pointerFrame);
    pointerFrame = 0; pendingPointer = undefined;
    garden.style.setProperty('--look-x', '0deg');
    garden.style.setProperty('--look-y', '0deg');
    garden.style.setProperty('--light-x', '50%');
    garden.style.setProperty('--light-y', '45%');
  }
  function sync() {
    const allowed = available();
    garden.dataset.motion = allowed && inView ? 'running' : 'off';
    doc.documentElement.dataset.pageMotion = allowed ? 'running' : 'off';
    button.disabled = motion.matches;
    button.setAttribute('aria-pressed', String(paused || motion.matches));
    button.setAttribute('aria-label', motion.matches ? 'Word garden motion follows your reduced-motion preference' : paused ? 'Play the word garden motion' : 'Pause the word garden motion');
    icon.textContent = motion.matches || paused ? '▷' : 'Ⅱ';
    label.textContent = motion.matches ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
    if (!allowed || !inView) resetPointer();
    if (motion.matches || paused) revealAll();
  }
  listen(button, 'click', () => { paused = !paused; sync(); });
  listen(motion, 'change', sync);
  listen(doc, 'visibilitychange', sync);
  listen(win, 'pageshow', sync);
  listen(scene, 'pointermove', (event) => {
    if (!available() || !inView || event.pointerType === 'touch') return;
    pendingPointer = { x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = win.requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!pendingPointer || !available() || !inView) return;
      const box = scene.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = Math.max(0, Math.min(1, (pendingPointer.x - box.left) / box.width));
      const y = Math.max(0, Math.min(1, (pendingPointer.y - box.top) / box.height));
      garden.style.setProperty('--look-x', ((0.5 - y) * 7).toFixed(2) + 'deg');
      garden.style.setProperty('--look-y', ((x - 0.5) * 9).toFixed(2) + 'deg');
      garden.style.setProperty('--light-x', (x * 100).toFixed(1) + '%');
      garden.style.setProperty('--light-y', (y * 100).toFixed(1) + '%');
    });
  }, { passive: true });
  listen(scene, 'pointerleave', resetPointer);
  garden.querySelectorAll('button[data-garden-word]').forEach((card) => {
    listen(card, 'click', () => {
      const pin = card.getAttribute('aria-pressed') !== 'true';
      garden.querySelectorAll('button[data-garden-word]').forEach((item) => {
        const selected = item === card && pin;
        item.setAttribute('aria-pressed', String(selected));
        item.classList.toggle('is-pinned', selected);
      });
      garden.querySelectorAll('[data-garden-link]').forEach((link) => link.classList.toggle('is-pinned', pin && link.dataset.gardenLink === card.dataset.gardenWord));
    });
  });
  if (win.IntersectionObserver) {
    heroObserver = new win.IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.08 });
    heroObserver.observe(garden);
    revealTargets.forEach((target, index) => { target.dataset.reveal = ''; target.style.setProperty('--reveal-delay', (index % 3) * 55 + 'ms'); });
    revealObserver = new win.IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      revealObserver.unobserve(entry.target);
    }), { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
    revealTargets.forEach((target) => revealObserver.observe(target));
    doc.documentElement.classList.add('motion-enhanced');
  } else revealAll();
  sync();
  const api = {
    updateMatches(rows) {
      if (destroyed) return;
      const ids = new Set(rows.filter((row) => row && typeof row.id === 'string').map((row) => row.id));
      garden.querySelectorAll('[data-garden-word]').forEach((card) => card.classList.toggle('is-match', ids.has(card.dataset.gardenWord)));
      garden.querySelectorAll('[data-garden-link]').forEach((link) => link.classList.toggle('is-match', ids.has(link.dataset.gardenLink)));
      garden.classList.toggle('has-search-match', [...ids].some((id) => ['salam', 'su', 'gul', 'kitab', 'dost'].includes(id)));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resetPointer(); cleanups.forEach((remove) => remove());
      heroObserver?.disconnect(); revealObserver?.disconnect();
      garden.dataset.motion = 'off'; doc.documentElement.dataset.pageMotion = 'off';
      revealAll();
    },
  };
  listen(win, 'pagehide', (event) => { if (!event.persisted) api.destroy(); });
  return api;
}
