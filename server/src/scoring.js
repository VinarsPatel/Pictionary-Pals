// Both decay linearly to 0 as the guess approaches the turn's time limit.
// Math.max guards against negative scores if ever called past the caller's
// own elapsed-time cutoff.
function scoreForGuesser(elapsedMs) {
  return Math.max(0, Math.floor(100 - elapsedMs / 600))
}

function scoreForDrawer(elapsedMs) {
  return Math.max(0, Math.floor(50 - elapsedMs / 1200))
}

module.exports = { scoreForGuesser, scoreForDrawer }
