import { Sparkles, X } from 'lucide-react'

export interface AISuggestion {
  description: string
  priority: string
  estimatedHours: number | null
  subtasks: string[]
}

interface AISuggestionPanelProps {
  loading: boolean
  suggestion: AISuggestion | null
  onApply: () => void
  onDismiss: () => void
}

export function AISuggestionPanel({ loading, suggestion, onApply, onDismiss }: AISuggestionPanelProps) {
  if (!loading && !suggestion) return null

  return (
    <div className="mt-2 rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-900/20 px-3 py-2.5 text-xs">
      {loading ? (
        <div className="flex items-center gap-1.5 text-violet-500 dark:text-violet-400">
          <Sparkles size={12} className="animate-pulse" />
          <span>AI đang gợi ý…</span>
        </div>
      ) : suggestion && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles size={12} /> Gợi ý từ AI
            </span>
            <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          </div>
          <div className="space-y-1 text-slate-600 dark:text-slate-400">
            {suggestion.description && (
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Mô tả:</span> {suggestion.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {suggestion.priority && (
                <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                  Ưu tiên: <strong>{suggestion.priority}</strong>
                </span>
              )}
              {suggestion.estimatedHours && (
                <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                  ~{suggestion.estimatedHours}h
                </span>
              )}
            </div>
            {suggestion.subtasks?.length > 0 && (
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Subtasks:</span> {suggestion.subtasks.join(' · ')}</p>
            )}
          </div>
          <button
            onClick={onApply}
            className="mt-2 w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors"
          >
            Áp dụng gợi ý
          </button>
        </>
      )}
    </div>
  )
}
