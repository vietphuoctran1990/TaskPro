import { useState } from 'react'
import { TrendingUp, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { buildAIContext } from '../../lib/aiContext'
import { todayLocalISO } from '../../lib/dateLocal'

const CACHE_KEY = 'taskpro-weekly-review'

function loadCached(): { week: string; text: string } | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') } catch { return null }
}
function saveCache(week: string, text: string) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ week, text })) } catch {}
}

function getWeekKey(today: string) {
  const d = new Date(today)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
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
    const h2 = line.match(/^## (.+)/)
    if (h2) return `<h2 class="font-bold text-slate-800 dark:text-slate-200 mt-3">${esc(h2[1])}</h2>`
    const h4 = line.match(/^\*\*(.+?)\*\*/)
    if (h4) return `<p class="font-semibold text-slate-800 dark:text-slate-200 mt-2">${esc(h4[1])}</p>`
    if (!line.trim()) return '<div class="h-1.5"></div>'
    const inner = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    return `<p class="text-slate-700 dark:text-slate-300">${inner}</p>`
  }).join('')
}

export default function WeeklyReview() {
  const { state, finalStatusIds } = useApp()
  const today   = todayLocalISO()
  const weekKey = getWeekKey(today)
  const cached  = loadCached()

  const [text,     setText]    = useState<string | null>(() => cached?.week === weekKey ? cached.text : null)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const isVi = state.language === 'vi'

  async function generate() {
    setLoading(true); setError(null); setExpanded(true)
    try {
      const res = await fetch('/api/ai-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'weekly-review', context: buildAIContext(state, finalStatusIds) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { content } = await res.json() as { content: string }
      setText(content)
      saveCache(weekKey, content)
    } catch (e) {
      setError(isVi ? 'Không thể tải weekly review. Kiểm tra cài đặt API key.' : 'Failed to load weekly review.')
      console.error('[WeeklyReview]', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/15 dark:to-teal-900/10 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
          <TrendingUp size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 leading-none">
            {isVi ? 'Đánh giá tuần' : 'Weekly Review'}
          </p>
          <p className="text-[11px] text-emerald-500/70 dark:text-emerald-400/60 mt-0.5">
            {isVi ? `Tuần từ ${weekKey}` : `Week of ${weekKey}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {text && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className={cn('p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-colors', loading && 'opacity-50')}
            aria-label={isVi ? 'Tạo đánh giá' : 'Generate review'}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!text && !loading && (
            <button
              onClick={generate}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              {isVi ? 'Tạo ngay' : 'Generate'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="px-5 pb-4 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {loading && (
        <div className="px-5 pb-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <div className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          {isVi ? 'Đang phân tích tuần của bạn…' : 'Analysing your week…'}
        </div>
      )}

      {text && expanded && (
        <div
          className="px-5 pb-5 text-sm space-y-1 leading-relaxed border-t border-emerald-100 dark:border-emerald-900/30 pt-4"
          dangerouslySetInnerHTML={{ __html: renderMd(text) }}
        />
      )}
    </div>
  )
}
