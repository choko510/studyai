// Simplified proxy setup - no Interstellar licensing
export function setupMasqr(app) {
  // No authentication required - direct access
  app.use(async (req, res, next) => {
    next()
  })
}
