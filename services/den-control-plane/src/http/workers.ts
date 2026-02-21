import { randomBytes, randomUUID } from "crypto"
import express from "express"
import { fromNodeHeaders } from "better-auth/node"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { auth } from "../auth"
import { db } from "../db"
import { OrgMembershipTable, WorkerInstanceTable, WorkerTable, WorkerTokenTable } from "../db/schema"
import { ensureDefaultOrg } from "../orgs"
import { provisionWorker } from "../workers/provisioner"

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  destination: z.enum(["local", "cloud"]),
  workspacePath: z.string().optional(),
  sandboxBackend: z.string().optional(),
  imageVersion: z.string().optional(),
})

const token = () => randomBytes(32).toString("hex")

async function requireSession(req: express.Request, res: express.Response) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  if (!session?.user?.id) {
    res.status(401).json({ error: "unauthorized" })
    return null
  }
  return session
}

async function getOrgId(userId: string) {
  const membership = await db
    .select()
    .from(OrgMembershipTable)
    .where(eq(OrgMembershipTable.user_id, userId))
    .limit(1)
  if (membership.length === 0) {
    return null
  }
  return membership[0].org_id
}

export const workersRouter = express.Router()

workersRouter.post("/", async (req, res) => {
  const session = await requireSession(req, res)
  if (!session) return

  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() })
    return
  }

  if (parsed.data.destination === "local" && !parsed.data.workspacePath) {
    res.status(400).json({ error: "workspace_path_required" })
    return
  }

  const orgId = (await getOrgId(session.user.id)) ?? (await ensureDefaultOrg(session.user.id, session.user.name ?? session.user.email ?? "Personal"))
  const workerId = randomUUID()
  const status = parsed.data.destination === "cloud" ? "provisioning" : "healthy"

  await db.insert(WorkerTable).values({
    id: workerId,
    org_id: orgId,
    name: parsed.data.name,
    description: parsed.data.description,
    destination: parsed.data.destination,
    status,
    image_version: parsed.data.imageVersion,
    workspace_path: parsed.data.workspacePath,
    sandbox_backend: parsed.data.sandboxBackend,
  })

  const hostToken = token()
  const clientToken = token()
  await db.insert(WorkerTokenTable).values([
    {
      id: randomUUID(),
      worker_id: workerId,
      scope: "host",
      token: hostToken,
    },
    {
      id: randomUUID(),
      worker_id: workerId,
      scope: "client",
      token: clientToken,
    },
  ])

  let instance = null
  if (parsed.data.destination === "cloud") {
    const provisioned = await provisionWorker({
      workerId,
      name: parsed.data.name,
    })
    await db.insert(WorkerInstanceTable).values({
      id: randomUUID(),
      worker_id: workerId,
      provider: provisioned.provider,
      region: provisioned.region,
      url: provisioned.url,
      status: provisioned.status,
    })
    instance = provisioned
  }

  res.status(201).json({
    worker: {
      id: workerId,
      orgId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      destination: parsed.data.destination,
      status,
      imageVersion: parsed.data.imageVersion ?? null,
      workspacePath: parsed.data.workspacePath ?? null,
      sandboxBackend: parsed.data.sandboxBackend ?? null,
    },
    tokens: {
      host: hostToken,
      client: clientToken,
    },
    instance,
  })
})

workersRouter.get("/:id", async (req, res) => {
  const session = await requireSession(req, res)
  if (!session) return

  const orgId = await getOrgId(session.user.id)
  if (!orgId) {
    res.status(404).json({ error: "worker_not_found" })
    return
  }

  const rows = await db
    .select()
    .from(WorkerTable)
    .where(eq(WorkerTable.id, req.params.id))
    .limit(1)

  if (rows.length === 0 || rows[0].org_id !== orgId) {
    res.status(404).json({ error: "worker_not_found" })
    return
  }

  res.json({
    worker: {
      id: rows[0].id,
      orgId: rows[0].org_id,
      name: rows[0].name,
      description: rows[0].description,
      destination: rows[0].destination,
      status: rows[0].status,
      imageVersion: rows[0].image_version,
      workspacePath: rows[0].workspace_path,
      sandboxBackend: rows[0].sandbox_backend,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
    },
  })
})

workersRouter.post("/:id/tokens", async (req, res) => {
  const session = await requireSession(req, res)
  if (!session) return

  const orgId = await getOrgId(session.user.id)
  if (!orgId) {
    res.status(404).json({ error: "worker_not_found" })
    return
  }

  const rows = await db
    .select()
    .from(WorkerTable)
    .where(eq(WorkerTable.id, req.params.id))
    .limit(1)

  if (rows.length === 0 || rows[0].org_id !== orgId) {
    res.status(404).json({ error: "worker_not_found" })
    return
  }

  const hostToken = token()
  const clientToken = token()
  await db.insert(WorkerTokenTable).values([
    {
      id: randomUUID(),
      worker_id: rows[0].id,
      scope: "host",
      token: hostToken,
    },
    {
      id: randomUUID(),
      worker_id: rows[0].id,
      scope: "client",
      token: clientToken,
    },
  ])

  res.json({
    tokens: {
      host: hostToken,
      client: clientToken,
    },
  })
})
