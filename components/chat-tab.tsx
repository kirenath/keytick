'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ListIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
  BotIcon,
  ZapIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ModelPicker } from '@/components/model-picker'
import { MarkdownContent } from '@/components/markdown-content'
import { ReasoningBlock } from '@/components/reasoning-block'
import { CHAT_PRESETS } from '@/lib/chat-presets'
import { extractStreamDelta } from '@/lib/stream-delta'
import type { CheckResult, Endpoint } from '@/lib/types'
import { getEndpointType } from '@/lib/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** 思维链 / CoT（reasoning_content 等字段） */
  reasoning?: string
  /** 助手消息的耗时统计 */
  firstTokenMs?: number
  totalMs?: number
}

interface ChatTabProps {
  endpoint: Endpoint
  apiKey: string
  models: string[]
  onModelsChange: (models: string[]) => void
  onTested?: () => void
}

export function ChatTab({
  endpoint,
  apiKey,
  models,
  onModelsChange,
  onTested,
}: ChatTabProps) {
  const [model, setModel] = useState('')
  /** 未启用时请求不带 temperature，交给上游默认；启用后初始值为 1 */
  const [temperatureEnabled, setTemperatureEnabled] = useState(false)
  const [temperature, setTemperature] = useState(1)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pulling, setPulling] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const effectiveModel = model.trim()
  const busy = streaming || pulling

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  async function pullModels() {
    if (pulling || streaming) return
    setPulling(true)
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: endpoint.baseUrl,
          apiKey,
          endpointId: endpoint.id,
          endpointType: getEndpointType(endpoint),
          kind: 'models',
        }),
      })
      const data: CheckResult = await res.json()
      if (data.ok) {
        onModelsChange(data.models ?? [])
        toast.success(`已拉取 ${data.models?.length ?? 0} 个模型`)
      } else {
        toast.error(data.message ?? '拉取模型失败')
      }
      onTested?.()
    } catch {
      toast.error('请求失败：网络错误')
    } finally {
      setPulling(false)
    }
  }

  /** 用当前模型对既定消息历史发起流式回复 */
  async function streamReply(history: ChatMessage[]) {
    if (streaming) return
    if (!effectiveModel) {
      toast.error('请先选择或输入模型名')
      return
    }
    if (history.length === 0 || history[history.length - 1]?.role !== 'user') {
      return
    }

    setMessages([
      ...history,
      { role: 'assistant', content: '', reasoning: '' },
    ])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    const start = performance.now()
    let firstTokenMs: number | undefined

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: endpoint.baseUrl,
          apiKey,
          model: effectiveModel,
          ...(temperatureEnabled ? { temperature } : {}),
          // 多轮只带 content，不把 CoT 回传上游
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `请求失败（HTTP ${res.status}）`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let content = ''
      let reasoning = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload)
            const parts = extractStreamDelta(json)
            if (!parts.content && !parts.reasoning) continue

            if (firstTokenMs === undefined) {
              firstTokenMs = Math.round(performance.now() - start)
            }
            if (parts.content) content += parts.content
            if (parts.reasoning) reasoning += parts.reasoning

            setMessages((prev) => {
              const copy = [...prev]
              copy[copy.length - 1] = {
                role: 'assistant',
                content,
                reasoning,
                firstTokenMs,
              }
              return copy
            })
          } catch {
            // 忽略无法解析的行
          }
        }
      }

      const totalMs = Math.round(performance.now() - start)
      setMessages((prev) => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        copy[copy.length - 1] = {
          ...last,
          content,
          reasoning,
          firstTokenMs,
          totalMs,
        }
        return copy
      })
    } catch (err) {
      const message =
        err instanceof Error && err.name !== 'AbortError'
          ? err.message
          : null
      if (message) {
        toast.error(message)
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant' && !last.content && !last.reasoning) {
            copy[copy.length - 1] = {
              ...last,
              content: `[错误] ${message}`,
            }
          }
          return copy
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  async function send(rawText?: string) {
    const text = (rawText ?? input).trim()
    if (!text || streaming) return
    if (!effectiveModel) {
      toast.error('请先选择或输入模型名')
      return
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ]
    setInput('')
    await streamReply(nextMessages)
  }

  /** 丢掉最后一条助手回复，用当前模型重发最后一条用户消息 */
  async function resendLast() {
    if (streaming) return

    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx === -1) {
      toast.error('没有可重发的消息')
      return
    }

    const history = messages.slice(0, lastUserIdx + 1)
    await streamReply(history)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      void send()
    }
  }

  function sendPreset(content: string) {
    void send(content)
  }

  const canResend =
    !busy && messages.some((m) => m.role === 'user') && Boolean(effectiveModel)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* 顶部：模型与参数 */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-3">
        <Field className="min-w-56 flex-1">
          <FieldLabel htmlFor="chat-model">模型</FieldLabel>
          <div className="flex items-center gap-2">
            <ModelPicker
              id="chat-model"
              className="min-w-0 flex-1"
              value={model}
              onChange={setModel}
              models={models}
              disabled={busy}
              placeholder={
                models.length
                  ? '可点击下拉选择，或输入名称筛选'
                  : '点击右侧拉取模型，或直接输入模型名'
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={pullModels}
              disabled={busy}
              title="从当前端点拉取模型列表"
            >
              {pulling ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ListIcon data-icon="inline-start" />
              )}
              拉取模型
            </Button>
          </div>
        </Field>
        <Field className="w-52">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="temperature">
              {temperatureEnabled
                ? `temperature：${temperature.toFixed(1)}`
                : 'temperature：默认'}
            </FieldLabel>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              disabled={busy}
              onClick={() => {
                if (temperatureEnabled) {
                  setTemperatureEnabled(false)
                } else {
                  setTemperature(1)
                  setTemperatureEnabled(true)
                }
              }}
            >
              {temperatureEnabled ? '改回默认' : '自定义'}
            </Button>
          </div>
          <Slider
            id="temperature"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onValueChange={(v) => {
              setTemperature(v as number)
              if (!temperatureEnabled) setTemperatureEnabled(true)
            }}
            disabled={busy || !temperatureEnabled}
          />
        </Field>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void resendLast()}
            disabled={!canResend}
            title="用当前模型重发最后一条用户消息"
          >
            <RefreshCwIcon data-icon="inline-start" />
            重发
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessages([])}
            disabled={messages.length === 0 || busy}
          >
            <Trash2Icon data-icon="inline-start" />
            清空对话
          </Button>
        </div>
      </div>

      {/* 中间：消息区 */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card p-4"
      >
        {messages.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BotIcon />
              </EmptyMedia>
              <EmptyTitle>流式对话测试</EmptyTitle>
              <EmptyDescription>
                选择模型后发送消息，将显示首字延迟与总耗时。也可点下方快捷预设立刻发送。对话不会被保存。
              </EmptyDescription>
            </EmptyHeader>
            {CHAT_PRESETS.length > 0 && (
              <EmptyContent className="max-w-xl">
                <div className="flex flex-wrap justify-center gap-2">
                  {CHAT_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      title={preset.content}
                      onClick={() => sendPreset(preset.content)}
                    >
                      <ZapIcon data-icon="inline-start" />
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => {
              const isStreamingTail =
                streaming && i === messages.length - 1 && msg.role === 'assistant'
              const hasReasoning = Boolean(msg.reasoning)
              const hasContent = Boolean(msg.content)
              const emptyStreaming =
                isStreamingTail && !hasContent && !hasReasoning
              const stats =
                msg.role === 'assistant' &&
                (msg.firstTokenMs !== undefined || msg.totalMs !== undefined) ? (
                  <>
                    {msg.firstTokenMs !== undefined && (
                      <Badge
                        variant="secondary"
                        className="text-xs tabular-nums"
                      >
                        {`首字 ${msg.firstTokenMs} ms`}
                      </Badge>
                    )}
                    {msg.totalMs !== undefined && (
                      <Badge
                        variant="secondary"
                        className="text-xs tabular-nums"
                      >
                        {`总耗时 ${msg.totalMs} ms`}
                      </Badge>
                    )}
                  </>
                ) : null

              return (
                <div
                  key={i}
                  className={cn(
                    'flex max-w-[80%] flex-col gap-1.5',
                    msg.role === 'user' ? 'self-end' : 'self-start',
                  )}
                >
                  {emptyStreaming ? (
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <Spinner className="size-4" />
                    </div>
                  ) : (
                    <>
                      {msg.role === 'assistant' &&
                        (hasReasoning ||
                          (isStreamingTail && !hasContent)) && (
                          <ReasoningBlock
                            content={msg.reasoning ?? ''}
                            /* 整段流式期间保持展开，结束后组件内自动收起 */
                            streaming={isStreamingTail}
                          />
                        )}
                      {hasContent ? (
                        <MarkdownContent
                          content={msg.content}
                          variant={
                            msg.role === 'user' ? 'user' : 'assistant'
                          }
                          /* 流式输出中不提供切换，避免状态跳动 */
                          toggleable={!isStreamingTail}
                          footer={stats}
                        />
                      ) : (
                        // 只有 CoT 还没有正文时，把耗时挂在思考块下方
                        stats && (
                          <div className="flex flex-wrap gap-1.5">{stats}</div>
                        )
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 底部：快捷预设 + 输入区 */}
      {CHAT_PRESETS.length > 0 && messages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-muted-foreground">快捷：</span>
          {CHAT_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="xs"
              disabled={busy}
              title={preset.content}
              onClick={() => sendPreset(preset.content)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}
      <InputGroup>
        <InputGroupTextarea
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="发送"
            variant="default"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
          >
            {streaming ? <Spinner /> : <SendIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
