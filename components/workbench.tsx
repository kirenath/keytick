'use client'

import { useEffect, useState } from 'react'
import { FolderIcon, CopyIcon, LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckTab } from '@/components/check-tab'
import { ProbeCard } from '@/components/probe-card'
import { ChatTab } from '@/components/chat-tab'
import { HistoryTab } from '@/components/history-tab'
import {
  ENDPOINT_TYPE_LABEL,
  ENDPOINT_TYPE_SHORT,
  getEndpointType,
  type Endpoint,
} from '@/lib/types'
import {
  getActiveValue,
  getScopeId,
  loadStore,
  saveStore,
  type ApiKeyStore,
} from '@/lib/apikey-store'

interface WorkbenchProps {
  endpoint: Endpoint
  /** 该端点所属分组的名称（如有），用于头部展示并提示 Key 池共享范围 */
  groupName?: string
  onTested: () => void
}

const EMPTY_STORE: ApiKeyStore = { keys: [], activeKeyId: null }

export function Workbench({ endpoint, groupName, onTested }: WorkbenchProps) {
  const [store, setStore] = useState<ApiKeyStore>(EMPTY_STORE)
  const [models, setModels] = useState<string[]>([])

  // 同分组的端点共享同一份 Key 池，scope 为 group:<id>；未分组则用 endpoint:<id>
  const scopeId = getScopeId({
    endpointId: endpoint.id,
    groupId: endpoint.groupId,
  })

  // 进入端点或切换分组时重新加载对应 scope 的 Key 列表
  useEffect(() => {
    setStore(loadStore(scopeId, endpoint.id))
  }, [scopeId, endpoint.id])

  function handleStoreChange(next: ApiKeyStore) {
    setStore(next)
    saveStore(scopeId, next)
  }

  const apiKey = getActiveValue(store)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <h2 className="text-base font-medium">{endpoint.name}</h2>
        <Badge variant="outline">
          {ENDPOINT_TYPE_SHORT[getEndpointType(endpoint)]}
        </Badge>
        {groupName && (
          <Badge variant="secondary" className="gap-1">
            <FolderIcon className="size-3" />
            {groupName}
          </Badge>
        )}
        <span className="truncate font-mono text-xs text-muted-foreground">
          {endpoint.baseUrl}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="复制 URL"
            title="复制 URL"
            onClick={() => {
              navigator.clipboard
                .writeText(endpoint.baseUrl)
                .then(() => toast.success('已复制 URL'))
                .catch(() => toast.error('复制失败'))
            }}
          >
            <CopyIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="复制 /v1 URL"
            title="复制追加 /v1 的 URL"
            onClick={() => {
              const base = endpoint.baseUrl.replace(/\/+$/, '')
              const v1Url = base.endsWith('/v1') ? base : base + '/v1'
              navigator.clipboard
                .writeText(v1Url)
                .then(() => toast.success('已复制 /v1 URL'))
                .catch(() => toast.error('复制失败'))
            }}
          >
            <LinkIcon />
          </Button>
        </div>
        {endpoint.note && (
          <span className="truncate text-xs text-muted-foreground">
            {endpoint.note}
          </span>
        )}
        <span className="sr-only">
          {ENDPOINT_TYPE_LABEL[getEndpointType(endpoint)]}
        </span>
      </header>
      <Tabs
        defaultValue="check"
        className="flex min-h-0 flex-1 flex-col gap-4 p-6"
      >
        <TabsList>
          <TabsTrigger value="check">检测</TabsTrigger>
          <TabsTrigger value="chat">对话</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>
        <TabsContent value="check" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <CheckTab
              endpoint={endpoint}
              apiKey={apiKey}
              store={store}
              onStoreChange={handleStoreChange}
              keyScopeLabel={groupName}
              models={models}
              onModelsChange={setModels}
              onTested={onTested}
            />
            <ProbeCard
              endpoint={endpoint}
              apiKey={apiKey}
              models={models}
              onTested={onTested}
              defaultType={getEndpointType(endpoint)}
            />
          </div>
        </TabsContent>
        <TabsContent value="chat" className="min-h-0 flex-1">
          <ChatTab endpoint={endpoint} apiKey={apiKey} models={models} />
        </TabsContent>
        <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto">
          <HistoryTab endpoint={endpoint} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
