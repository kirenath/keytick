'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { MousePointerClickIcon } from 'lucide-react'
import { EndpointSidebar } from '@/components/endpoint-sidebar'
import { Workbench } from '@/components/workbench'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import type { Endpoint, EndpointGroup } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function Page() {
  const {
    data: endpoints,
    isLoading,
    mutate,
  } = useSWR<Endpoint[]>('/api/endpoints', fetcher)
  const {
    data: groups,
    mutate: mutateGroups,
  } = useSWR<EndpointGroup[]>('/api/groups', fetcher)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = endpoints?.find((e) => e.id === selectedId) ?? null

  return (
    <main className="flex h-dvh overflow-hidden">
      <EndpointSidebar
        endpoints={endpoints ?? []}
        groups={groups ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMutate={() => mutate()}
        onGroupsMutate={() => mutateGroups()}
      />
      <section className="min-w-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : selected ? (
          <Workbench
            key={selected.id}
            endpoint={selected}
            onTested={() => mutate()}
          />
        ) : (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MousePointerClickIcon />
              </EmptyMedia>
              <EmptyTitle>选择一个端点开始</EmptyTitle>
              <EmptyDescription>
                在左侧选择已保存的端点，或点击「新增」添加一个 OpenAI 兼容格式的 API 端点。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </main>
  )
}
