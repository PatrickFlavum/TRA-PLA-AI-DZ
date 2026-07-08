import { useState } from 'react'
import type { EmployeeRole, TeamMember, InternExtern, BusinessIT } from '@/types/database'

type Props = {
  members: TeamMember[]
  roles: EmployeeRole[]
  onAdd: (member: Pick<TeamMember, 'role_id' | 'type' | 'category' | 'fte' | 'headcount'>) => void
  onUpdate: (id: string, params: Pick<TeamMember, 'role_id' | 'type' | 'category' | 'fte' | 'headcount'>) => void
  onDelete: (id: string) => void
  disabled?: boolean
}

export function TeamMemberTable({ members, roles, onAdd, onUpdate, onDelete, disabled }: Props) {
  const [roleId, setRoleId] = useState('')
  const [type, setType] = useState<InternExtern>('intern')
  const [category, setCategory] = useState<BusinessIT>('it')
  const [fte, setFte] = useState('')
  const [hc, setHc] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRoleId, setEditRoleId] = useState('')
  const [editType, setEditType] = useState<InternExtern>('intern')
  const [editCategory, setEditCategory] = useState<BusinessIT>('it')
  const [editFte, setEditFte] = useState('')
  const [editHc, setEditHc] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id)
    setEditRoleId(m.role_id)
    setEditType(m.type)
    setEditCategory(m.category)
    setEditFte(String(m.fte))
    setEditHc(String(m.headcount))
    setEditError(null)
  }

  const cancelEdit = () => { setEditingId(null); setEditError(null) }

  const handleSaveEdit = (id: string) => {
    setEditError(null)
    if (!editRoleId) { setEditError('Bitte eine Rolle auswählen.'); return }
    const fteNum = parseFloat(editFte)
    const hcNum = parseInt(editHc)
    if (isNaN(fteNum) || fteNum < 0) { setEditError('FTE muss eine positive Zahl sein.'); return }
    if (isNaN(hcNum) || hcNum < 1 || !Number.isInteger(hcNum)) { setEditError('Headcount muss eine positive Ganzzahl sein.'); return }
    if (fteNum > hcNum) { setEditError('FTE kann nicht grösser als Headcount sein.'); return }
    onUpdate(id, { role_id: editRoleId, type: editType, category: editCategory, fte: fteNum, headcount: hcNum })
    setEditingId(null)
  }

  const handleAdd = () => {
    setError(null)
    if (!roleId) { setError('Bitte eine Rolle auswählen.'); return }
    const fteNum = parseFloat(fte)
    const hcNum = parseInt(hc)
    if (isNaN(fteNum) || fteNum < 0) { setError('FTE muss eine positive Zahl sein.'); return }
    if (isNaN(hcNum) || hcNum < 1 || !Number.isInteger(hcNum)) { setError('Headcount muss eine positive Ganzzahl sein.'); return }
    if (fteNum > hcNum) { setError('FTE kann nicht grösser als Headcount sein.'); return }
    onAdd({ role_id: roleId, type, category, fte: fteNum, headcount: hcNum })
    setRoleId('')
    setFte('')
    setHc('')
  }

  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name ?? '–'

  const cellCls = "w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"

  return (
    <div>
      <table className="w-full text-sm mb-3">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium">Rolle</th>
            <th className="pb-2 font-medium">Intern/Extern</th>
            <th className="pb-2 font-medium">Business/IT</th>
            <th className="pb-2 font-medium text-right">FTE</th>
            <th className="pb-2 font-medium text-right">HC</th>
            {!disabled && <th className="pb-2 w-20" aria-label="Aktionen"></th>}
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={disabled ? 5 : 6} className="py-4 text-center text-gray-400 text-xs">
                Noch keine Mitarbeitenden erfasst.
              </td>
            </tr>
          ) : (
            members.map(m => {
              if (!disabled && editingId === m.id) {
                return (
                  <tr key={m.id} className="border-b border-gray-100 bg-brand-50/30">
                    <td className="py-1.5 pr-1">
                      <select aria-label="Rolle" value={editRoleId} onChange={e => setEditRoleId(e.target.value)} className={cellCls}>
                        <option value="">– Auswählen –</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-1">
                      <select aria-label="Intern/Extern" value={editType} onChange={e => setEditType(e.target.value as InternExtern)} className={cellCls}>
                        <option value="intern">Intern</option>
                        <option value="extern">Extern</option>
                      </select>
                    </td>
                    <td className="py-1.5 pr-1">
                      <select aria-label="Business/IT" value={editCategory} onChange={e => setEditCategory(e.target.value as BusinessIT)} className={cellCls}>
                        <option value="business">Business</option>
                        <option value="it">IT</option>
                      </select>
                    </td>
                    <td className="py-1.5 pr-1">
                      <input aria-label="FTE" type="number" step="0.1" min="0" value={editFte} onChange={e => setEditFte(e.target.value)}
                        placeholder="FTE" className={`${cellCls} w-16 text-right`} />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input aria-label="Headcount" type="number" step="1" min="1" value={editHc} onChange={e => setEditHc(e.target.value)}
                        placeholder="HC" className={`${cellCls} w-14 text-right`} />
                    </td>
                    <td className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => handleSaveEdit(m.id)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium">OK</button>
                        <button type="button" onClick={cancelEdit}
                          className="text-xs text-gray-400 hover:text-gray-600">Abbruch</button>
                      </div>
                      {editError && <p className="text-red-600 text-[10px] mt-0.5 whitespace-nowrap">{editError}</p>}
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={m.id} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{getRoleName(m.role_id)}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.type === 'intern' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                    }`}>
                      {m.type === 'intern' ? 'Intern' : 'Extern'}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.category === 'business' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'
                    }`}>
                      {m.category === 'business' ? 'Business' : 'IT'}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{m.fte.toFixed(1)}</td>
                  <td className="py-2 text-right tabular-nums">{m.headcount}</td>
                  {!disabled && (
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => startEdit(m)}
                          className="text-xs text-brand-500 hover:text-brand-700">Bearb.</button>
                        <button type="button" onClick={() => onDelete(m.id)}
                          className="text-xs text-red-400 hover:text-red-600">×</button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {!disabled && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Neuen Eintrag hinzufügen</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Rolle</label>
              <select
                aria-label="Rolle"
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">– Auswählen –</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Intern/Extern</label>
              <select
                aria-label="Intern/Extern"
                value={type}
                onChange={e => setType(e.target.value as InternExtern)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="intern">Intern</option>
                <option value="extern">Extern</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Business/IT</label>
              <select
                aria-label="Business/IT"
                value={category}
                onChange={e => setCategory(e.target.value as BusinessIT)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="business">Business</option>
                <option value="it">IT</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">FTE</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={fte}
                onChange={e => setFte(e.target.value)}
                placeholder="z.B. 0.8"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Headcount</label>
              <input
                type="number"
                step="1"
                min="1"
                value={hc}
                onChange={e => setHc(e.target.value)}
                placeholder="z.B. 1"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded transition-colors"
          >
            + Hinzufügen
          </button>
        </div>
      )}
    </div>
  )
}
