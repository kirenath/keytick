'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BrainIcon, ChevronDownIcon, CodeIcon, EyeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface ReasoningBlockProps {
  content: string
  /** 正在流式输出 CoT */
  streaming?: boolean
  className?: string
}

/**
 * 可折叠的思维链 / CoT 展示块。
 * - 流式过程中默认展开，结束后默认折叠
 */
export function ReasoningBlock({
  content,
  streaming = false,
  className,
}: ReasoningBlockProps) {
  const [open, setOpen] = useState(true)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    if (streaming) setOpen(true)
    else setOpen(false)
  }, [streaming])

  if (!content && !streaming) return null

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-lg border border-dashed border-border/80 bg-background/60',
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {streaming && !content ? (
          <Spinner className="size-3" />
        ) : (
          <BrainIcon className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {streaming && !content
            ? '思考中…'
            : streaming
              ? '思考中'
              : '思考过程'}
        </span>
        {content && (
          <span className="tabular-nums text-[10px] opacity-70">
            {content.length} 字
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && content && (
        <div className="border-t border-dashed border-border/60">
          {!streaming && (
            <div className="flex justify-end px-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                onClick={() => setShowRaw((v) => !v)}
                title={showRaw ? '显示 Markdown 渲染' : '显示原始内容'}
              >
                {showRaw ? (
                  <>
                    <EyeIcon className="size-3" />
                    渲染
                  </>
                ) : (
                  <>
                    <CodeIcon className="size-3" />
                    原文
                  </>
                )}
              </Button>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto px-2.5 pb-2 pt-1 text-muted-foreground">
            {showRaw ? (
              <pre className="m-0 whitespace-pre-wrap wrap-break-word font-sans text-xs leading-relaxed">
                {content}
              </pre>
            ) : (
              <div className="markdown-body markdown-body-assistant text-xs leading-relaxed wrap-break-word">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
