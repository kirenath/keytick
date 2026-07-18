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
  type EndpointType,
} from '@/lib/types'

interface EndpointDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 传入则为编辑模式 */
  endpoint?: Endpoint | null
  onSaved: (endpoint: Endpoint) => void
}

export function EndpointDialog({
  open,
  onOpenChange,
  endpoint,
  onSaved,
}: EndpointDialogProps) {
  const isEdit = Boolean(endpoint)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [endpointType, setEndpointType] = useState<EndpointType>('chat')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(endpoint?.name ?? '')
      setBaseUrl(endpoint?.baseUrl ?? '')
      setEndpointType(getEndpointType(endpoint))
      setNote(endpoint?.note ?? '')
    }
  }, [open, endpoint])

  async function handleSave() {
    if (!name.trim() || !baseUrl.trim()) {
      toast.error('请填写名称和 base URL')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/endpoints', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? { id: endpoint!.id, name, baseUrl, endpointType, note }
            : { name, baseUrl, endpointType, note },
        ),
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
            {'API Key 不会随端点保存，仅在检测时临时使用。'}
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
