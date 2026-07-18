import { NextResponse } from 'next/server'
import { recordTest } from '@/lib/endpoint-store'
import { normalizeBaseUrl } from '@/lib/normalize'
import type { CheckResult, ProbeKind } from '@/lib/types'

const TIMEOUT_MS = 60_000

interface ProbeConfig {
  /** 相对路径，例如 /v1/responses */
  path: string
  method: 'GET' | 'POST'
  /** 构造请求头，apiKey 可能为空字符串 */
  headers: (apiKey: string) => Record<string, string>
  /** 构造 POST body，刻意用一个不存在的 model 来探测路径与鉴权 */
  body?: () => unknown
  /** 解析返回体中的模型列表（仅 Gemini 形态） */
  parseModels?: (data: unknown) => string[]
}

const PROBES: Record<ProbeKind, ProbeConfig> = {
  // OpenAI Responses API（/v1/responses，POST）
  response: {
    path: '/v1/responses',
    method: 'POST',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    }),
    body: () => ({
      model: '__keytick_probe__',
      input: 'ping',
    }),
  },
  // Anthropic Messages API（/v1/messages，POST，使用 x-api-key + anthropic-version）
  messages: {
    path: '/v1/messages',
    method: 'POST',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    }),
    body: () => ({
      model: '__keytick_probe__',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  },
  // Google Gemini-style API（/v1beta/models，GET，使用 x-goog-api-key）
  v1beta: {
    path: '/v1beta/models',
    method: 'GET',
    headers: (apiKey) => ({
      ...(apiKey ? { 'x-goog-api-key': apiKey } : {}),
    }),
    parseModels: (data) => {
      const list = (data as { models?: unknown })?.models
      if (!Array.isArray(list)) return []
      return list
        .map((m: { name?: unknown }) =>
          typeof m?.name === 'string' ? m.name.replace(/^models\//, '') : null,
        )
        .filter((id: string | null): id is string => id !== null)
    },
  },
}

export const PROBE_KINDS: ProbeKind[] = ['response', 'messages', 'v1beta']

function isValidKind(value: unknown): value is ProbeKind {
  return value === 'response' || value === 'messages' || value === 'v1beta'
}

/**
 * POST /api/probe
 * 入参: { baseUrl, apiKey?, endpointId?, kind }
 * 对 response / messages / v1beta 三种协议端点分别构造合适的请求进行探测。
 * apiKey 只在内存中使用，不写日志、不落盘。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const rawBaseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl : ''
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : ''
  const endpointId =
    typeof body?.endpointId === 'string' ? body.endpointId : undefined
  const rawKind = body?.kind
  const kind = isValidKind(rawKind) ? rawKind : null

  if (!rawBaseUrl) {
    return NextResponse.json({ error: '缺少 baseUrl' }, { status: 400 })
  }
  if (!kind) {
    return NextResponse.json({ error: '缺少或非法的 kind' }, { status: 400 })
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl)
  const config = PROBES[kind]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  let result: CheckResult

  try {
    const init: RequestInit = {
      method: config.method,
      headers: config.headers(apiKey),
      signal: controller.signal,
      cache: 'no-store',
    }
    if (config.method === 'POST' && config.body) {
      init.body = JSON.stringify(config.body())
    }

    const res = await fetch(`${baseUrl}${config.path}`, init)
    const latencyMs = Date.now() - start

    if (res.ok) {
      let models: string[] | undefined
      let message = '协议端点可用'
      if (config.parseModels) {
        try {
          const data = await res.json()
          const parsed = config.parseModels(data)
          if (parsed.length) {
            models = parsed
            message = `返回 ${parsed.length} 个模型`
          }
        } catch {
          // 非 JSON 也算可用
        }
      }
      result = { ok: true, status: res.status, latencyMs, message, models, protocol: kind }
    } else {
      let errorType: CheckResult['errorType'] = 'other'
      let message = `HTTP ${res.status}`
      if (res.status === 401 || res.status === 403) {
        errorType = 'auth'
        message = '端点存在但 API Key 无效或无权限'
      } else if (res.status === 404) {
        errorType = 'not_found'
        message = '404：路径不存在，或模型不存在（部分服务把不认识的 model 也返回为 404）'
      } else if (res.status === 405) {
        errorType = 'method_not_allowed'
        message = `端点存在但不接受 ${config.method} 方法`
      } else if (res.status === 429) {
        errorType = 'rate_limit'
        message = '429：请求被限流'
      } else if (res.status === 400) {
        errorType = 'other'
        message = '返回 400：通常是协议被识别但参数不合法（如 model 不存在），说明端点支持该协议'
      } else {
        const text = await res.text().catch(() => '')
        if (text) message = `HTTP ${res.status}：${text.slice(0, 200)}`
      }
      result = { ok: false, status: res.status, latencyMs, errorType, message, protocol: kind }
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    const aborted = err instanceof Error && err.name === 'AbortError'
    result = {
      ok: false,
      latencyMs,
      errorType: 'network',
      message: aborted
        ? `请求超时（${TIMEOUT_MS / 1000} 秒）`
        : '网络不通：无法连接到该端点',
      protocol: kind,
    }
  } finally {
    clearTimeout(timer)
  }

  if (endpointId) {
    await recordTest(endpointId, {
      kind,
      ok: result.ok,
      status: result.status,
      latencyMs: result.latencyMs,
      message: result.ok ? undefined : result.message,
    })
  }

  return NextResponse.json(result)
}
