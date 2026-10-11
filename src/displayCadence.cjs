function displayFrequency(screen, window) {
  try {
    if (!window || window.isDestroyed()) return 60;
    const frequency = screen.getDisplayMatching(window.getBounds()).displayFrequency;
    return Number.isFinite(frequency) && frequency >= 15 && frequency <= 1000 ? frequency : 60;
  } catch { return 60; }
}
module.exports = { displayFrequency };
