import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"

const id = () => varchar("id", { length: 64 }).notNull()

const timestamps = {
  created_at: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
}

export const OrgRole = ["owner", "member"] as const
export const WorkerDestination = ["local", "cloud"] as const
export const WorkerStatus = ["provisioning", "healthy", "failed", "stopped"] as const
export const TokenScope = ["client", "host"] as const

export const AuthUserTable = mysqlTable(
  "user",
  {
    id: id().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: varchar("image", { length: 2048 }),
    createdAt: timestamp("createdAt", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  (table) => [uniqueIndex("user_email").on(table.email)],
)

export const AuthSessionTable = mysqlTable(
  "session",
  {
    id: id().primaryKey(),
    userId: varchar("userId", { length: 64 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expiresAt", { fsp: 3 }).notNull(),
    ipAddress: varchar("ipAddress", { length: 255 }),
    userAgent: varchar("userAgent", { length: 1024 }),
    createdAt: timestamp("createdAt", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("session_token").on(table.token),
    index("session_user_id").on(table.userId),
  ],
)

export const AuthAccountTable = mysqlTable(
  "account",
  {
    id: id().primaryKey(),
    userId: varchar("userId", { length: 64 }).notNull(),
    accountId: varchar("accountId", { length: 255 }).notNull(),
    providerId: varchar("providerId", { length: 255 }).notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { fsp: 3 }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { fsp: 3 }),
    scope: varchar("scope", { length: 1024 }),
    idToken: text("idToken"),
    password: varchar("password", { length: 512 }),
    createdAt: timestamp("createdAt", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index("account_user_id").on(table.userId),
    index("account_provider_id").on(table.providerId),
    index("account_account_id").on(table.accountId),
  ],
)

export const AuthVerificationTable = mysqlTable(
  "verification",
  {
    id: id().primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: varchar("value", { length: 1024 }).notNull(),
    expiresAt: timestamp("expiresAt", { fsp: 3 }).notNull(),
    createdAt: timestamp("createdAt", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("verification_identifier").on(table.identifier)],
)

export const OrgTable = mysqlTable(
  "org",
  {
    id: id().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    owner_user_id: varchar("owner_user_id", { length: 64 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("org_slug").on(table.slug), index("org_owner_user_id").on(table.owner_user_id)],
)

export const OrgMembershipTable = mysqlTable(
  "org_membership",
  {
    id: id().primaryKey(),
    org_id: varchar("org_id", { length: 64 }).notNull(),
    user_id: varchar("user_id", { length: 64 }).notNull(),
    role: mysqlEnum("role", OrgRole).notNull(),
    created_at: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [index("org_membership_org_id").on(table.org_id), index("org_membership_user_id").on(table.user_id)],
)

export const WorkerTable = mysqlTable(
  "worker",
  {
    id: id().primaryKey(),
    org_id: varchar("org_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 1024 }),
    destination: mysqlEnum("destination", WorkerDestination).notNull(),
    status: mysqlEnum("status", WorkerStatus).notNull(),
    image_version: varchar("image_version", { length: 128 }),
    workspace_path: varchar("workspace_path", { length: 1024 }),
    sandbox_backend: varchar("sandbox_backend", { length: 64 }),
    ...timestamps,
  },
  (table) => [index("worker_org_id").on(table.org_id), index("worker_status").on(table.status)],
)

export const WorkerInstanceTable = mysqlTable(
  "worker_instance",
  {
    id: id().primaryKey(),
    worker_id: varchar("worker_id", { length: 64 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    region: varchar("region", { length: 64 }),
    url: varchar("url", { length: 2048 }).notNull(),
    status: mysqlEnum("status", WorkerStatus).notNull(),
    ...timestamps,
  },
  (table) => [index("worker_instance_worker_id").on(table.worker_id)],
)

export const WorkerTokenTable = mysqlTable(
  "worker_token",
  {
    id: id().primaryKey(),
    worker_id: varchar("worker_id", { length: 64 }).notNull(),
    scope: mysqlEnum("scope", TokenScope).notNull(),
    token: varchar("token", { length: 128 }).notNull(),
    created_at: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    revoked_at: timestamp("revoked_at", { fsp: 3 }),
  },
  (table) => [
    index("worker_token_worker_id").on(table.worker_id),
    uniqueIndex("worker_token_token").on(table.token),
  ],
)

export const WorkerBundleTable = mysqlTable(
  "worker_bundle",
  {
    id: id().primaryKey(),
    worker_id: varchar("worker_id", { length: 64 }).notNull(),
    storage_url: varchar("storage_url", { length: 2048 }).notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    created_at: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [index("worker_bundle_worker_id").on(table.worker_id)],
)

export const AuditEventTable = mysqlTable(
  "audit_event",
  {
    id: id().primaryKey(),
    org_id: varchar("org_id", { length: 64 }).notNull(),
    worker_id: varchar("worker_id", { length: 64 }),
    actor_user_id: varchar("actor_user_id", { length: 64 }).notNull(),
    action: varchar("action", { length: 128 }).notNull(),
    payload: json("payload"),
    created_at: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [index("audit_event_org_id").on(table.org_id), index("audit_event_worker_id").on(table.worker_id)],
)
