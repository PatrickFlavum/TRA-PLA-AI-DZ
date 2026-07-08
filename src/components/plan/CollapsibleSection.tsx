import { useState } from 'react'

type Props = {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  hidePrintTitle?: boolean
  children: React.ReactNode
  accent?: 'dark-blue' | 'light-blue' | 'dark-gray'
  printTitle?: string
  isFirstSection?: boolean
}

export function CollapsibleSection({ title, subtitle, defaultOpen = false, hidePrintTitle = false, children, accent, printTitle, isFirstSection = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const accentCls = accent === 'dark-blue' ? 'border-l-4 border-l-blue-900 pl-3'
    : accent === 'light-blue' ? 'border-l-4 border-l-blue-300 pl-3'
    : accent === 'dark-gray' ? 'border-l-4 border-l-gray-500 pl-3'
    : ''

  const printBorderCls = accent === 'dark-blue' ? 'border-b-4 border-blue-900'
    : accent === 'light-blue' ? 'border-b-4 border-blue-300'
    : accent === 'dark-gray' ? 'border-b-4 border-gray-500'
    : 'border-b-2 border-gray-300'

  return (
    <div className={`mb-6 ${!isFirstSection ? 'print-break-before' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 pb-3 mb-4 border-b border-gray-200 text-left cursor-pointer hover:opacity-80 transition-opacity no-print ${accentCls}`}
      >
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-gray-400 text-sm select-none">{open ? '▲' : '▼'}</span>
      </button>

      {!hidePrintTitle && (
        <div className={`hidden print:block pb-4 mb-6 ${printBorderCls}`}>
          <h2 className="text-2xl font-bold text-gray-900">{printTitle ?? title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      )}

      {open && <div>{children}</div>}
      {!open && <div className="hidden print:block">{children}</div>}
    </div>
  )
}
