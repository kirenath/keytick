'use client'

import { useEffect, useRef, useState } from 'react'
import { ListIcon, SendIcon, Trash2Icon, BotIcon } from 'lucide-react'
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ModelPicker } from '@/components/model-picker'
import type { CheckResult, Endpoint } from '@/lib/types'
import { getEndpointType } from '@/lib/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    if (!effectiveModel) {
      toast.error('请先选择或输入模型名')
      return
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
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
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
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
            const delta: string = json?.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              if (firstTokenMs === undefined) {
                firstTokenMs = Math.round(performance.now() - start)
              }
              content += delta
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content,
                  firstTokenMs,
                }
                return copy
              })
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      }

      const totalMs = Math.round(performance.now() - start)
      setMessages((prev) => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        copy[copy.length - 1] = { ...last, firstTokenMs, totalMs }
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
          if (last?.role === 'assistant' && !last.content) {
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      send()
    }
  }

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
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setMessages([])}
          disabled={messages.length === 0 || busy}
        >
          <Trash2Icon data-icon="inline-start" />
          清空对话
        </Button>
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
                选择模型后发送消息，将显示首字延迟与总耗时。对话不会被保存。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col gap-1',
                  msg.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {msg.content ||
                    (streaming && i === messages.length - 1 ? (
                      <Spinner className="size-4" />
                    ) : (
                      ''
                    ))}
                </div>
                {msg.role === 'assistant' &&
                  (msg.firstTokenMs !== undefined || msg.totalMs !== undefined) && (
                    <div className="flex gap-1.5">
                      {msg.firstTokenMs !== undefined && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {`首字 ${msg.firstTokenMs} ms`}
                        </Badge>
                      )}
                      {msg.totalMs !== undefined && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {`总耗时 ${msg.totalMs} ms`}
                        </Badge>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部：输入区 */}
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
            onClick={send}
            disabled={busy || !input.trim()}
          >
            {streaming ? <Spinner /> : <SendIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
