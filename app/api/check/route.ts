import { NextResponse } from 'next/server'
import { recordTest } from '@/lib/endpoint-store'
import { normalizeBaseUrl } from '@/lib/normalize'
import type { CheckResult } from '@/lib/types'

const TIMEOUT_MS = 60_000

/**
 * POST /api/check
 * 入参: { baseUrl, apiKey, endpointId?, kind? }
 * 服务端转发到 {baseUrl}/v1/models，返回状态码、延迟、模型列表。
 * apiKey 只在内存中使用，不写日志、不落盘。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const rawBaseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl : ''
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : ''
  const endpointId =
    typeof body?.endpointId === 'string' ? body.endpointId : undefined
  const kind = body?.kind === 'models' ? 'models' : 'check'

  if (!rawBaseUrl) {
    return NextResponse.json({ error: '缺少 baseUrl' }, { status: 400 })
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  let result: CheckResult

  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    const latencyMs = Date.now() - start

    if (res.ok) {
      let models: string[] = []
      try {
        const data = await res.json()
        if (Array.isArray(data?.data)) {
          models = data.data
            .map((m: { id?: unknown }) =>
              typeof m?.id === 'string' ? m.id : null,
            )
            .filter((id: string | null): id is string => id !== null)
        }
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
