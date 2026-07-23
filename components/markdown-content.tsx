'use client'

import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeIcon, EyeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface MarkdownContentProps {
  content: string
  /** user 气泡用浅色反色系，assistant 用默认 */
  variant?: 'user' | 'assistant'
  className?: string
  /** 是否显示「渲染 / 原文」切换；默认 true */
  toggleable?: boolean
  /** 额外的页脚内容（如耗时 badge），与切换按钮同一行 */
  footer?: ReactNode
}

/**
 * 对话消息内容：默认渲染 Markdown，可切换查看原始文本。
 */
export function MarkdownContent({
  content,
  variant = 'assistant',
  className,
  toggleable = true,
  footer,
}: MarkdownContentProps) {
  const [showRaw, setShowRaw] = useState(false)
  const isUser = variant === 'user'
  const showFooterRow = toggleable || footer

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-full rounded-lg px-3 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
          className,
        )}
      >
        {showRaw ? (
          <pre
            className={cn(
              // 原文以中英文混排为主，用 sans 避免 mono 字形缺失回退到系统宋体
              'm-0 whitespace-pre-wrap wrap-break-word font-sans text-sm leading-relaxed',
              isUser ? 'text-primary-foreground' : 'text-foreground',
            )}
          >
            {content}
          </pre>
        ) : (
          <div
            className={cn(
              'markdown-body text-sm leading-relaxed wrap-break-word',
              isUser ? 'markdown-body-user' : 'markdown-body-assistant',
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>

      {showFooterRow && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5',
            isUser ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          {toggleable && (
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
          )}
          {footer}
        </div>
      )}
    </div>
  )
}
