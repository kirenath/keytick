'use client'

import { useEffect, useState } from 'react'
import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  CheckIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  describeKey,
  type ApiKeyEntry,
  type ApiKeyStore,
} from '@/lib/apikey-store'

interface ApiKeyManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  store: ApiKeyStore
  onChange: (store: ApiKeyStore) => void
  /** Key 池共享范围提示（同分组名） */
  scopeLabel?: string
}

/**
 * 多 Key 管理对话框：
 * - 列表展示已保存的 Key（按别名/简短描述，默认遮蔽明文，可单条切换可见）
 * - 行内重命名、删除、设为激活
 * - 新增 Key：别名（可选） + 值
 */
export function ApiKeyManager({
  open,
  onOpenChange,
  store,
  onChange,
  scopeLabel,
}: ApiKeyManagerProps) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  useEffect(() => {
    if (!open) {
      setLabel('')
      setValue('')
      setShowValue(false)
      setRevealed({})
      setEditingId(null)
      setEditingLabel('')
    }
  }, [open])

  function commit(next: ApiKeyStore) {
    onChange(next)
  }

  function handleAdd() {
    const v = value.trim()
    if (!v) {
      toast.error('请输入 API Key')
      return
    }
    const entry: ApiKeyEntry = {
      id: crypto.randomUUID(),
      label: label.trim() || '默认',
      value: v,
      createdAt: new Date().toISOString(),
    }
    const next: ApiKeyStore = {
      keys: [...store.keys, entry],
      activeKeyId: store.activeKeyId ?? entry.id,
    }
    commit(next)
    setLabel('')
    setValue('')
    setShowValue(false)
    toast.success('已添加 Key')
  }

  function handleRemove(id: string) {
    const keys = store.keys.filter((k) => k.id !== id)
    const activeKeyId =
      store.activeKeyId === id
        ? keys[0]?.id ?? null
        : store.activeKeyId
    commit({ keys, activeKeyId })
    toast.success('已删除 Key')
  }

  function handleActivate(id: string) {
    commit({ ...store, activeKeyId: id })
  }

  function startEdit(entry: ApiKeyEntry) {
    setEditingId(entry.id)
    setEditingLabel(entry.label)
  }

  function commitEdit() {
    if (!editingId) return
    const trimmed = editingLabel.trim() || '默认'
    const keys = store.keys.map((k) =>
      k.id === editingId ? { ...k, label: trimmed } : k,
    )
    commit({ ...store, keys })
    setEditingId(null)
    setEditingLabel('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingLabel('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>管理 API Key</DialogTitle>
          <DialogDescription>
            {'一个端点可保存多个 Key；Key 仅保存在本机 localStorage，不入服务端。'}
            {scopeLabel
              ? ` 该分组「${scopeLabel}」下所有端点共享这份 Key 池。`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ak-label">别名（可选）</FieldLabel>
            <Input
              id="ak-label"
              placeholder="例如：开发-张三 / 生产-备份"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ak-value">API Key</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="ak-value"
                type={showValue ? 'text' : 'password'}
                placeholder="sk-..."
                autoComplete="off"
                className="font-mono"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={showValue ? '隐藏 Key' : '显示 Key'}
                onClick={() => setShowValue((v) => !v)}
              >
                {showValue ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
              <Button type="button" onClick={handleAdd}>
                <PlusIcon data-icon="inline-start" />
                添加
              </Button>
            </div>
            <FieldDescription>
              {'回车也可直接添加。同一 Key 值可重复保存（例如不同别名场景）。'}
            </FieldDescription>
          </Field>
        </FieldGroup>

        <div className="rounded-md border">
          <ScrollArea className="h-64">
            {store.keys.length === 0 ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyTitle>暂无保存的 Key</EmptyTitle>
                  <EmptyDescription>在上方添加一个 Key 以便后续切换使用</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">激活</TableHead>
                    <TableHead>别名</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead className="w-28 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {store.keys.map((entry) => {
                    const active = entry.id === store.activeKeyId
                    const show = revealed[entry.id]
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Button
                            variant={active ? 'default' : 'outline'}
                            size="icon-xs"
                            aria-label={active ? '当前激活' : '设为激活'}
                            onClick={() => handleActivate(entry.id)}
                          >
                            {active && <CheckIcon />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm">
                          {editingId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                autoFocus
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit()
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                className="h-7"
                              />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="保存别名"
                                onClick={commitEdit}
                              >
                                <CheckIcon />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="取消"
                                onClick={cancelEdit}
                              >
                                <XIcon />
                              </Button>
                            </div>
                          ) : (
                            <span className="flex items-center gap-2">
                              <KeyRoundIcon className="size-3.5 text-muted-foreground" />
                              <span className="truncate">{entry.label}</span>
                              {active && (
                                <Badge variant="secondary" className="bg-success/10 text-success">
                                  激活
                                </Badge>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setRevealed((r) => ({ ...r, [entry.id]: !r[entry.id] }))
                            }
                            aria-label={show ? '隐藏 Key' : '显示 Key'}
                          >
                            <span className="truncate">
                              {show ? entry.value : describeKey(entry)}
                            </span>
                            {show ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="重命名"
                              disabled={editingId === entry.id}
                              onClick={() => startEdit(entry)}
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="删除"
                              onClick={() => handleRemove(entry.id)}
                            >
                              <Trash2Icon className="text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
