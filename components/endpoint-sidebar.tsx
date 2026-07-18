'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  RadarIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { EndpointDialog } from '@/components/endpoint-dialog'
import { Badge } from '@/components/ui/badge'
import {
  ENDPOINT_TYPE_SHORT,
  getEndpointType,
  type Endpoint,
  type EndpointGroup,
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
  groups: EndpointGroup[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMutate: () => void
  /** 刷新分组列表 */
  onGroupsMutate: () => void
}

export function EndpointSidebar({
  endpoints,
  groups,
  selectedId,
  onSelect,
  onMutate,
  onGroupsMutate,
}: EndpointSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Endpoint | null>(null)
  const [deleting, setDeleting] = useState<Endpoint | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<EndpointGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<EndpointGroup | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // 计算分组下的端点，以及「未分组」列表
  const { grouped, ungrouped } = useMemo(() => {
    const map = new Map<string, Endpoint[]>()
    const none: Endpoint[] = []
    for (const g of groups) map.set(g.id, [])
    for (const ep of endpoints) {
      if (ep.groupId && map.has(ep.groupId)) {
        map.get(ep.groupId)!.push(ep)
      } else {
        none.push(ep)
      }
    }
    return { grouped: map, ungrouped: none }
  }, [endpoints, groups])

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

  async function handleDeleteGroup() {
    if (!deletingGroup) return
    try {
      const res = await fetch(`/api/groups?id=${deletingGroup.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? '删除分组失败')
        return
      }
      toast.success(`已删除分组「${deletingGroup.name}」，组内端点已变为未分组`)
      onGroupsMutate()
      onMutate()
    } catch {
      toast.error('删除分组失败：网络错误')
    } finally {
      setDeletingGroup(null)
    }
  }

  function toggleCollapse(id: string) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }))
  }

  function renderEndpoint(ep: Endpoint) {
    return (
      <div
        key={ep.id}
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
    )
  }

  function renderGroupHeader(group: EndpointGroup, count: number) {
    const isCollapsed = collapsed[group.id]
    return (
      <div
        key={`gh-${group.id}`}
        className="group flex items-center gap-1 px-2 pt-2"
      >
        <button
          type="button"
          onClick={() => toggleCollapse(group.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="size-3.5 shrink-0" />
          ) : (
            <ChevronDownIcon className="size-3.5 shrink-0" />
          )}
          {isCollapsed ? (
            <FolderIcon className="size-3.5 shrink-0" />
          ) : (
            <FolderOpenIcon className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{group.name}</span>
          <span className="ml-1 rounded bg-muted px-1.5 text-[10px] tabular-nums">
            {count}
          </span>
        </button>
        <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`编辑分组 ${group.name}`}
            onClick={() => {
              setEditingGroup(group)
              setGroupDialogOpen(true)
            }}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`删除分组 ${group.name}`}
            className="text-destructive hover:text-destructive"
            onClick={() => setDeletingGroup(group)}
          >
            <Trash2Icon />
          </Button>
        </span>
      </div>
    )
  }

  function renderGroup(group: EndpointGroup) {
    const list = grouped.get(group.id) ?? []
    const isCollapsed = collapsed[group.id]
    return (
      <div key={`g-${group.id}`}>
        {renderGroupHeader(group, list.length)}
        {!isCollapsed && (
          <div className="mt-1 flex flex-col gap-1 px-2">
            {list.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                分组为空
              </p>
            ) : (
              list.map((ep) => renderEndpoint(ep))
            )}
          </div>
        )}
      </div>
    )
  }

  const showEmpty = endpoints.length === 0 && groups.length === 0

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <RadarIcon className="size-4 text-primary" />
          <h1 className="text-sm font-medium">API 端点检测台</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="新建分组"
            onClick={() => {
              setEditingGroup(null)
              setGroupDialogOpen(true)
            }}
          >
            <FolderPlusIcon />
          </Button>
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
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {showEmpty ? (
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
          <div className="flex flex-col gap-1 p-2">
            {/* 已分组的端点 */}
            {groups.map((g) => renderGroup(g))}

            {/* 未分组：仅当存在未分组端点或有分组时才渲染一个分隔头 */}
            {(ungrouped.length > 0 || groups.length > 0) && (
              <>
                {groups.length > 0 && (
                  <div className="mt-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    未分组
                  </div>
                )}
                <div className="flex flex-col gap-1 px-0">
                  {ungrouped.length === 0 && groups.length > 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      暂无未分组端点
                    </p>
                  ) : (
                    ungrouped.map((ep) => renderEndpoint(ep))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </ScrollArea>

      <EndpointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        endpoint={editing}
        groups={groups}
        onGroupsChange={onGroupsMutate}
        onSaved={(ep) => {
          onMutate()
          onSelect(ep.id)
        }}
      />

      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={editingGroup}
        onSaved={() => {
          onGroupsMutate()
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

      <AlertDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingGroup(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分组</AlertDialogTitle>
            <AlertDialogDescription>
              {`确定要删除分组「${deletingGroup?.name ?? ''}」吗？分组内的端点不会被删除，会自动变为未分组。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteGroup}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: EndpointGroup | null
  onSaved: () => void
}

function GroupDialog({ open, onOpenChange, group, onSaved }: GroupDialogProps) {
  const isEdit = Boolean(group)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(group?.name ?? '')
  }, [open, group])

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('请填写分组名称')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/groups', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: group!.id, name: trimmed } : { name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? '保存失败')
        return
      }
      toast.success(isEdit ? '分组已更新' : '分组已创建')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('保存失败：网络错误')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑分组' : '新建分组'}</DialogTitle>
          <DialogDescription>
            {'同分组的端点会共享本地 API Key 池。'}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="grp-name">分组名称</FieldLabel>
            <Input
              id="grp-name"
              placeholder="例如：OpenAI 系 / 直连代理组"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
