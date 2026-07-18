import 'server-only'
import { promises as fs } from 'fs'
import path from 'path'
import type { Endpoint, EndpointGroup, EndpointType, TestRecord } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'endpoints.json')
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json')
const MAX_HISTORY = 20

// 串行化写入，避免并发写坏文件
let writeQueue: Promise<unknown> = Promise.resolve()

async function readAll(): Promise<Endpoint[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeAll(endpoints: Endpoint[]): Promise<void> {
  const task = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify(endpoints, null, 2), 'utf-8')
  })
  writeQueue = task.catch(() => {})
  await task
}

export async function listEndpoints(): Promise<Endpoint[]> {
  return readAll()
}

export async function createEndpoint(data: {
  name: string
  baseUrl: string
  endpointType?: EndpointType
  groupId?: string | null
  note?: string
}): Promise<Endpoint> {
  const endpoints = await readAll()
  const endpoint: Endpoint = {
    id: crypto.randomUUID(),
    name: data.name,
    baseUrl: data.baseUrl,
    endpointType: data.endpointType,
    groupId: data.groupId ?? null,
    note: data.note,
    lastStatus: null,
    history: [],
  }
  endpoints.push(endpoint)
  await writeAll(endpoints)
  return endpoint
}

export async function updateEndpoint(
  id: string,
  data: Partial<Pick<Endpoint, 'name' | 'baseUrl' | 'endpointType' | 'note' | 'groupId'>>,
): Promise<Endpoint | null> {
  const endpoints = await readAll()
  const idx = endpoints.findIndex((e) => e.id === id)
  if (idx === -1) return null
  endpoints[idx] = { ...endpoints[idx], ...data }
  await writeAll(endpoints)
  return endpoints[idx]
}

export async function deleteEndpoint(id: string): Promise<boolean> {
  const endpoints = await readAll()
  const next = endpoints.filter((e) => e.id !== id)
  if (next.length === endpoints.length) return false
  await writeAll(next)
  return true
}

// ---- 分组 ----

async function readAllGroups(): Promise<EndpointGroup[]> {
  try {
    const raw = await fs.readFile(GROUPS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeAllGroups(groups: EndpointGroup[]): Promise<void> {
  const task = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(GROUPS_FILE, JSON.stringify(groups, null, 2), 'utf-8')
  })
  writeQueue = task.catch(() => {})
  await task
}

export async function listGroups(): Promise<EndpointGroup[]> {
  return readAllGroups()
}

export async function createGroup(data: {
  name: string
  note?: string
}): Promise<EndpointGroup> {
  const groups = await readAllGroups()
  const group: EndpointGroup = {
    id: crypto.randomUUID(),
    name: data.name,
    note: data.note,
    createdAt: new Date().toISOString(),
  }
  groups.push(group)
  await writeAllGroups(groups)
  return group
}

export async function updateGroup(
  id: string,
  data: Partial<Pick<EndpointGroup, 'name' | 'note'>>,
): Promise<EndpointGroup | null> {
  const groups = await readAllGroups()
  const idx = groups.findIndex((g) => g.id === id)
  if (idx === -1) return null
  groups[idx] = { ...groups[idx], ...data }
  await writeAllGroups(groups)
  return groups[idx]
}

export async function deleteGroup(id: string): Promise<boolean> {
  const groups = await readAllGroups()
  const next = groups.filter((g) => g.id !== id)
  if (next.length === groups.length) return false
  await writeAllGroups(next)
  // 同步把该分组下的端点改为未分组（清空 groupId）
  const endpoints = await readAll()
  let changed = false
  for (const ep of endpoints) {
    if (ep.groupId === id) {
      ep.groupId = null
      changed = true
    }
  }
  if (changed) await writeAll(endpoints)
  return true
}

export async function recordTest(
  id: string,
  record: Omit<TestRecord, 'id' | 'time'>,
): Promise<Endpoint | null> {
  const endpoints = await readAll()
  const idx = endpoints.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const full: TestRecord = {
    ...record,
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
  }
  const ep = endpoints[idx]
  ep.history = [full, ...(ep.history ?? [])].slice(0, MAX_HISTORY)
  ep.lastStatus = record.ok ? 'ok' : 'fail'
  ep.lastTestedAt = full.time
  await writeAll(endpoints)
  return ep
}
