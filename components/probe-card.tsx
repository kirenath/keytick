'use client'

import { useState } from 'react'
import { BoxesIcon, ServerIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ModelPicker } from '@/components/model-picker'
import {
  type CheckResult,
  type Endpoint,
  type EndpointType,
  type ProbeKind,
} from '@/lib/types'

interface ProbeCardProps {
  endpoint: Endpoint
  apiKey: string
  /** 协议端点检测可选择的模型列表（来自「拉取模型」） */
  models: string[]
  onTested: () => void
  /** 来自端点配置的默认协议类型；chat 不在探测列表中，但其他三个会被标记为「默认」 */
  defaultType: EndpointType
}

interface ProbeMeta {
  title: string
  protocol: string
  path: string
  /** 选了模型的提示，未传时则用此提示 */
  hint: string
  hintWithModel: string
}

const PROBE_META: Record<ProbeKind, ProbeMeta> = {
  response: {
    title: 'Responses API',
    protocol: 'OpenAI',
    path: '/v1/responses',
    hint: 'POST 探测，使用 Authorization: Bearer',
    hintWithModel: 'POST 探测，使用所选模型发起最小调用',
  },
  messages: {
    title: 'Messages API',
    protocol: 'Anthropic',
    path: '/v1/messages',
    hint: 'POST 探测，使用 x-api-key + anthropic-version',
    hintWithModel: 'POST 探测，使用所选模型发起最小调用',
  },
  v1beta: {
    title: 'v1beta Models',
    protocol: 'Gemini',
    path: '/v1beta/models',
    hint: 'GET 探测，使用 x-goog-api-key',
    hintWithModel: 'GET 探测 /v1beta/models/{model} 验证该模型存在',
  },
}

const BASE_PROBE_ORDER: ProbeKind[] = ['response', 'messages', 'v1beta']

function orderedProbes(defaultType: EndpointType): ProbeKind[] {
  // chat 不在探测列表中；若选了某个 alt 协议，则把它提到最前面
  const alt = defaultType === 'chat' ? null : (defaultType as ProbeKind)
  if (!alt) return BASE_PROBE_ORDER
  const rest = BASE_PROBE_ORDER.filter((k) => k !== alt)
  return [alt, ...rest]
}

export function ProbeCard({ endpoint, apiKey, models, onTested, defaultType }: ProbeCardProps) {
  const [loadingKind, setLoadingKind] = useState<ProbeKind | null>(null)
  const [results, setResults] = useState<
    Partial<Record<ProbeKind, CheckResult>>
  >({})
  // 所有探测共用的模型选择；空表示按协议默认路径探测
  const [probeModel, setProbeModel] = useState('')
  const probeOrder = orderedProbes(defaultType)
  const defaultProbe = defaultType === 'chat' ? null : (defaultType as ProbeKind)
  const activeModel = probeModel.trim()

  async function probe(kind: ProbeKind) {
    setLoadingKind(kind)
    try {
      const res = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: endpoint.baseUrl,
          apiKey,
          endpointId: endpoint.id,
          model: activeModel || undefined,
          kind,
        }),
      })
      const data: CheckResult = await res.json().catch(() => null)
      if (!data) {
        toast.error('返回体解析失败')
        return
      }
      setResults((prev) => ({ ...prev, [kind]: data }))
      if (data.ok) {
        toast.success(
          `${PROBE_META[kind].protocol} ${PROBE_META[kind].title} 可用（${data.latencyMs} ms）`,
        )
      } else {
        toast.error(
          data.message ??
            `${PROBE_META[kind].protocol} ${PROBE_META[kind].title} 不可用`,
        )
      }
      onTested()
    } catch {
      toast.error('请求失败：网络错误')
    } finally {
      setLoadingKind(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ServerIcon className="size-4" />
          协议端点检测
        </CardTitle>
        <CardDescription>
          探测当前端点是否同时响应 OpenAI Responses、Anthropic Messages、Google
          Gemini v1beta 三种协议。每个协议会按其原生请求方式（不同的 path、Header
          和 body）发起一次最小探测。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field className="max-w-md">
          <FieldLabel htmlFor="probe-model">探测使用的模型（可选）</FieldLabel>
          <div className="flex items-center gap-2">
            <ModelPicker
              id="probe-model"
              className="flex-1"
              value={probeModel}
              onChange={setProbeModel}
              models={models}
              disabled={loadingKind !== null}
              placeholder={
                models.length
                  ? '点击选择，或输入名称筛选'
                  : '可直接输入模型名，或拉取模型后再选'
              }
            />
            {activeModel && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="清除模型选择"
                onClick={() => setProbeModel('')}
                disabled={loadingKind !== null}
              >
                <XIcon data-icon="inline-start" />
                清除
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {activeModel
              ? '将使用该模型发起探测。response/messages 会以该模型发起一次最小调用；v1beta 会查询该模型信息。'
              : '未选模型时使用占位模型探测（v1beta 会拉取模型列表）。'}
          </p>
        </Field>

        <div className="grid gap-2 sm:grid-cols-3">
          {probeOrder.map((kind) => {
            const meta = PROBE_META[kind]
            const r = results[kind]
            const loading = loadingKind === kind
            const disabled = loadingKind !== null
            const isDefault = defaultProbe === kind
            return (
              <button
                key={kind}
                type="button"
                onClick={() => probe(kind)}
                disabled={disabled}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-md border bg-card p-3 text-left transition-colors',
                  'hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60',
                  isDefault && 'border-primary/40 ring-1 ring-primary/20',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {meta.protocol} {meta.title}
                  </span>
                  {loading ? (
                    <Spinner className="size-3.5" />
                  ) : r ? (
                    <Badge
                      variant={r.ok ? 'secondary' : 'destructive'}
                      className={cn(r.ok && 'bg-success/10 text-success')}
                    >
                      {r.ok ? '通过' : '未通过'}
                    </Badge>
                  ) : (
                    <BoxesIcon className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {meta.path}
                  </span>
                  {isDefault && (
                    <Badge variant="outline" className="text-[10px]">
                      默认
                    </Badge>
                  )}
                </div>
                {r && !loading && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.status !== undefined ? `HTTP ${r.status}` : '—'}
                    {r.latencyMs !== undefined ? ` · ${r.latencyMs} ms` : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {probeOrder.map((kind) => {
          const r = results[kind]
          if (!r) return null
          const meta = PROBE_META[kind]
          const isDefault = defaultProbe === kind
          const metaHint = activeModel ? meta.hintWithModel : meta.hint
          return (
            <div
              key={`detail-${kind}`}
              className="rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  {meta.protocol} {meta.title}
                  {isDefault && (
                    <Badge variant="outline" className="text-[10px]">
                      默认
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {metaHint}
                  {activeModel && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      model: {activeModel}
                    </span>
                  )}
                </span>
              </div>
              {r.message && (
                <p
                  className={cn(
                    'text-xs',
                    r.ok ? 'text-success' : 'text-destructive',
                  )}
                >
                  {r.message}
                </p>
              )}
              {r.models && r.models.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  示例模型：
                  {r.models.slice(0, 5).join(', ')}
                  {r.models.length > 5 ? ` …（共 ${r.models.length} 个）` : ''}
                </p>
              )}
            </div>
          )
        })}

        <p className="text-xs text-muted-foreground">
          {
            '部分上游在 model 不存在时仍会返回 400/404 等 4xx，可视为端点本身存在；具体含义请看返回信息。'
          }
        </p>
      </CardContent>
    </Card>
  )
}
