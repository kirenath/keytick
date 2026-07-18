'use client'

import { useState } from 'react'
import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  PlugZapIcon,
  ListIcon,
  CopyIcon,
  CheckIcon,
  SearchIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { CheckResult, Endpoint } from '@/lib/types'
import { getEndpointType } from '@/lib/types'

interface CheckTabProps {
  endpoint: Endpoint
  apiKey: string
  onApiKeyChange: (key: string) => void
  models: string[]
  onModelsChange: (models: string[]) => void
  onTested: () => void
}

export function CheckTab({
  endpoint,
  apiKey,
  onApiKeyChange,
  models,
  onModelsChange,
  onTested,
}: CheckTabProps) {
  const [showKey, setShowKey] = useState(false)
  const [checking, setChecking] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [search, setSearch] = useState('')
  const [copiedModel, setCopiedModel] = useState<string | null>(null)

  async function runCheck(kind: 'check' | 'models') {
    const setBusy = kind === 'check' ? setChecking : setPulling
    setBusy(true)
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: endpoint.baseUrl,
          apiKey,
          endpointId: endpoint.id,
          endpointType: getEndpointType(endpoint),
          kind,
        }),
      })
      const data: CheckResult = await res.json()
      setResult(data)
      if (data.ok) {
        if (kind === 'models') {
          onModelsChange(data.models ?? [])
          toast.success(`已拉取 ${data.models?.length ?? 0} 个模型`)
        } else {
          toast.success(`连接成功（${data.latencyMs} ms）`)
        }
      } else {
        toast.error(data.message ?? '测试失败')
      }
      onTested()
    } catch {
      toast.error('请求失败：网络错误')
    } finally {
      setBusy(false)
    }
  }

  async function copyModel(id: string) {
    try {
      await navigator.clipboard.writeText(id)
      setCopiedModel(id)
      toast.success(`已复制 ${id}`)
      setTimeout(() => setCopiedModel(null), 1500)
    } catch {
      toast.error('复制失败')
    }
  }

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="api-key">API Key</FieldLabel>
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <KeyRoundIcon />
          </InputGroupAddon>
          <InputGroupInput
            id="api-key"
            type={showKey ? 'text' : 'password'}
            placeholder="sk-..."
            autoComplete="off"
            className="font-mono"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription>
          {'Key 仅保存在当前浏览器会话（sessionStorage），按端点分开记录，不会写入服务端。'}
        </FieldDescription>
      </Field>

      <div className="flex items-center gap-2">
        <Button onClick={() => runCheck('check')} disabled={checking || pulling}>
          {checking ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlugZapIcon data-icon="inline-start" />
          )}
          测试连接
        </Button>
        <Button
          variant="outline"
          onClick={() => runCheck('models')}
          disabled={checking || pulling}
        >
          {pulling ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ListIcon data-icon="inline-start" />
          )}
          拉取模型
        </Button>
      </div>

      {result && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              测试结果
              <Badge
                variant={result.ok ? 'secondary' : 'destructive'}
                className={cn(result.ok && 'bg-success/10 text-success')}
              >
                {result.ok ? '通过' : '失败'}
              </Badge>
            </CardTitle>
            <CardDescription>{endpoint.baseUrl}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">HTTP 状态</dt>
                <dd className="font-mono font-medium">
                  {result.status ?? '—'}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">响应延迟</dt>
                <dd className="font-mono font-medium">{result.latencyMs} ms</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">模型数量</dt>
                <dd className="font-mono font-medium">
                  {result.models?.length ?? '—'}
                </dd>
              </div>
            </dl>
            {!result.ok && result.message && (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {result.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {models.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">模型列表</CardTitle>
            <CardDescription>{`共 ${models.length} 个模型，点击行尾按钮复制模型 ID`}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <InputGroup className="max-w-sm">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="搜索模型 ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <ScrollArea className="h-72 rounded-md border">
              {filteredModels.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyTitle>无匹配模型</EmptyTitle>
                    <EmptyDescription>换个关键词试试</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>模型 ID</TableHead>
                      <TableHead className="w-16 text-right">复制</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModels.map((m) => (
                      <TableRow
                        key={m}
                        className="cursor-pointer"
                        onClick={() => copyModel(m)}
                      >
                        <TableCell className="font-mono text-xs">{m}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`复制 ${m}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              copyModel(m)
                            }}
                          >
                            {copiedModel === m ? <CheckIcon /> : <CopyIcon />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
