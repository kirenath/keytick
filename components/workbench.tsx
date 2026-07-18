'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
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

interface WorkbenchProps {
  endpoint: Endpoint
  onTested: () => void
}

const keyStorageKey = (id: string) => `apikey:${id}`

export function Workbench({ endpoint, onTested }: WorkbenchProps) {
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<string[]>([])

  // Key 只存 sessionStorage，按端点分开记录，绝不发送到任何存储接口
  useEffect(() => {
    try {
      setApiKey(sessionStorage.getItem(keyStorageKey(endpoint.id)) ?? '')
    } catch {
      setApiKey('')
    }
  }, [endpoint.id])

  function handleApiKeyChange(key: string) {
    setApiKey(key)
    try {
      if (key) {
        sessionStorage.setItem(keyStorageKey(endpoint.id), key)
      } else {
        sessionStorage.removeItem(keyStorageKey(endpoint.id))
      }
    } catch {
      // sessionStorage 不可用时静默降级
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-baseline gap-3 border-b px-6 py-4">
        <h2 className="text-base font-medium">{endpoint.name}</h2>
        <Badge variant="outline">
          {ENDPOINT_TYPE_SHORT[getEndpointType(endpoint)]}
        </Badge>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {endpoint.baseUrl}
        </span>
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
              onApiKeyChange={handleApiKeyChange}
              models={models}
              onModelsChange={setModels}
              onTested={onTested}
            />
            <ProbeCard
              endpoint={endpoint}
              apiKey={apiKey}
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
