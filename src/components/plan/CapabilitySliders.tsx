import type { BizDevOpsCapability } from '@/types/database'

type Props = {
  capabilities: BizDevOpsCapability[]
  allocations: Record<string, number>
  onChange: (capId: string, value: number) => void
  disabled?: boolean
}

export function CapabilitySliders({ capabilities, allocations, onChange, disabled }: Props) {
  const total = Object.values(allocations).reduce((sum, v) => sum + v, 0)
  const remaining = 100 - total
  const isValid = total === 100
  const isOver = total > 100

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-600">BizDevOps Kapazitätsverteilung</span>
        <span className={`text-xs font-bold ${isValid ? 'text-green-600' : isOver ? 'text-red-600' : 'text-gray-500'}`}>
          {isValid ? 'Genau 100% erreicht' : isOver ? `${total}% – Überschritten!` : `${remaining}% verfügbar`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isValid ? 'bg-green-500' : isOver ? 'bg-red-500' : 'bg-brand-500'}`}
          style={{ width: `${Math.min(total, 100)}%` }}
        />
      </div>

      <div className="space-y-3">
        {capabilities.map(cap => {
          const val = allocations[cap.id] ?? 0
          return (
            <div key={cap.id} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-40 shrink-0">{cap.name}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={val}
                onChange={e => onChange(cap.id, parseInt(e.target.value))}
                disabled={disabled}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600 disabled:opacity-50"
              />
              <div className="w-16 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={val}
                  onChange={e => {
                    const n = parseInt(e.target.value) || 0
                    onChange(cap.id, Math.max(0, Math.min(100, n)))
                  }}
                  disabled={disabled}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                />
              </div>
              <span className="text-xs text-gray-400 w-4">%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
