import { useState, useMemo, useCallback, memo, useRef } from 'react'
import { Plus, Flame, Check, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { todayLocalISO } from '../../lib/dateLocal'
import { isHabitDueOn, habitStreak, habitLast7 } from '../../lib/habits'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Habit } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e',
  '#f97316', '#f59e0b', '#22c55e', '#10b981',
  '#06b6d4', '#0ea5e9',
]

const DEFAULT_EMOJI = '⭐'
const DEFAULT_COLOR = '#6366f1'

// Keep only the most-recently-typed emoji, preserving multi-codepoint graphemes
// (e.g. ❤️, 🏃‍♂️) that a naive .slice() would split apart.
function lastGrapheme(value: string): string {
  if (!value) return ''
  try {
    const seg = new Intl.Segmenter()
    const parts = [...seg.segment(value)]
    return parts.length ? parts[parts.length - 1].segment : ''
  } catch {
    return [...value].slice(-2).join('')
  }
}

// ── HabitForm ─────────────────────────────────────────────────────────────────

function HabitForm({ habit, nextOrder, onClose }: {
  habit: Habit | null
  nextOrder: number
  onClose: () => void
}) {
  const { dispatch } = useApp()
  const t = useT()
  const isEdit = habit !== null

  const [title, setTitle]           = useState(habit?.title ?? '')
  const [description, setDesc]      = useState(habit?.description ?? '')
  const [emoji, setEmoji]           = useState(habit?.emoji ?? DEFAULT_EMOJI)
  const [color, setColor]           = useState(habit?.color ?? DEFAULT_COLOR)
  const [frequency, setFrequency]   = useState<Habit['frequency']>(habit?.frequency ?? 'daily')
  const [customDays, setCustomDays] = useState<number[]>(habit?.customDays ?? [1, 2, 3, 4, 5])
  const [titleError, setTitleError] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const toggleDay = (dow: number) =>
    setCustomDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow])

  const handleSave = () => {
    if (!title.trim()) { setTitleError(true); titleRef.current?.focus(); return }
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      emoji: emoji.trim() || DEFAULT_EMOJI,
      color,
      frequency,
      customDays: frequency === 'custom' ? customDays : undefined,
      logs: habit?.logs ?? [],
      order: habit?.order ?? nextOrder,
    }
    if (isEdit) {
      dispatch({ type: 'UPDATE_HABIT', payload: { id: habit.id, ...payload } })
    } else {
      dispatch({ type: 'ADD_HABIT', payload })
    }
    onClose()
  }

  const handleDelete = () => {
    if (habit) dispatch({ type: 'DELETE_HABIT', payload: habit.id })
    onClose()
  }

  const days = t.habits.days

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto">

        {/* Modal header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="font-bold text-slate-900 dark:text-white">
            {isEdit ? t.habits.editHabit : t.habits.addHabit}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Emoji + Color */}
          <div className="flex gap-4 items-start">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{t.habits.emoji}</label>
              <input
                value={emoji}
                onChange={e => setEmoji(lastGrapheme(e.target.value))}
                className="w-16 h-12 text-2xl text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{t.habits.color}</label>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all',
                      color === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110' : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c, outlineColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t.habits.name} <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleError(false) }}
              placeholder={t.habits.namePlaceholder}
              className={cn(
                'w-full px-3 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors',
                titleError ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-700'
              )}
            />
            {titleError && <p className="text-xs text-red-500 mt-1">{t.habits.nameRequired}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{t.habits.description}</label>
            <input
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder={t.habits.descPlaceholder}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t.habits.frequency}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['daily', 'weekdays', 'weekends', 'custom'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-medium border text-left transition-colors',
                    frequency === f
                      ? 'border-transparent text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                  )}
                  style={frequency === f ? { backgroundColor: color } : undefined}
                >
                  {t.habits[f]}
                </button>
              ))}
            </div>

            {/* Custom day picker */}
            {frequency === 'custom' && (
              <div className="flex gap-1.5 mt-3">
                {days.map((label, dow) => (
                  <button
                    key={dow}
                    onClick={() => toggleDay(dow)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors',
                      customDays.includes(dow)
                        ? 'border-transparent text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-500 hover:border-slate-300'
                    )}
                    style={customDays.includes(dow) ? { backgroundColor: color } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-8 sm:pb-5 pt-3 border-t border-slate-100 dark:border-slate-800">
          {isEdit && showDelete ? (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-red-500 flex-1">{t.habits.confirmDelete}</span>
              <button onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
                {t.habits.delete}
              </button>
              <button onClick={() => setShowDelete(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold transition-colors">
                {t.habits.cancel}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isEdit && (
                <button onClick={() => setShowDelete(true)}
                  className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
              <div className="flex-1 flex gap-2 justify-end">
                <button onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  {t.habits.cancel}
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                  style={{ backgroundColor: color }}
                >
                  {isEdit ? t.habits.save : t.habits.create}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── HabitCard ─────────────────────────────────────────────────────────────────

const HabitCard = memo(function HabitCard({ habit, todayStr, onEdit }: {
  habit: Habit
  todayStr: string
  onEdit: (h: Habit) => void
}) {
  const { dispatch } = useApp()
  const isDone    = useMemo(() => habit.logs.some(l => l.date === todayStr), [habit.logs, todayStr])
  const streak    = useMemo(() => habitStreak(habit, todayStr), [habit, todayStr])
  const last7     = useMemo(() => habitLast7(habit, todayStr), [habit, todayStr])
  const required  = isHabitDueOn(habit, new Date())

  const toggle = useCallback(() => {
    dispatch({ type: 'TOGGLE_HABIT_LOG', payload: { id: habit.id, date: todayStr } })
  }, [dispatch, habit.id, todayStr])

  return (
    <div className={cn(
      'group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-200',
      'bg-white dark:bg-slate-800/60',
      isDone
        ? 'border-green-200 dark:border-green-800/40 shadow-sm'
        : 'border-slate-200/80 dark:border-slate-700/40 shadow-sm'
    )}>
      {/* Color accent bar */}
      <div className="absolute left-0 inset-y-0 w-1 rounded-l-2xl" style={{ backgroundColor: habit.color }} />

      {/* Emoji */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ml-1 select-none"
        style={{ backgroundColor: habit.color + '1a' }}
      >
        {habit.emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn(
            'text-sm font-semibold text-slate-800 dark:text-slate-100 truncate transition-opacity',
            isDone && 'opacity-40 line-through'
          )}>
            {habit.title}
          </span>
          {streak > 0 && (
            <span className="inline-flex items-center gap-0.5 shrink-0 text-xs font-bold text-amber-500 dark:text-amber-400">
              <Flame size={11} className="fill-amber-400 dark:fill-amber-500" />
              {streak}
            </span>
          )}
        </div>

        {/* 7-day dots */}
        <div className="flex items-center gap-1.5">
          {last7.map(({ ds, due, done, isToday }) => (
            <span
              key={ds}
              title={ds}
              className={cn(
                'w-3.5 h-3.5 rounded-full transition-all duration-300',
                done ? '' : due ? 'border border-current opacity-30' : 'bg-slate-100 dark:bg-slate-700/50',
                isToday && !done && 'ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-800'
              )}
              style={
                done   ? { backgroundColor: habit.color }
                : due  ? { color: habit.color }
                : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* Edit (hover) */}
      <button
        onClick={() => onEdit(habit)}
        className="p-1.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-500 dark:hover:text-slate-400 transition-all shrink-0"
      >
        <Pencil size={13} />
      </button>

      {/* Check button */}
      <button
        onClick={required ? toggle : undefined}
        disabled={!required}
        className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0',
          isDone ? 'shadow-lg text-white' : required ? 'border-2 hover:opacity-80' : 'border-2 border-slate-200 dark:border-slate-700 opacity-25 cursor-default'
        )}
        style={
          isDone ? { backgroundColor: habit.color, boxShadow: `0 4px 14px ${habit.color}55` }
          : required ? { borderColor: habit.color }
          : undefined
        }
      >
        <Check
          size={20}
          strokeWidth={2.5}
          className={!isDone && !required ? 'text-slate-400 dark:text-slate-600' : ''}
          style={isDone ? { color: '#fff' } : required ? { color: habit.color } : undefined}
        />
      </button>
    </div>
  )
})

// ── Main View ─────────────────────────────────────────────────────────────────

export default function HabitsView() {
  const { state } = useApp()
  const t = useT()
  const [formOpen, setFormOpen]         = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)

  const today  = todayLocalISO()
  const habits = useMemo(
    () => [...(state.habits ?? [])].sort((a, b) => a.order - b.order),
    [state.habits]
  )
  const doneToday = useMemo(
    () => habits.filter(h => h.logs.some(l => l.date === today)).length,
    [habits, today]
  )

  const handleEdit = useCallback((h: Habit) => { setEditingHabit(h); setFormOpen(true) }, [])
  const handleAdd  = useCallback(() => { setEditingHabit(null); setFormOpen(true) }, [])

  // Date heading
  const isVi = state.language === 'vi'
  const dateLabel = new Date().toLocaleDateString(
    isVi ? 'vi-VN' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  )

  // Progress ring
  const total    = habits.length
  const progress = total > 0 ? doneToday / total : 0
  const R        = 28
  const CIRC     = 2 * Math.PI * R
  const allDone  = total > 0 && doneToday === total

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.habits.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 capitalize mt-0.5 truncate">{dateLabel}</p>
          {allDone && (
            <p className="text-sm font-semibold text-green-500 dark:text-green-400 mt-1 animate-bounce-once">
              {t.habits.allDone}
            </p>
          )}
        </div>

        {/* Circular progress */}
        {total > 0 && (
          <div className="relative shrink-0 ml-4">
            <svg viewBox="0 0 72 72" className="w-[72px] h-[72px] -rotate-90">
              <circle cx="36" cy="36" r={R} fill="none" strokeWidth="6"
                className="stroke-slate-200 dark:stroke-slate-700" />
              <circle cx="36" cy="36" r={R} fill="none" strokeWidth="6"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
                strokeLinecap="round"
                className="transition-all duration-700"
                style={{ stroke: allDone ? '#22c55e' : '#6366f1' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-slate-900 dark:text-white leading-none">{doneToday}</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-none mt-0.5">/{total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {habits.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16">
          <div className="text-5xl mb-4 select-none">🌱</div>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">{t.habits.emptyTitle}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-7 max-w-xs leading-relaxed">{t.habits.emptyDesc}</p>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
          >
            <Plus size={16} />
            {t.habits.addFirst}
          </button>
        </div>
      ) : (
        <>
          {/* Habit cards */}
          <div className="space-y-3">
            {habits.map(h => (
              <HabitCard key={h.id} habit={h} todayStr={today} onEdit={handleEdit} />
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-400 dark:text-slate-500 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus size={15} />
            {t.habits.addHabit}
          </button>
        </>
      )}

      {/* Form */}
      {formOpen && (
        <HabitForm
          habit={editingHabit}
          nextOrder={habits.length}
          onClose={() => { setFormOpen(false); setEditingHabit(null) }}
        />
      )}
    </div>
  )
}
