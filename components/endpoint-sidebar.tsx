'use client'

import { useState } from 'react'
import { PlusIcon, PencilIcon, Trash2Icon, RadarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { EndpointDialog } from '@/components/endpoint-dialog'
import { Badge } from '@/components/ui/badge'
import {
  ENDPOINT_TYPE_SHORT,
  getEndpointType,
  type Endpoint,
} from '@/lib/types'

function StatusDot({ status }: { status: Endpoint['lastStatus'] }) {
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        status === 'ok' && 'bg-success',
        status === 'fail' && 'bg-destructive',
        status === null && 'bg-muted-foreground/40',
      )}
      aria-label={
        status === 'ok' ? '上次测试通过' : status === 'fail' ? '上次测试失败' : '未测试'
      }
    />
  )
}

function formatTime(iso?: string) {
  if (!iso) return '未测试'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface EndpointSidebarProps {
  endpoints: Endpoint[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMutate: () => void
}

export function EndpointSidebar({
  endpoints,
  selectedId,
  onSelect,
  onMutate,
}: EndpointSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Endpoint | null>(null)
  const [deleting, setDeleting] = useState<Endpoint | null>(null)

  async function handleDelete() {
    if (!deleting) return
    try {
      const res = await fetch(`/api/endpoints?id=${deleting.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? '删除失败')
        return
      }
      toast.success(`已删除「${deleting.name}」`)
      onMutate()
    } catch {
      toast.error('删除失败：网络错误')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <RadarIcon className="size-4 text-primary" />
          <h1 className="text-sm font-medium">API 端点检测台</h1>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          新增
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {endpoints.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RadarIcon />
              </EmptyMedia>
              <EmptyTitle>还没有端点</EmptyTitle>
              <EmptyDescription>点击「新增」添加第一个 API 端点</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1 p-2">
            {endpoints.map((ep) => (
              <li key={ep.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(ep.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(ep.id)
                  }}
                  className={cn(
                    'group flex w-full cursor-pointer flex-col gap-1 rounded-lg border border-transparent px-3 py-2 text-left transition-colors',
                    selectedId === ep.id
                      ? 'border-primary/30 bg-accent'
                      : 'hover:bg-muted',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={ep.lastStatus} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {ep.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px]"
                    >
                      {ENDPOINT_TYPE_SHORT[getEndpointType(ep)]}
                    </Badge>
                    <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`编辑 ${ep.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(ep)
                          setDialogOpen(true)
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`删除 ${ep.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleting(ep)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </span>
                  </div>
                  <p className="truncate pl-4 font-mono text-xs text-muted-foreground">
                    {ep.baseUrl}
                  </p>
                  <p className="pl-4 text-xs text-muted-foreground">
                    {formatTime(ep.lastTestedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <EndpointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        endpoint={editing}
        onSaved={(ep) => {
          onMutate()
          onSelect(ep.id)
        }}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除端点</AlertDialogTitle>
            <AlertDialogDescription>
              {`确定要删除「${deleting?.name ?? ''}」吗？该操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
