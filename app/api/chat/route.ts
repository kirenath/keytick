import { NextResponse } from 'next/server'
import { normalizeBaseUrl } from '@/lib/normalize'

const TIMEOUT_MS = 60_000

/**
 * POST /api/chat
 * 入参: { baseUrl, apiKey, model, messages, temperature }
 * 服务端代理转发到 {baseUrl}/v1/chat/completions，以流式返回。
 * apiKey 只在内存中使用，不写日志、不落盘。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const rawBaseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl : ''
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : ''
  const model = typeof body?.model === 'string' ? body.model : ''
  const messages = Array.isArray(body?.messages) ? body.messages : null
  const temperature =
    typeof body?.temperature === 'number' ? body.temperature : undefined

  if (!rawBaseUrl || !model || !messages) {
    return NextResponse.json(
      { error: '缺少 baseUrl、model 或 messages' },
      { status: 400 },
    )
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        ...(temperature !== undefined ? { temperature } : {}),
        stream: true,
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (err) {
    clearTimeout(timer)
    const aborted = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      {
        error: aborted
          ? `请求超时（${TIMEOUT_MS / 1000} 秒）`
          : '网络不通：无法连接到该端点',
        errorType: 'network',
      },
      { status: 502 },
    )
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timer)
    let errorType = 'other'
    let message = `上游返回 HTTP ${upstream.status}`
    if (upstream.status === 401 || upstream.status === 403) {
      errorType = 'auth'
      message = '401/403：API Key 无效或无权限'
    } else if (upstream.status === 429) {
      errorType = 'rate_limit'
      message = '429：请求被限流'
    } else {
      const text = await upstream.text().catch(() => '')
      if (text) message = `HTTP ${upstream.status}：${text.slice(0, 300)}`
    }
    return NextResponse.json(
      { error: message, errorType },
      { status: upstream.status },
    )
  }

  // 直接透传上游的 SSE 流
  const stream = new ReadableStream({
    async start(streamController) {
      const reader = upstream.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          streamController.enqueue(value)
        }
      } catch {
        // 上游中断
      } finally {
        clearTimeout(timer)
        streamController.close()
      }
    },
    cancel() {
      clearTimeout(timer)
      controller.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
