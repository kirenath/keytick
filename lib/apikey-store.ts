/**
 * API Key 列表的浏览器端持久化。
 *
 * 设计要点：
 * - 与服务端存储完全隔离，Key 只在本机 localStorage，按 scope 分开记录，永不入库。
 * - scope 由调用方决定：
 *   - 未分组端点用 `endpoint:<id>`（向后兼容旧数据）
 *   - 同一分组的多个端点共享一份 Key 池，scope 为 `group:<groupId>`
 * - 一个 scope 可保存多个带 label 的 Key，便于在「开发/生产/备份」等多 Key 场景切换。
 * - 同时记录一个「当前激活 Key 的 id」，供检测/对话/协议探测共用。
 * - 兼容旧版（单 Key 仅存 sessionStorage 的写法）：进入 scope 时自动迁移一次。
 */

export interface ApiKeyEntry {
  id: string
  /** 可选别名，例如「开发-张三」「生产-备份」，缺省时用值的前后片段展示 */
  label: string
  value: string
  createdAt: string
}

export interface ApiKeyStore {
  keys: ApiKeyEntry[]
  activeKeyId: string | null
}

const STORE_KEY = 'keytick:apikeys'
const LEGACY_KEY_PREFIX = 'apikey:' // 旧版 sessionStorage 单 Key 的前缀（仅 endpoint 维度）

/**
 * 计算 Key 池的存储 scope id。
 * - 有 groupId 的端点：同一组共享一份 Key 池
 * - 无 groupId 的端点：按端点独立保存
 */
export function getScopeId(input: { endpointId: string; groupId?: string | null }): string {
  const gid = input.groupId?.trim()
  return gid ? `group:${gid}` : `endpoint:${input.endpointId}`
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function emptyStore(): ApiKeyStore {
  return { keys: [], activeKeyId: null }
}

function readAllStores(): Record<string, ApiKeyStore> {
  if (!isBrowser()) return {}
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAllStores(map: Record<string, ApiKeyStore>) {
  if (!isBrowser()) return
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map))
  } catch {
    // 容量超限或被禁用时静默降级
  }
}

/**
 * 读取某 scope 的 Key 列表。
 * 同时尝试一次性迁移旧版 sessionStorage 中的单 Key（仅未分组端点维度有效）。
 */
export function loadStore(scopeId: string, legacyEndpointId?: string): ApiKeyStore {
  const map = readAllStores()
  const store = map[scopeId]
  if (store && Array.isArray(store.keys)) {
    return {
      keys: store.keys,
      activeKeyId: store.activeKeyId ?? null,
    }
  }
  // 旧版迁移：仅未分组端点走这个路径（分组端点以前没有 key 概念）
  const legacyId = legacyEndpointId ?? scopeId.replace(/^endpoint:/, '')
  if (isBrowser()) {
    try {
      const legacy =
        sessionStorage.getItem(LEGACY_KEY_PREFIX + legacyId) ?? ''
      if (legacy) {
        const entry: ApiKeyEntry = {
          id: crypto.randomUUID(),
          label: '默认',
          value: legacy,
          createdAt: new Date().toISOString(),
        }
        const migrated: ApiKeyStore = {
          keys: [entry],
          activeKeyId: entry.id,
        }
        saveStore(scopeId, migrated)
        // 迁移成功后清理旧 key
        sessionStorage.removeItem(LEGACY_KEY_PREFIX + legacyId)
        return migrated
      }
    } catch {
      // sessionStorage 不可用时静默降级
    }
  }
  return emptyStore()
}

export function saveStore(scopeId: string, store: ApiKeyStore) {
  const map = readAllStores()
  map[scopeId] = store
  writeAllStores(map)
}

/** 取激活 Key 的值（若无激活返回空字符串） */
export function getActiveValue(store: ApiKeyStore): string {
  if (!store.activeKeyId) return ''
  return store.keys.find((k) => k.id === store.activeKeyId)?.value ?? ''
}

/** 生成展示用的简短描述（避免明文展示完整 Key） */
export function describeKey(entry: ApiKeyEntry): string {
  const label = entry.label?.trim()
  if (label) return label
  const v = entry.value
  if (v.length <= 12) return v
  return `${v.slice(0, 6)}…${v.slice(-4)}`
}
