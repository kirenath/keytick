'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  InputGroup,
  InputGroupInput,
} from '@/components/ui/input-group'

interface ModelPickerProps {
  value: string
  onChange: (value: string) => void
  models: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

const MAX_VISIBLE = 200

/**
 * 模型选择 combobox：
 * - 模型列表为 0 也能用（输入框依然可手动输入任意模型名）
 * - 列表很长时按输入文本做包含匹配，最多渲染 MAX_VISIBLE 条，避免卡顿
 * - 输入始终是受控的自由文本，未在列表里的名称也可手动填入（命中下游真实模型即可）
 * - 下拉框通过 portal 渲染到 body，避免被父级 overflow:hidden 截断
 */
export function ModelPicker({
  value,
  onChange,
  models,
  placeholder,
  disabled,
  className,
  id,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 外部 value 变更（例如清空、其他按钮调整选择）时同步显示
  useEffect(() => {
    setQuery(value)
  }, [value])

  // 计算并跟踪下拉框的 fixed 定位
  useEffect(() => {
    if (!open || !rootRef.current) return

    function updatePosition() {
      if (!rootRef.current) return
      const rect = rootRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models.slice(0, MAX_VISIBLE)
    const matches = models.filter((m) => m.toLowerCase().includes(q))
    // 让以查询字符串开头的、最短的最靠前，方便快速定位
    matches.sort((a, b) => {
      const al = a.toLowerCase()
      const bl = b.toLowerCase()
      const aStarts = al.startsWith(q) ? 0 : 1
      const bStarts = bl.startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      if (a.length !== b.length) return a.length - b.length
      return al.localeCompare(bl)
    })
    return matches.slice(0, MAX_VISIBLE)
  }, [models, query])

  function handleQueryChange(v: string) {
    setQuery(v)
    onChange(v)
    if (!open) setOpen(true)
  }

  function handleSelect(m: string) {
    setQuery(m)
    onChange(m)
    setOpen(false)
  }

  function handleBlur() {
    // 延迟关闭，让 mousedown/click 有时间触发
    blurTimer.current = setTimeout(() => setOpen(false), 120)
  }

  function handleFocus() {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current)
      blurTimer.current = null
    }
    setOpen(true)
  }

  const showDropdown = open && filtered.length > 0
  const showEmpty = open && models.length === 0

  const listDropdown = showDropdown ? (
    <div
      style={dropdownStyle}
      className="z-50 rounded-md border bg-popover shadow-md"
    >
      <ul className="max-h-60 overflow-y-auto py-1">
        {filtered.map((m) => (
          <li key={m}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(m)
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {m}
              </span>
              {value === m && (
                <CheckIcon className="size-3 shrink-0 text-primary" />
              )}
            </button>
          </li>
        ))}
        {models.length > MAX_VISIBLE && query.trim() === '' && (
          <li className="px-2.5 py-1 text-center text-[10px] text-muted-foreground">
            {`仅显示前 ${MAX_VISIBLE} 条，输入关键词可继续筛选`}
          </li>
        )}
      </ul>
    </div>
  ) : null

  const emptyDropdown = showEmpty ? (
    <div
      style={dropdownStyle}
      className="z-50 rounded-md border bg-popover p-2 text-xs text-muted-foreground shadow-md"
    >
      {'暂无模型列表，可直接输入模型名或点击「拉取模型」'}
    </div>
  ) : null

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <InputGroup>
        <InputGroupInput
          id={id}
          placeholder={placeholder}
          className="font-mono pr-7"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="折叠/展开模型列表"
          onClick={() => {
            if (disabled) return
            setOpen((o) => !o)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon className="size-3.5" />
        </button>
      </InputGroup>
      {mounted && createPortal(listDropdown, document.body)}
      {mounted && createPortal(emptyDropdown, document.body)}
    </div>
  )
}
