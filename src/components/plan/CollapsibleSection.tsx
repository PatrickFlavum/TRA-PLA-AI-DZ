import { useState } from 'react'

type Props = {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  hidePrintTitle?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({ title, subtitle, defaultOpen = false, hidePrintTitle = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-6 print-no-break">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 pb-3 mb-4 border-b border-gray-200 text-left cursor-pointer hover:opacity-80 transition-opacity no-print"
      >
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-gray-400 text-sm select-none">{open ? '▲' : '▼'}</span>
      </button>

      {!hidePrintTitle && (
        <div className="hidden print:block pb-3 mb-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
        </div>
      )}

      {open && <div>{children}</div>}
      {!open && <div className="hidden print:block">{children}</div>}
    </div>
  )
}
