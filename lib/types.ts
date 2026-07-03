export type TestKind = 'check' | 'models'

export interface TestRecord {
  id: string
  time: string // ISO
  kind: TestKind
  ok: boolean
  status?: number
  latencyMs?: number
  message?: string
}

export interface Endpoint {
  id: string
  name: string
  baseUrl: string
  note?: string
  lastStatus: 'ok' | 'fail' | null
  lastTestedAt?: string
  history: TestRecord[]
}

export interface CheckResult {
  ok: boolean
  status?: number
  latencyMs: number
  errorType?: 'network' | 'auth' | 'rate_limit' | 'other'
  message?: string
  models?: string[]
}
