import { useState } from 'react'
import { Target, RefreshCw, AlertTriangle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { todayLocalISO } from '../../lib/dateLocal'

interface TopTask  { title: string; reason: string }
interface Insights { topTasks: TopTask[]; warnings: string[]; tip: string }

function buildContext(state: ReturnType<typeof useApp>['state']) {
  const today   = todayLocalISO()
  const projMap = Object.fromEntries(state.projects.map(p => [p.id, p.name]))
  return {
    today,
    language: state.language,
    projects: state.projects.map(p => ({ id: p.id, name: p.name })),
    tasks: state.tasks
      .filter(t => t.status !== 'done')
      .slice(0, 15)
      .map(t => ({
        title:       t.title,
        status:      t.status,
        priority:    t.priority,
        dueDate:     t.dueDate,
        projectName: projMap[t.projectId] ?? '',
      })),
  }
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-blue-400',
  low:    'bg-slate-300',
}
const RANK_LABEL = ['1st', '2nd', '3rd', '4th', '5th']

export default function PriorityInsights() {
  const { state }    = useApp()
  const [data,     setData]     = useState<Insights | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  async function analyze() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'priorities', context: buildContext(state) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as Insights
      setData(json)
    } catch (e) {
      setError('Không thể phân tích. Kiểm tra cài đặt API key.')
      console.error('[PriorityInsights]', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/15 dark:to-orange-900/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
          <Target size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 leading-none">Gợi ý ưu tiên</p>
          <p className="text-[11px] text-amber-600/70 dark:text-amber-500/60 mt-0.5">
            {data ? 'AI đã phân tích' : 'Để AI phân tích thứ tự ưu tiên'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={analyze}
            disabled={loading}
            title={data ? 'Phân tích lại' : 'Phân tích ngay'}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={cn(loading && 'animate-spin')} />
            {data ? 'Làm mới' : 'Phân tích'}
          </button>
          {data && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-5 pb-4">
          {loading && (
            <div className="space-y-2 animate-pulse">
              {[80, 65, 75, 55, 70].map((w, i) => (
                <div key={i} className="h-8 rounded-xl bg-amber-200/50 dark:bg-amber-800/30" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {!loading && !error && !data && (
            <p className="text-xs text-amber-700/60 dark:text-amber-500/60 italic">
              Nhấn "Phân tích" để AI xem qua danh sách tasks và gợi ý thứ tự làm việc tối ưu cho hôm nay.
            </p>
          )}
          {data && !loading && (
            <div className="space-y-4">
              {/* Top tasks */}
              {data.topTasks.length > 0 && (
                <div className="space-y-2">
                  {data.topTasks.map((t, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-white/70 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{t.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{t.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {data.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {data.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
                      <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 dark:text-red-400">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tip */}
              {data.tip && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40">
                  <Lightbulb size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">{data.tip}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
