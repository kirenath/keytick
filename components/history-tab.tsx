'use client'

import { HistoryIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import type { Endpoint, TestRecord } from '@/lib/types'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function kindLabel(kind: TestRecord['kind']): string {
  switch (kind) {
    case 'models':
      return '拉取模型'
    case 'check':
      return '测试连接'
    case 'response':
      return '探 Responses'
    case 'messages':
      return '探 Messages'
    case 'v1beta':
      return '探 Gemini'
  }
}

export function HistoryTab({ endpoint }: { endpoint: Endpoint }) {
  const history = endpoint.history ?? []

  if (history.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>暂无测试记录</EmptyTitle>
          <EmptyDescription>
            在「检测」页执行测试连接或拉取模型后，记录会出现在这里。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>结果</TableHead>
            <TableHead className="text-right">延迟</TableHead>
            <TableHead>信息</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((rec) => (
            <TableRow key={rec.id}>
              <TableCell className="text-xs tabular-nums text-muted-foreground">
                {formatTime(rec.time)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{kindLabel(rec.kind)}</Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={rec.ok ? 'secondary' : 'destructive'}
                  className={cn(rec.ok && 'bg-success/10 text-success')}
                >
                  {rec.ok ? '通过' : '失败'}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {rec.latencyMs !== undefined ? `${rec.latencyMs} ms` : '—'}
              </TableCell>
              <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                {rec.message ?? (rec.status !== undefined ? `HTTP ${rec.status}` : '—')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
