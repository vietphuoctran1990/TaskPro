import { useState, useEffect, useRef, useCallback } from 'react'
import { X, RotateCcw, Play, Pause, CheckCircle2, Timer } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useT } from '../../i18n'
import { PriorityBadge } from '../ui/Badge'
import { useApp } from '../../context/AppContext'
import type { Task } from '../../types'

type Phase = 'work' | 'short-break' | 'long-break'
const WORK_DURATIONS = [25, 50] as const
type WorkDuration = typeof WORK_DURATIONS[number]
const SESSIONS_PER_CYCLE = 4

function phaseDuration(phase: Phase, work: WorkDuration): number {
  if (phase === 'work') return work * 60
  if (phase === 'long-break') return 15 * 60
  return 5 * 60
}

function playTone(freq: number) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)
    osc.start(); osc.stop(ctx.currentTime + 1)
  } catch {}
}

interface Props { task: Task; onClose: () => void; onDone: () => void }

export default function PomodoroModal({ task, onClose, onDone }: Props) {
  const t = useT()
  const { state } = useApp()
  const [workDur, setWorkDur] = useState<WorkDuration>(25)
  const [phase, setPhase] = useState<Phase>('work')
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)

  // Refs so phase-completion effect can read latest values without re-subscribing.
  // Synced in an effect (not during render) per React 19 ref rules.
  const phaseRef    = useRef(phase)
  const sessionsRef = useRef(sessions)
  const workDurRef  = useRef(workDur)
  useEffect(() => {
    phaseRef.current    = phase
    sessionsRef.current = sessions
    workDurRef.current  = workDur
  })

  // Reset when task changes
  useEffect(() => {
    setPhase('work'); setTimeLeft(workDur * 60)
    setRunning(false); setSessions(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  // Sync timeLeft when workDur changes (only if not running and in work phase)
  useEffect(() => {
    if (phase === 'work' && !running) setTimeLeft(workDur * 60)
  }, [workDur, phase, running])

  // Countdown tick
  useEffect(() => {
    if (!running || timeLeft <= 0) return
    const id = setTimeout(() => setTimeLeft(n => n - 1), 1000)
    return () => clearTimeout(id)
  }, [running, timeLeft])

  // Phase completion
  useEffect(() => {
    if (timeLeft !== 0 || !running) return
    setRunning(false)
    if (phaseRef.current === 'work') {
      playTone(880)
      const next = sessionsRef.current + 1
      setSessions(next)
      if (next % SESSIONS_PER_CYCLE === 0) {
        setPhase('long-break'); setTimeLeft(15 * 60)
      } else {
        setPhase('short-break'); setTimeLeft(5 * 60)
      }
    } else {
      playTone(660)
      setPhase('work'); setTimeLeft(workDurRef.current * 60)
    }
  }, [timeLeft, running])

  const handleReset = useCallback(() => {
    setRunning(false)
    setTimeLeft(phaseDuration(phaseRef.current, workDurRef.current))
  }, [])

  const total    = phaseDuration(phase, workDur)
  const progress = (total - timeLeft) / total
  const mm       = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss       = String(timeLeft % 60).padStart(2, '0')

  const isWork  = phase === 'work'
  const isLong  = phase === 'long-break'
  const project = state.projects.find(p => p.id === task.projectId)

  // SVG ring
  const R    = 88
  const CIRC = 2 * Math.PI * R

  const phaseLabel = isWork ? t.pomodoro.work : isLong ? t.pomodoro.longBreak : t.pomodoro.shortBreak
  const nextLabel  = isWork
    ? ((sessions + 1) % SESSIONS_PER_CYCLE === 0 ? t.pomodoro.nextLongBreak : t.pomodoro.nextShortBreak)
    : t.pomodoro.nextWork

  const ringColor = isWork ? '#818cf8' : isLong ? '#60a5fa' : '#34d399'
  const bgClass   = isWork ? 'from-indigo-950 to-indigo-900'
                  : isLong ? 'from-blue-950 to-blue-900'
                  :           'from-emerald-950 to-emerald-900'

  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b', bgClass)}>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 text-white/70">
          <Timer size={16} />
          <span className="text-sm font-semibold">{t.pomodoro.focus}</span>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <X size={15} className="text-white/80" />
        </button>
      </div>

      {/* Progress ring + timer */}
      <div className="relative mb-7">
        <svg viewBox="0 0 200 200" className="w-52 h-52 sm:w-60 sm:h-60">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="100" cy="100" r={R} fill="none"
            stroke={ringColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            transform="rotate(-90 100 100)"
            style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-5xl font-bold text-white tabular-nums tracking-tight">{mm}:{ss}</span>
          <span className="text-sm text-white/55 font-medium">{phaseLabel}</span>
        </div>
      </div>

      {/* Task card */}
      <div className="mx-6 mb-7 w-full max-w-xs bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
        <p className="text-white font-semibold text-sm leading-snug mb-2 line-clamp-2">{task.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={task.priority} />
          {project && (
            <span className="flex items-center gap-1.5 text-xs text-white/45">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              {project.name}
            </span>
          )}
        </div>
      </div>

      {/* Session dots */}
      <div className="flex items-center gap-2 mb-7">
        {Array.from({ length: SESSIONS_PER_CYCLE }).map((_, i) => (
          <span key={i} className={cn(
            'w-2.5 h-2.5 rounded-full transition-colors duration-300',
            i < (sessions % SESSIONS_PER_CYCLE) ? 'bg-white' : 'bg-white/20'
          )} />
        ))}
        <span className="text-white/35 text-xs ml-1.5">{nextLabel}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        <button onClick={handleReset}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title={t.pomodoro.reset}>
          <RotateCcw size={15} className="text-white/65" />
        </button>

        <button
          onClick={() => setRunning(r => !r)}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-white shadow-lg hover:bg-white/90 active:scale-95 transition-all"
          title={running ? t.pomodoro.pause : t.pomodoro.start}
        >
          {running
            ? <Pause size={26} className="text-indigo-800 fill-indigo-800" />
            : <Play  size={26} className="text-indigo-800 fill-indigo-800 translate-x-0.5" />}
        </button>

        <button onClick={onDone}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title={t.pomodoro.done}>
          <CheckCircle2 size={15} className="text-white/65" />
        </button>
      </div>

      {/* Work duration selector (only visible when paused in work phase) */}
      {!running && phase === 'work' && (
        <div className="flex items-center gap-2 mt-7">
          {WORK_DURATIONS.map(d => (
            <button key={d} onClick={() => setWorkDur(d)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-medium border transition-colors',
                workDur === d
                  ? 'bg-white text-indigo-900 border-white'
                  : 'bg-transparent text-white/45 border-white/20 hover:border-white/50 hover:text-white/70'
              )}>
              {d === 25 ? t.pomodoro.min25 : t.pomodoro.min50}
            </button>
          ))}
        </div>
      )}

      {/* Session counter */}
      <p className="mt-4 text-white/30 text-xs">{t.pomodoro.session(sessions + 1)}</p>
    </div>
  )
}
