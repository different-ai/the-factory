import "dotenv/config"
import cors from "cors"
import express from "express"
import { fromNodeHeaders, toNodeHandler } from "better-auth/node"
import { auth } from "./auth.js"
import { env } from "./env.js"
import { workersRouter } from "./http/workers.js"

const app = express()

if (env.corsOrigins.length > 0) {
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
    }),
  )
}

app.use(express.json())
app.all("/api/auth/*", toNodeHandler(auth))

app.get("/health", (_, res) => {
  res.json({ ok: true })
})

app.get("/v1/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  if (!session?.user?.id) {
    res.status(401).json({ error: "unauthorized" })
    return
  }
  res.json(session)
})

app.use("/v1/workers", workersRouter)

app.listen(env.port, () => {
  console.log(`den-control-plane listening on ${env.port}`)
})
