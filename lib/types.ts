export type TestKind = 'check' | 'models' | 'response' | 'messages' | 'v1beta'

/** 协议端点探测的类别（与主端点 check 分开） */
export type ProbeKind = 'response' | 'messages' | 'v1beta'

/** 端点默认协议类型（决定了协议端点检测的默认项） */
export type EndpointType = 'chat' | 'response' | 'messages' | 'v1beta'

export const ENDPOINT_TYPES: EndpointType[] = [
  'chat',
  'response',
  'messages',
  'v1beta',
]

export const ENDPOINT_TYPE_LABEL: Record<EndpointType, string> = {
  chat: 'OpenAI Chat',
  response: 'OpenAI Responses',
  messages: 'Anthropic Messages',
  v1beta: 'Gemini v1beta',
}

export const ENDPOINT_TYPE_SHORT: Record<EndpointType, string> = {
  chat: 'Chat',
  response: 'Responses',
  messages: 'Messages',
  v1beta: 'Gemini',
}

export function isValidEndpointType(v: unknown): v is EndpointType {
  return (
    typeof v === 'string' &&
    (ENDPOINT_TYPES as string[]).includes(v)
  )
}

/** 缺省视为 chat，避免老数据没有该字段时报错 */
export function getEndpointType(
  endpoint: { endpointType?: EndpointType } | null | undefined,
): EndpointType {
  return endpoint?.endpointType ?? 'chat'
}

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
  /** 默认协议类型；缺省为 chat */
  endpointType?: EndpointType
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
