export type TestKind = 'check' | 'models' | 'response' | 'messages' | 'v1beta'

/** 协议端点探测的类别（与主端点 check 分开） */
export type ProbeKind = 'response' | 'messages' | 'v1beta'

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
  errorType?:
    | 'network'
    | 'auth'
    | 'rate_limit'
    | 'not_found'
    | 'method_not_allowed'
    | 'other'
  message?: string
  models?: string[]
  /** 仅在 /api/probe 返回时存在，标记探测的是哪种协议端点 */
  protocol?: ProbeKind
}
