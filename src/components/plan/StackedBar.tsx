type Slice = { label: string; value: number; color: string }

type Props = {
  slices: Slice[]
  height?: number
}

const FALLBACK_COLOR = '#6366f1'

export function StackedBar({ slices, height = 28 }: Props) {
  const barSlices = slices.filter(s => s.value > 0)
  if (slices.length === 0) return null

  return (
    <div>
      <div className="w-full rounded-lg overflow-hidden flex bg-gray-100" style={{ height }}>
        {barSlices.map((sl, i) => (
          <div
            key={i}
            style={{ width: `${sl.value}%`, backgroundColor: sl.color || FALLBACK_COLOR }}
            title={`${sl.label}: ${sl.value}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: sl.color || FALLBACK_COLOR }} />
            <span className="text-xs text-gray-700">{sl.label}</span>
            <span className="text-xs text-gray-400 tabular-nums">{sl.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
