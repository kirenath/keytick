'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  PlusIcon,
  Trash2Icon,
  FolderPlusIcon,
  KeyRoundIcon,
  EyeIcon,
  EyeOffIcon,
  SparklesIcon,
  SaveIcon,
  InfoIcon,
  SettingsIcon,
  GlobeIcon,
  FolderIcon,
  TagIcon,
  CheckIcon,
} from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'

import {
  ENDPOINT_TYPES,
  ENDPOINT_TYPE_LABEL,
  getEndpointType,
  ENDPOINT_TYPE_SHORT,
  type Endpoint,
  type EndpointGroup,
  type EndpointType,
} from '@/lib/types'

import {
  loadStore,
  saveStore,
  getScopeId,
  describeKey,
  type ApiKeyStore,
  type ApiKeyEntry,
} from '@/lib/apikey-store'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const UNGROUPED = '__none__'
const NEW_GROUP = '__new__'

export default function AdminPage() {
  const {
    data: endpoints,
    isLoading: isEndpointsLoading,
    mutate: mutateEndpoints,
  } = useSWR<Endpoint[]>('/api/endpoints', fetcher)

  const {
    data: groups,
    isLoading: isGroupsLoading,
    mutate: mutateGroups,
  } = useSWR<EndpointGroup[]>('/api/groups', fetcher)

  // Form State
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [endpointType, setEndpointType] = useState<EndpointType>('chat')
  const [groupSelect, setGroupSelect] = useState<string>(UNGROUPED)
  const [newGroupName, setNewGroupName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyLabel, setApiKeyLabel] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // API Key management states in existing endpoints
  const [keyInputVisible, setKeyInputVisible] = useState<Record<string, boolean>>({})
  const [newKeys, setNewKeys] = useState<Record<string, { val: string; lbl: string }>>({})
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})

  // Compute endpoints by group
  const groupedData = useMemo(() => {
    if (!endpoints) return { grouped: new Map<string, Endpoint[]>(), ungrouped: [] as Endpoint[] }
    const map = new Map<string, Endpoint[]>()
    const none: Endpoint[] = []
    if (groups) {
      for (const g of groups) map.set(g.id, [])
    }
    for (const ep of endpoints) {
      if (ep.groupId && map.has(ep.groupId)) {
        map.get(ep.groupId)!.push(ep)
      } else {
        none.push(ep)
      }
    }
    return { grouped: map, ungrouped: none }
  }, [endpoints, groups])

  // Local keys loaded for quick listing
  const [localKeyStores, setLocalKeysStores] = useState<Record<string, ApiKeyStore>>({})

  // Fetch local API Key stores once endpoints and groups are fetched
  useEffect(() => {
    if (!endpoints) return
    const stores: Record<string, ApiKeyStore> = {}
    endpoints.forEach((ep) => {
      const scopeId = getScopeId({ endpointId: ep.id, groupId: ep.groupId })
      stores[scopeId] = loadStore(scopeId, ep.id)
    })
    // Also load keys for groups, in case some empty groups or shared groups exist
    if (groups) {
      groups.forEach((g) => {
        const scopeId = `group:${g.id}`
        stores[scopeId] = loadStore(scopeId)
      })
    }
    setLocalKeysStores(stores)
  }, [endpoints, groups])

  const refreshKeyStore = (scopeId: string, endpointId?: string) => {
    const updated = loadStore(scopeId, endpointId)
    setLocalKeysStores((prev) => ({
      ...prev,
      [scopeId]: updated,
    }))
  }

  async function ensureGroupId(): Promise<string | null> {
    if (groupSelect === UNGROUPED) return null
    if (groupSelect === NEW_GROUP) {
      const trimmed = newGroupName.trim()
      if (!trimmed) {
        toast.error('请输入新分组名称')
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
        await mutateGroups()
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

  async function handleAddEndpoint() {
    const trimmedName = name.trim()
    const trimmedUrl = baseUrl.trim()
    if (!trimmedName || !trimmedUrl) {
      toast.error('请填写接口名称和 Base URL')
      return
    }

    setSaving(true)
    try {
      const groupId = await ensureGroupId()
      if (groupId === null && groupSelect === NEW_GROUP) {
        setSaving(false)
        return // Error already handled in ensureGroupId
      }

      const payload = {
        name: trimmedName,
        baseUrl: trimmedUrl,
        endpointType,
        groupId,
        note: note.trim(),
      }

      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? '保存端点失败')
        return
      }

      // If an API Key was provided, save it directly to local store!
      const enteredApiKey = apiKey.trim()
      if (enteredApiKey) {
        const scopeId = getScopeId({ endpointId: data.id, groupId: data.groupId })
        const currentStore = loadStore(scopeId, data.id)
        const newEntry: ApiKeyEntry = {
          id: crypto.randomUUID(),
          label: apiKeyLabel.trim() || 'Admin 新增',
          value: enteredApiKey,
          createdAt: new Date().toISOString(),
        }
        const updatedStore: ApiKeyStore = {
          keys: [...currentStore.keys, newEntry],
          activeKeyId: currentStore.activeKeyId ?? newEntry.id,
        }
        saveStore(scopeId, updatedStore)
        refreshKeyStore(scopeId, data.id)
      }

      toast.success('端点创建成功，相关密钥已同步！')
      
      // Reset main form
      setName('')
      setBaseUrl('')
      setEndpointType('chat')
      setGroupSelect(UNGROUPED)
      setNewGroupName('')
      setApiKey('')
      setApiKeyLabel('')
      setNote('')

      await mutateEndpoints()
    } catch (e) {
      console.error(e)
      toast.error('保存失败：网络或代码错误')
    } finally {
      setSaving(false)
    }
  }

  // Delete Endpoint
  async function handleDeleteEndpoint(ep: Endpoint) {
    if (!confirm(`确定要删除「${ep.name}」吗？相关本地 API Key 将被解绑（不会从 localStorage 删除，但无法访问）。`)) return
    try {
      const res = await fetch(`/api/endpoints?id=${ep.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? '删除失败')
        return
      }
      toast.success(`已删除端点「${ep.name}」`)
      await mutateEndpoints()
    } catch {
      toast.error('删除端点失败：网络错误')
    }
  }

  // Inline Key management handlers
  function handleAddInlineKey(scopeId: string, endpointId?: string) {
    const keyData = newKeys[scopeId]
    if (!keyData || !keyData.val.trim()) {
      toast.error('请输入 API Key')
      return
    }

    const currentStore = loadStore(scopeId, endpointId)
    const newEntry: ApiKeyEntry = {
      id: crypto.randomUUID(),
      label: keyData.lbl.trim() || '默认',
      value: keyData.val.trim(),
      createdAt: new Date().toISOString(),
    }
    const updatedStore: ApiKeyStore = {
      keys: [...currentStore.keys, newEntry],
      activeKeyId: currentStore.activeKeyId ?? newEntry.id,
    }
    saveStore(scopeId, updatedStore)
    refreshKeyStore(scopeId, endpointId)

    // Clear key input state
    setNewKeys((prev) => ({
      ...prev,
      [scopeId]: { val: '', lbl: '' },
    }))
    toast.success('API Key 已添加到该作用域池')
  }

  function handleDeleteInlineKey(scopeId: string, keyId: string, endpointId?: string) {
    const currentStore = loadStore(scopeId, endpointId)
    const keys = currentStore.keys.filter((k) => k.id !== keyId)
    const activeKeyId =
      currentStore.activeKeyId === keyId
        ? keys[0]?.id ?? null
        : currentStore.activeKeyId
    const updatedStore = { keys, activeKeyId }
    saveStore(scopeId, updatedStore)
    refreshKeyStore(scopeId, endpointId)
    toast.success('已删除该 Key')
  }

  function handleActivateInlineKey(scopeId: string, keyId: string, endpointId?: string) {
    const currentStore = loadStore(scopeId, endpointId)
    saveStore(scopeId, { ...currentStore, activeKeyId: keyId })
    refreshKeyStore(scopeId, endpointId)
    toast.success('已修改激活的 API Key')
  }

  const isPageLoading = isEndpointsLoading || isGroupsLoading

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Upper Navigation and Info Bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-background px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'flex items-center gap-2'
            )}
          >
            <ArrowLeftIcon className="size-4" />
            返回端点检测台
          </Link>
          <div className="h-6 w-px bg-muted" />
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-primary" />
            <span className="font-semibold text-base">配置管理后台</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1">
          <InfoIcon className="size-3 text-primary" />
          API Keys 仅在本地存储且不上传到服务器
        </div>
      </header>

      {/* Main Admin Area */}
      <main className="container max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Quick config addition panel (Left Column, 4/12 grid-span) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="shadow-sm border-primary/20">
              <CardHeader className="border-b pb-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-4.5 text-primary" />
                  <CardTitle className="text-lg">一键增加端点 & 密钥</CardTitle>
                </div>
                <CardDescription>
                  专门定制的配置合一渠道，避免在主面板和密钥管理器之间来回切换。
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <FieldGroup className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="ep-name">接口名称 (必填)</FieldLabel>
                    <Input
                      id="ep-name"
                      placeholder="Openrouter"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="ep-url">Base URL (必填)</FieldLabel>
                    <Input
                      id="ep-url"
                      placeholder="https://openrouter.ai/api/v1"
                      className="font-mono"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="ep-type">默认探测协议</FieldLabel>
                      <Select
                        value={endpointType}
                        onValueChange={(v) => v && setEndpointType(v as EndpointType)}
                      >
                        <SelectTrigger id="ep-type" className="w-full">
                          <SelectValue placeholder="选择协议" />
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
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="ep-group">端点所属分群</FieldLabel>
                      <Select
                        value={groupSelect}
                        onValueChange={(v) => v && setGroupSelect(v as string)}
                      >
                        <SelectTrigger id="ep-group" className="w-full">
                          <SelectValue placeholder="未分组" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={UNGROUPED}>不分组</SelectItem>
                            {(groups ?? []).map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={NEW_GROUP}>+ 创立并加入新分群…</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {groupSelect === NEW_GROUP && (
                    <Field className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <FieldLabel htmlFor="ep-group-new" className="text-secondary-foreground font-semibold">
                        新设分群名称
                      </FieldLabel>
                      <Input
                        id="ep-group-new"
                        placeholder="e.g. 共享API-Key分组"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        disabled={saving}
                      />
                    </Field>
                  )}

                  <hr className="my-4 border-dashed" />

                  {/* API Key Box */}
                  <div className="bg-muted/40 p-4 rounded-xl space-y-3 border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                        <KeyRoundIcon className="size-3.5" />
                        配属 API Key (可选)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        同组或未分组端点之本地密钥
                      </span>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="ep-apikey" className="text-xs">API Key 字符串</FieldLabel>
                      <Input
                        id="ep-apikey"
                        type="password"
                        placeholder="sk-..."
                        className="font-mono bg-background"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        autoComplete="off"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="ep-key-label" className="text-xs">密钥别名 / 标签</FieldLabel>
                      <Input
                        id="ep-key-label"
                        placeholder="e.g. 生产主力 / 聊天"
                        className="bg-background"
                        value={apiKeyLabel}
                        onChange={(e) => setApiKeyLabel(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="ep-note">端点备注信息 (可选)</FieldLabel>
                    <Textarea
                      id="ep-note"
                      placeholder="e.g. 限额50 RPM，不支持工具调用"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Field>

                  <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleAddEndpoint}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Spinner className="mr-2" />
                        添加并存库中...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="mr-2 size-4" />
                        一键保存端点与密钥
                      </>
                    )}
                  </Button>
                </FieldGroup>
              </CardContent>
            </Card>
          </div>

          {/* Current Configurations & Credentials pool list (Right Column, 7/12 grid-span) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GlobeIcon className="size-4.5 text-primary" />
                  已保存的接口 & 密钥池列表
                </CardTitle>
                <CardDescription>
                  查看、在行内随时给特定分组或端点快捷新增/删除 API Key，以及清理失效端点。
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                
                {isPageLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <Spinner className="size-8" />
                    <p className="text-sm text-muted-foreground animate-pulse">正在获取配置与本地 Key 信息...</p>
                  </div>
                ) : !endpoints || endpoints.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                    <SettingsIcon className="size-12 mx-auto mb-4 text-muted-foreground/30 animate-spin-slow" />
                    <p className="text-base font-medium">这里空空如也</p>
                    <p className="text-xs max-w-sm mx-auto mt-1">您还没有设立过任何 AI 接口配置。请在左侧表单一键新建第一个接口。</p>
                  </div>
                ) : (
                  <div className="space-y-8">

                    {/* Shared Groups mapping */}
                    {(groups ?? []).map((group) => {
                      const groupEndpoints = groupedData.grouped.get(group.id) ?? []
                      const scopeId = `group:${group.id}`
                      const store = localKeyStores[scopeId] || { keys: [], activeKeyId: null }
                      
                      return (
                        <div key={group.id} className="border rounded-xl overflow-hidden bg-background">
                          {/* Group Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/40 px-4 py-3 border-b border-muted">
                            <div className="flex items-center gap-2 min-w-0">
                              <FolderIcon className="size-4 text-primary shrink-0" />
                              <span className="font-bold text-sm truncate uppercase tracking-wider">{group.name}</span>
                              <Badge className="bg-primary/20 text-primary-foreground border-transparent text-[10px]">
                                分组共用 Key
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 font-mono">
                              共聚 {groupEndpoints.length} 个端点 · 本地已存 {store.keys.length} 密钥
                            </span>
                          </div>

                          <div className="p-4 space-y-4">
                            {/* Group Endpoints sublist */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <GlobeIcon className="size-3" />
                                组内关联端点
                              </div>
                              <ul className="divide-y border rounded-lg bg-muted/10 text-xs">
                                {groupEndpoints.length === 0 ? (
                                  <li className="px-3 py-2 text-xs text-muted-foreground italic">
                                    暂无关联端点，点击左侧或在主页为其指派此分组即可共享此
                                  </li>
                                ) : (
                                  groupEndpoints.map((ep) => (
                                    <li key={ep.id} className="flex items-center justify-between px-3 py-2">
                                      <div className="min-w-0 flex-1 pr-4">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-medium text-foreground">{ep.name}</span>
                                          <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                            {ENDPOINT_TYPE_SHORT[getEndpointType(ep)]}
                                          </Badge>
                                        </div>
                                        <p className="font-mono text-[10px] text-muted-foreground truncate">{ep.baseUrl}</p>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="text-destructive shrink-0 hover:bg-destructive/10"
                                        onClick={() => handleDeleteEndpoint(ep)}
                                        title="清理端点"
                                      >
                                        <Trash2Icon className="size-3.5" />
                                      </Button>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>

                            {/* Group key pools */}
                            {renderKeyPoolArea(scopeId, store, undefined, group.name)}
                          </div>
                        </div>
                      )
                    })}

                    {/* Ungrouped Endpoints list */}
                    {groupedData.ungrouped.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <TagIcon className="size-4 text-muted-foreground" />
                          <h3 className="font-bold text-sm uppercase text-muted-foreground">
                            独立密钥端点 (未指派任何分组)
                          </h3>
                        </div>

                        <div className="space-y-4">
                          {groupedData.ungrouped.map((ep) => {
                            const scopeId = getScopeId({ endpointId: ep.id, groupId: null })
                            const store = localKeyStores[scopeId] || { keys: [], activeKeyId: null }
                            
                            return (
                              <div key={ep.id} className="border rounded-xl overflow-hidden bg-background">
                                <div className="flex items-center justify-between gap-4 bg-muted/25 px-4 py-2 border-b">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-foreground">{ep.name}</span>
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                        {ENDPOINT_TYPE_LABEL[getEndpointType(ep)]}
                                      </Badge>
                                    </div>
                                    <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{ep.baseUrl}</p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive hover:bg-destructive/10 shrink-0"
                                    onClick={() => handleDeleteEndpoint(ep)}
                                  >
                                    <Trash2Icon className="size-4" />
                                  </Button>
                                </div>

                                <div className="p-4">
                                  {renderKeyPoolArea(scopeId, store, ep.id, ep.name)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )

  // Sub-renderer for an API Key store/pool
  function renderKeyPoolArea(scopeId: string, store: ApiKeyStore, endpointId?: string, scopeName?: string) {
    const isAdding = keyInputVisible[scopeId] || false
    const keyVal = newKeys[scopeId]?.val || ''
    const keyLbl = newKeys[scopeId]?.lbl || ''

    return (
      <div className="space-y-3 bg-muted/10 border p-3.5 rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1">
            <KeyRoundIcon className="size-3.5 text-primary" />
            本地保存的 API Keys ({store.keys.length})
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setKeyInputVisible((prev) => ({ ...prev, [scopeId]: !isAdding }))}
          >
            {isAdding ? '收起面板' : '+ 快捷附带 Key'}
          </Button>
        </div>

        {/* Form inline adding a key */}
        {isAdding && (
          <div className="p-3 bg-background border rounded-lg space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="sk-..."
                type="password"
                className="h-8 font-mono text-xs"
                value={keyVal}
                onChange={(e) =>
                  setNewKeys((prev) => ({
                    ...prev,
                    [scopeId]: { val: e.target.value, lbl: prev[scopeId]?.lbl || '' },
                  }))
                }
              />
              <Input
                placeholder="密钥别名 e.g. 硅客-备份"
                className="h-8 text-xs"
                value={keyLbl}
                onChange={(e) =>
                  setNewKeys((prev) => ({
                    ...prev,
                    [scopeId]: { val: prev[scopeId]?.val || '', lbl: e.target.value },
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setKeyInputVisible((prev) => ({ ...prev, [scopeId]: false }))}
              >
                取消
              </Button>
              <Button
                size="xs"
                className="gap-1"
                onClick={() => handleAddInlineKey(scopeId, endpointId)}
              >
                <SaveIcon className="size-3" />
                入库激活
              </Button>
            </div>
          </div>
        )}

        {/* Existing Keys Table / list */}
        {store.keys.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/80 italic pl-5 py-1">
            尚未保存任何 API Key，请点击上方按钮录入。
          </p>
        ) : (
          <div className="border rounded-lg bg-background overflow-hidden text-xs max-h-48 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted-foreground/5 text-muted-foreground text-[10px] uppercase font-bold border-b">
                  <th className="px-3 py-1.5 w-12">激活</th>
                  <th className="px-3 py-1.5">别名</th>
                  <th className="px-3 py-1.5">Key 遮蔽</th>
                  <th className="px-3 py-1.5 text-right w-12">清理</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {store.keys.map((key) => {
                  const isActive = store.activeKeyId === key.id
                  const isRevealed = revealedKeys[key.id] || false

                  return (
                    <tr key={key.id} className={isActive ? "bg-primary/5" : ""}>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          className={`size-5 rounded border flex items-center justify-center transition-colors ${
                            isActive
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30 hover:border-primary"
                          }`}
                          onClick={() => handleActivateInlineKey(scopeId, key.id, endpointId)}
                        >
                          {isActive && <CheckIcon className="size-3" />}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 font-medium truncate max-w-24" title={key.label}>
                        {key.label}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground select-all">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-32">
                            {isRevealed ? key.value : describeKey(key)}
                          </span>
                          <button
                            type="button"
                            className="text-muted-foreground/60 hover:text-foreground shrink-0"
                            onClick={() =>
                              setRevealedKeys((prev) => ({ ...prev, [key.id]: !isRevealed }))
                            }
                          >
                            {isRevealed ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => handleDeleteInlineKey(scopeId, key.id, endpointId)}
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
}
