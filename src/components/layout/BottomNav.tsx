import { memo } from 'react'
import { LayoutDashboard, LayoutGrid, List, Calendar, StickyNote } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'

type NavMode = 'dashboard' | 'kanban' | 'list' | 'calendar' | 'notes'

const NAV: { icon: React.ElementType; vi: string; en: string; mode: NavMode }[] = [
  { icon: LayoutDashboard, vi: 'Tổng quan', en: 'Overview', mode: 'dashboard' },
  { icon: LayoutGrid,      vi: 'Kanban',    en: 'Board',    mode: 'kanban' },
  { icon: List,            vi: 'Danh sách', en: 'List',     mode: 'list' },
  { icon: Calendar,        vi: 'Lịch',      en: 'Calendar', mode: 'calendar' },
  { icon: StickyNote,      vi: 'Ghi chú',   en: 'Notes',    mode: 'notes' },
]

const BottomNav = memo(function BottomNav() {
  const { state, dispatch } = useApp()
  const isVi = state.language === 'vi'

  return (
    <nav className="fixed bottom-0 inset-x-0 z-[25] lg:hidden bg-white/90 dark:bg-[#0c1220]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700/60 pb-safe">
      <div className="flex">
        {NAV.map(({ icon: Icon, vi, en, mode }) => {
          const active = state.viewMode === mode
          return (
            <button
              key={mode}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: mode })}
              aria-current={active ? 'page' : undefined}
              aria-label={isVi ? vi : en}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-colors',
                active
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500'
              )}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.75}
                className="transition-transform active:scale-90"
              />
              <span className="text-[10px] font-medium leading-none">{isVi ? vi : en}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
})

export default BottomNav
