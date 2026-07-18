'use client'

import { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ENDPOINT_TYPES,
  ENDPOINT_TYPE_LABEL,
  getEndpointType,
  type Endpoint,
  type EndpointGroup,
  type EndpointType,
} from '@/lib/types'

interface EndpointDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 传入则为编辑模式 */
  endpoint?: Endpoint | null
  groups: EndpointGroup[]
  /** 供 dialog 在保存后通知调用方刷新分组列表（例如内联新建分组后） */
  onGroupsChange: () => void
  onSaved: (endpoint: Endpoint) => void
}

const UNGROUPED = '__none__'
const NEW_GROUP = '__new__'

export function EndpointDialog({
  open,
  onOpenChange,
  endpoint,
  groups,
  onGroupsChange,
  onSaved,
}: EndpointDialogProps) {
  const isEdit = Boolean(endpoint)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [endpointType, setEndpointType] = useState<EndpointType>('chat')
  const [groupSelect, setGroupSelect] = useState<string>(UNGROUPED)
  const [newGroupName, setNewGroupName] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(endpoint?.name ?? '')
      setBaseUrl(endpoint?.baseUrl ?? '')
      setEndpointType(getEndpointType(endpoint))
      setGroupSelect(endpoint?.groupId ?? UNGROUPED)
      setNewGroupName('')
      setNote(endpoint?.note ?? '')
    }
  }, [open, endpoint])

  async function ensureGroupId(): Promise<string | null> {
    // 返回最终用于提交的 groupId；null 表示未分组
    if (groupSelect === UNGROUPED) return null
    if (groupSelect === NEW_GROUP) {
      const trimmed = newGroupName.trim()
      if (!trimmed) {
        toast.error('请输入分组名称')
        return null
      }
      setSaving(true)
      try {
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data?.error ?? '创建分组失败')
          return null
        }
        onGroupsChange()
        // 把选择切换为新创建的分组 id，避免重复创建
        setGroupSelect(data.id)
        setNewGroupName('')
        return data.id as string
      } catch {
        toast.error('创建分组失败：网络错误')
        return null
      } finally {
        setSaving(false)
      }
    }
    return groupSelect
  }

  async function handleSave() {
    if (!name.trim() || !baseUrl.trim()) {
      toast.error('请填写名称和 base URL')
      return
    }
    const groupId = await ensureGroupId()
    if (groupId === null && groupSelect === NEW_GROUP) {
      return // ensureGroupId 里已报错
    }
    setSaving(true)
    try {
      const payload =
        isEdit
          ? { id: endpoint!.id, name, baseUrl, endpointType, groupId, note }
          : { name, baseUrl, endpointType, groupId, note }
      const res = await fetch('/api/endpoints', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? '保存失败')
        return
      }
      toast.success(isEdit ? '端点已更新' : '端点已创建')
      onSaved(data)
      onOpenChange(false)
    } catch {
      toast.error('保存失败：网络错误')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑端点' : '新增端点'}</DialogTitle>
          <DialogDescription>
            {'API Key 仅在本机 localStorage 保存，不入服务端；同分组端点可共享 Key 池。'}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ep-name">名称</FieldLabel>
            <Input
              id="ep-name"
              placeholder="例如：OpenAI 官方"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ep-url">Base URL</FieldLabel>
            <Input
              id="ep-url"
              placeholder="https://api.openai.com"
              className="font-mono"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ep-type">端点类型</FieldLabel>
            <Select
              value={endpointType}
              onValueChange={(v) => v && setEndpointType(v as EndpointType)}
            >
              <SelectTrigger id="ep-type" className="w-full">
                <SelectValue placeholder="选择协议类型（默认 Chat）" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ENDPOINT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ENDPOINT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {
                '决定「协议端点检测」里的默认探测项；不影响其他探测，可随时手动测试任意协议。'
              }
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="ep-group">分组（可选）</FieldLabel>
            <Select
              value={groupSelect}
              onValueChange={(v) => v && setGroupSelect(v as string)}
            >
              <SelectTrigger id="ep-group" className="w-full">
                <SelectValue placeholder="选择分组…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={UNGROUPED}>未分组</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_GROUP}>+ 新建分组…</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {groupSelect === NEW_GROUP && (
              <Input
                id="ep-group-new"
                placeholder="输入新分组名称"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="mt-2"
                disabled={saving}
              />
            )}
            <FieldDescription>
              {'同一分组下的端点共享一份本地 API Key 池，适合「多个 URL 共用一把 Key」的场景。'}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="ep-note">备注（可选）</FieldLabel>
            <Textarea
              id="ep-note"
              placeholder="用途、限额等备注信息"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Spinner data-icon="inline-start" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
