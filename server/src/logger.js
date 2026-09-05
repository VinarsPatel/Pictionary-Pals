const pino = require("pino")

// Never log raw inbound WS messages at info+ — msg.token is a bearer
// credential for reconnection and must not end up in log output.
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
})

module.exports = logger
