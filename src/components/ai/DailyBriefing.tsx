import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { todayLocalISO } from '../../lib/dateLocal'

const CACHE_PREFIX = 'taskpro-briefing-'

function loadCached(today: string): string | null {
  try { return localStorage.getItem(CACHE_PREFIX + today) } catch { return null }
}
function saveCache(today: string, text: string) {
  try { localStorage.setItem(CACHE_PREFIX + today, text) } catch {}
}

function buildContext(state: ReturnType<typeof useApp>['state']) {
  const today   = todayLocalISO()
  const projMap = Object.fromEntries(state.projects.map(p => [p.id, p.name]))
  return {
    today,
    language: state.language,
    projects: state.projects.map(p => ({ id: p.id, name: p.name })),
    tasks: state.tasks.slice(0, 30).map(t => ({
      title:       t.title,
      status:      t.status,
      priority:    t.priority,
      dueDate:     t.dueDate,
      projectName: projMap[t.projectId] ?? '',
    })),
  }
}

function renderMd(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text.split('\n').map(line => {
    const li = line.match(/^[-*] (.+)/)
    if (li) {
      const inner = esc(li[1]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
      return `<li class="ml-4 list-disc text-slate-700 dark:text-slate-300">${inner}</li>`
    }
    const h3 = line.match(/^### (.+)/)
    if (h3) return `<h3 class="font-semibold text-slate-800 dark:text-slate-200 mt-2">${esc(h3[1])}</h3>`
    if (!line.trim()) return '<div class="h-1.5"></div>'
    const inner = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    return `<p class="text-slate-700 dark:text-slate-300">${inner}</p>`
  }).join('')
}

export default function DailyBriefing() {
  const { state }  = useApp()
  const today      = todayLocalISO()
  const [text,     setText]    = useState<string | null>(() => loadCached(today))
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  // Auto-generate on first mount if no cache
  useEffect(() => {
    if (!text) generate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'briefing', context: buildContext(state) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { content } = await res.json() as { content: string }
      setText(content)
      saveCache(today, content)
    } catch (e) {
      setError('Không thể tải briefing. Kiểm tra cài đặt API key.')
      console.error('[DailyBriefing]', e)
    } finally {
      setLoading(false)
    }
  }

  const dateLabel = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/15 dark:to-indigo-900/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-800 dark:text-violet-300 leading-none">Briefing buổi sáng</p>
          <p className="text-[11px] text-violet-500/70 dark:text-violet-400/60 mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={generate}
            disabled={loading}
            title="Tạo lại briefing"
            className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-5 pb-4">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[70, 90, 60, 80].map(w => (
                <div key={w} className="h-3 rounded-full bg-violet-200/60 dark:bg-violet-800/40" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : text ? (
            <div
              className="text-sm space-y-0.5 [&_strong]:text-violet-800 dark:[&_strong]:text-violet-300 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: renderMd(text) }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
