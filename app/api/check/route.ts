import { NextResponse } from 'next/server'
import { recordTest } from '@/lib/endpoint-store'
import { normalizeBaseUrl } from '@/lib/normalize'
import {
  isValidEndpointType,
  type CheckResult,
  type EndpointType,
} from '@/lib/types'

const TIMEOUT_MS = 60_000

interface ModelsEndpointConfig {
  /** 相对路径，例如 /v1/models 或 /v1beta/models */
  path: string
  /** 构造请求头，apiKey 可能为空字符串 */
  headers: (apiKey: string) => Record<string, string>
  /** 从响应体中提取模型 ID 列表 */
  parseModels: (data: unknown) => string[]
}

const OPENAI_SHAPE_PARSER = (data: unknown): string[] => {
  const list = (data as { data?: unknown })?.data
  if (!Array.isArray(list)) return []
  return list
    .map((m: { id?: unknown }) => (typeof m?.id === 'string' ? m.id : null))
    .filter((id: string | null): id is string => id !== null)
}

/**
 * 不同 endpointType 对应不同模型列表端点与鉴权方式。
 * - chat/response：OpenAI 风格 /v1/models + Authorization Bearer
 * - messages：Anthropic 风格 /v1/models + x-api-key + anthropic-version
 * - v1beta：Gemini 风格 /v1beta/models + x-goog-api-key，模型字段为 name（带 models/ 前缀）
 */
const MODELS_ENDPOINT: Record<EndpointType, ModelsEndpointConfig> = {
  chat: {
    path: '/v1/models',
    headers: (apiKey) => ({
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    }),
    parseModels: OPENAI_SHAPE_PARSER,
  },
  response: {
    path: '/v1/models',
    headers: (apiKey) => ({
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    }),
    parseModels: OPENAI_SHAPE_PARSER,
  },
  messages: {
    path: '/v1/models',
    headers: (apiKey) => ({
      'anthropic-version': '2023-06-01',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    }),
    parseModels: OPENAI_SHAPE_PARSER,
  },
  v1beta: {
    path: '/v1beta/models',
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

/**
 * POST /api/check
 * 入参: { baseUrl, apiKey, endpointId?, kind?, endpointType? }
 * 根据 endpointType 选择对应的模型列表端点（/v1/models 或 /v1beta/models）。
 * 返回状态码、延迟、模型列表。apiKey 只在内存中使用，不写日志、不落盘。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const rawBaseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl : ''
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : ''
  const endpointId =
    typeof body?.endpointId === 'string' ? body.endpointId : undefined
  const kind = body?.kind === 'models' ? 'models' : 'check'
  const endpointTypeRaw = body?.endpointType
  const endpointType: EndpointType = isValidEndpointType(endpointTypeRaw)
    ? endpointTypeRaw
    : 'chat'

  if (!rawBaseUrl) {
    return NextResponse.json({ error: '缺少 baseUrl' }, { status: 400 })
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl)
  const config = MODELS_ENDPOINT[endpointType]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  let result: CheckResult

  try {
    const res = await fetch(`${baseUrl}${config.path}`, {
      method: 'GET',
      headers: config.headers(apiKey),
      signal: controller.signal,
      cache: 'no-store',
    })
    const latencyMs = Date.now() - start

    if (res.ok) {
      let models: string[] = []
      try {
        const data = await res.json()
        models = config.parseModels(data)
      } catch {
        // 返回体不是 JSON 也算连通
      }
      result = { ok: true, status: res.status, latencyMs, models }
    } else {
      let errorType: CheckResult['errorType'] = 'other'
      let message = `HTTP ${res.status}`
      if (res.status === 401 || res.status === 403) {
        errorType = 'auth'
        message = '401/403：API Key 无效或无权限'
      } else if (res.status === 429) {
        errorType = 'rate_limit'
        message = '429：请求被限流'
      } else {
        const text = await res.text().catch(() => '')
        if (text) message = `HTTP ${res.status}：${text.slice(0, 200)}`
      }
      result = { ok: false, status: res.status, latencyMs, errorType, message }
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
    }
  } finally {
    clearTimeout(timer)
  }

  // 写回该端点的上次测试状态与历史（不含任何 Key）
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
