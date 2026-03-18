export type WorkbenchSnapshot = {
  id: string
  createdAt: string
  label: string
  provider: string
  model: string
  baseUrl?: string
  prompt: string
  workspaceContext: string
  gate?: string
  readinessScore?: number
  outputPreview?: string
}

const MAX_SNAPSHOTS = 8

export function buildSnapshotLabel(input: {
  prompt: string
  provider: string
  model: string
  gate?: string
}) {
  const promptTitle = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 42) || 'Untitled run'
  return `${input.provider}/${input.model} - ${input.gate || 'draft'} - ${promptTitle}`
}

export function createSnapshot(input: Omit<WorkbenchSnapshot, 'id' | 'createdAt' | 'label'> & { gate?: string }) {
  const id = `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date().toISOString()

  return {
    id,
    createdAt,
    label: buildSnapshotLabel({
      prompt: input.prompt,
      provider: input.provider,
      model: input.model,
      gate: input.gate,
    }),
    ...input,
  } satisfies WorkbenchSnapshot
}

export function mergeSnapshots(existing: WorkbenchSnapshot[], next: WorkbenchSnapshot) {
  return [next, ...existing].slice(0, MAX_SNAPSHOTS)
}

export function serializeSnapshots(items: WorkbenchSnapshot[]) {
  return JSON.stringify(items)
}

export function deserializeSnapshots(value: string | null | undefined) {
  if (!value) {
    return [] as WorkbenchSnapshot[]
  }

  try {
    const parsed = JSON.parse(value) as WorkbenchSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
