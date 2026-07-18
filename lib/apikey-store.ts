/**
 * API Key 列表的浏览器端持久化。
 *
 * 设计要点：
 * - 与服务端存储完全隔离，Key 只在本机 localStorage，按端点分开记录，永不入库。
 * - 一个端点可保存多个带 label 的 Key，便于在「开发/生产/备份」等多 Key 场景切换。
 * - 同时记录一个「当前激活 Key 的 id」，供检测/对话/协议探测共用。
 * - 兼容旧版（单 Key 仅存 sessionStorage 的写法）：进入端点时自动迁移一次。
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
const LEGACY_KEY_PREFIX = 'apikey:' // 旧版 sessionStorage 单 Key 的前缀

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
 * 读取端点的 Key 列表。
 * 同时尝试一次性迁移旧版 sessionStorage 中的单 Key。
 */
export function loadStore(endpointId: string): ApiKeyStore {
  const store = readAllStores()[endpointId]
  if (store && Array.isArray(store.keys)) {
    return {
      keys: store.keys,
      activeKeyId: store.activeKeyId ?? null,
    }
  }
  // 旧版迁移：从 sessionStorage 读取单 Key
  if (isBrowser()) {
    try {
      const legacy =
        sessionStorage.getItem(LEGACY_KEY_PREFIX + endpointId) ?? ''
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
        saveStore(endpointId, migrated)
        // 迁移成功后清理旧 key
        sessionStorage.removeItem(LEGACY_KEY_PREFIX + endpointId)
        return migrated
      }
    } catch {
      // sessionStorage 不可用时静默降级
    }
  }
  return emptyStore()
}

export function saveStore(endpointId: string, store: ApiKeyStore) {
  const map = readAllStores()
  map[endpointId] = store
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
