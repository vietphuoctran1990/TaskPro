import { useState, useEffect, useRef } from 'react'
import { Save, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import type { Project } from '../../types'

interface Props {
  project: Project | null
  onClose: () => void
}

export default function ProjectNotesModal({ project, onClose }: Props) {
  const { dispatch } = useApp()
  const [notes, setNotes]     = useState('')
  const [saved,  setSaved]    = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (project) setNotes(project.notes ?? '')
    setSaved(true)
  }, [project?.id])

  const handleChange = (value: string) => {
    setNotes(value)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!project) return
      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, notes: value } })
      setSaved(true)
    }, 800)
  }

  const handleSave = () => {
    if (!project) return
    if (timerRef.current) clearTimeout(timerRef.current)
    dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, notes } })
    setSaved(true)
  }

  if (!project) return null

  return (
    <Modal open={!!project} onClose={onClose} size="lg" title={`${project.name} — Ghi chú`}>
      <div className="px-6 py-4 flex flex-col gap-3">
        <textarea
          autoFocus
          value={notes}
          onChange={e => handleChange(e.target.value)}
          placeholder={`Ghi chú, tài liệu, meeting notes cho dự án "${project.name}"…\n\nHỗ trợ Markdown:\n# Tiêu đề\n- Danh sách\n**In đậm** _Nghiêng_`}
          className="w-full min-h-[420px] px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-300 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono leading-relaxed"
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs transition-colors ${saved ? 'text-emerald-500' : 'text-slate-400'}`}>
            {saved ? '✓ Đã lưu' : 'Đang soạn…'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <X size={12} /> Đóng
            </button>
            <button onClick={handleSave} disabled={saved}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              <Save size={12} /> Lưu ngay
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
