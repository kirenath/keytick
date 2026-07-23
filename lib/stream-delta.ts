/**
 * 从 OpenAI 兼容 SSE chunk 中提取正文与 CoT/思考内容。
 * 各家字段名不统一，这里尽量兼容常见写法。
 */

export interface StreamDeltaParts {
  content: string
  reasoning: string
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.content === 'string') return obj.content
    if (typeof obj.reasoning === 'string') return obj.reasoning
    if (typeof obj.thinking === 'string') return obj.thinking
  }
  return ''
}

function fromContentParts(parts: unknown[]): StreamDeltaParts {
  let content = ''
  let reasoning = ''
  for (const part of parts) {
    if (typeof part === 'string') {
      content += part
      continue
    }
    if (!part || typeof part !== 'object') continue
    const p = part as Record<string, unknown>
    const type = typeof p.type === 'string' ? p.type : ''

    if (
      type === 'thinking' ||
      type === 'reasoning' ||
      type === 'reasoning_content' ||
      type === 'thought'
    ) {
      reasoning +=
        asText(p.thinking) ||
        asText(p.reasoning) ||
        asText(p.text) ||
        asText(p.content)
      continue
    }

    if (type === 'text' || type === 'output_text' || !type) {
      content += asText(p.text) || asText(p.content) || asText(p)
    }
  }
  return { content, reasoning }
}

/**
 * @param json 已 JSON.parse 的 SSE data 负载
 */
export function extractStreamDelta(json: unknown): StreamDeltaParts {
  if (!json || typeof json !== 'object') {
    return { content: '', reasoning: '' }
  }

  const root = json as Record<string, unknown>
  const choices = Array.isArray(root.choices) ? root.choices : []
  const choice =
    choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as Record<string, unknown>)
      : null

  // 流式用 delta；个别实现会在 message 上塞完整增量
  const deltaRaw = choice?.delta ?? choice?.message ?? root.delta ?? null
  const delta =
    deltaRaw && typeof deltaRaw === 'object'
      ? (deltaRaw as Record<string, unknown>)
      : ({} as Record<string, unknown>)

  let content = ''
  let reasoning = ''

  const c = delta.content
  if (typeof c === 'string') {
    content += c
  } else if (Array.isArray(c)) {
    const parts = fromContentParts(c)
    content += parts.content
    reasoning += parts.reasoning
  }

  // DeepSeek / 通义 / 硅基流动 / 多数 OpenAI 兼容：reasoning_content
  // OpenRouter / 部分网关：reasoning
  // 其他：thinking / reasoning_text / thought
  const reasoningFields = [
    delta.reasoning_content,
    delta.reasoning,
    delta.thinking,
    delta.reasoning_text,
    delta.thought,
    delta.thinking_content,
    // 有时挂在 choice.message 或顶层
    choice && (choice as Record<string, unknown>).reasoning_content,
    root.reasoning_content,
  ]
  for (const field of reasoningFields) {
    reasoning += asText(field)
  }

  // OpenRouter reasoning_details：[{ type, text/content }, ...]
  const details = delta.reasoning_details
  if (Array.isArray(details)) {
    for (const item of details) {
      reasoning += asText(item)
    }
  }

  return { content, reasoning }
}
