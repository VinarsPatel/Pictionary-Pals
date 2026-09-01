// Per-connection token bucket. A human drawing/guessing never comes close
// to this; it exists to blunt a client sending frames in a tight loop.
class TokenBucket {
  constructor({ capacity = 40, refillPerSecond = 20 } = {}) {
    this.capacity = capacity
    this.refillPerSecond = refillPerSecond
    this.tokens = capacity
    this.lastRefill = Date.now()
  }

  tryConsume() {
    const now = Date.now()
    const elapsedSeconds = (now - this.lastRefill) / 1000
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSeconds * this.refillPerSecond
    )
    this.lastRefill = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}

module.exports = { TokenBucket }
