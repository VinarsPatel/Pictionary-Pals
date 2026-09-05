// Levenshtein edit distance between two strings.
function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const currRow = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      )
    }
    prevRow = currRow
  }
  return prevRow[n]
}

// Near-miss detection for guesses that are wrong but close, e.g. a typo or a
// missing/extra letter. Threshold scales with word length so short words
// still require an exact-adjacent guess (off by 1) while longer/multi-word
// answers tolerate proportionally more edits.
function isCloseGuess(guess, answer) {
  if (!guess || !answer || guess === answer) return false
  const distance = levenshtein(guess, answer)
  const threshold = answer.length <= 4 ? 1 : Math.floor(answer.length * 0.25)
  return distance > 0 && distance <= threshold
}

module.exports = { levenshtein, isCloseGuess }
