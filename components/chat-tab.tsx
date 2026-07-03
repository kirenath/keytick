'use client'

import { useEffect, useRef, useState } from 'react'
import { SendIcon, Trash2Icon, BotIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import type { Endpoint } from '@/lib/types'

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
}

export function ChatTab({ endpoint, apiKey, models }: ChatTabProps) {
  const [model, setModel] = useState('')
  const [manualModel, setManualModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const effectiveModel = manualModel.trim() || model

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

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
          temperature,
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
        <Field className="w-56">
          <FieldLabel>模型</FieldLabel>
          <Select value={model} onValueChange={(v) => setModel(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={models.length ? '选择模型' : '请先拉取模型'} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-56">
          <FieldLabel htmlFor="manual-model">或手动输入模型名</FieldLabel>
          <Input
            id="manual-model"
            placeholder="例如 gpt-4o-mini"
            className="font-mono"
            value={manualModel}
            onChange={(e) => setManualModel(e.target.value)}
          />
        </Field>
        <Field className="w-48">
          <FieldLabel htmlFor="temperature">
            {`temperature：${temperature.toFixed(1)}`}
          </FieldLabel>
          <Slider
            id="temperature"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onValueChange={(v) => setTemperature(v as number)}
          />
        </Field>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setMessages([])}
          disabled={messages.length === 0 || streaming}
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
          disabled={streaming}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="发送"
            variant="default"
            onClick={send}
            disabled={streaming || !input.trim()}
          >
            {streaming ? <Spinner /> : <SendIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
