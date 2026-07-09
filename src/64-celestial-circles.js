// === CELESTIAL CIRCLES — disabled; globe-deck CLI is the UI ===
const Circles = {
  _circles: new Map(),
  init() {
    document.querySelectorAll('.celestial-circle').forEach((el) => el.remove());
  },
  spawn() { return null; },
  showView(title, html) {
    const text = (title ? title + ' — ' : '') + String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) {
      GlobeDeck?.expand?.();
      GlobeDeck?.log?.(text, 'out');
      GlobeDeck?.setPreview?.(text.slice(0, 120));
    }
    return null;
  },
  destroy() {},
  get() { return null; },
  addComplaintButton() {},
};

window.Circles = Circles;