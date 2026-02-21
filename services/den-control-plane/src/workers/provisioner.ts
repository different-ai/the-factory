import { env } from "../env"

export type ProvisionInput = {
  workerId: string
  name: string
}

export type ProvisionedInstance = {
  provider: string
  url: string
  status: "provisioning" | "healthy"
  region?: string
}

export async function provisionWorker(input: ProvisionInput): Promise<ProvisionedInstance> {
  if (env.provisionerMode === "render") {
    throw new Error("Render provisioner not implemented")
  }

  const template = env.workerUrlTemplate ?? "https://workers.local/{workerId}"
  const url = template.replace("{workerId}", input.workerId)
  return {
    provider: "stub",
    url,
    status: "provisioning",
  }
}
