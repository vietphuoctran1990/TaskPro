import {
  createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useApp } from './AppContext'
import type { AppState } from '../types'

interface AuthContextValue {
  user:        User | null
  loading:     boolean
  syncing:     boolean
  lastSynced:  Date | null
  signIn:  (email: string, password: string) => Promise<string | null>
  signUp:  (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Supabase row type ──────────────────────────────────────────────────────────
interface CloudRow {
  user_id:  string
  tasks:    AppState['tasks']
  projects: AppState['projects']
  labels:   AppState['labels']
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp()
  const [user,       setUser]       = useState<User | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [syncing,    setSyncing]    = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoadRef = useRef(false)

  // ── Upload current state to Supabase ────────────────────────────────────────
  const upload = useCallback(async (u: User, s: AppState) => {
    if (!supabase) return
    setSyncing(true)
    try {
      const { error } = await supabase.from('user_state').upsert({
        user_id:  u.id,
        tasks:    s.tasks,
        projects: s.projects,
        labels:   s.labels,
        updated_at: new Date().toISOString(),
      } satisfies Partial<CloudRow> & { user_id: string; updated_at: string })
      if (!error) setLastSynced(new Date())
    } finally {
      setSyncing(false)
    }
  }, [])

  // ── Load cloud state and apply to local ─────────────────────────────────────
  const loadFromCloud = useCallback(async (u: User) => {
    if (!supabase) return
    setSyncing(true)
    try {
      const { data, error } = await supabase
        .from('user_state')
        .select('tasks, projects, labels')
        .eq('user_id', u.id)
        .maybeSingle()
      if (error) return
      if (data && (data.tasks?.length || data.projects?.length || data.labels?.length)) {
        dispatch({
          type: 'IMPORT_STATE',
          payload: {
            data: { ...state, tasks: data.tasks ?? [], projects: data.projects ?? [], labels: data.labels ?? [] },
            mode: 'replace',
          },
        })
        setLastSynced(new Date())
      } else {
        // No cloud data yet — upload local state
        await upload(u, state)
      }
    } finally {
      setSyncing(false)
    }
  }, [dispatch, upload, state])

  // ── Auth state listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setLoading(false)
      if (u) { isFirstLoadRef.current = true; loadFromCloud(u) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u && !isFirstLoadRef.current) { isFirstLoadRef.current = true; loadFromCloud(u) }
      if (!u) isFirstLoadRef.current = false
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-upload on state change (debounced 3 s) ─────────────────────────────
  useEffect(() => {
    if (!user || !supabase || !isFirstLoadRef.current) return
    if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current)
    uploadTimerRef.current = setTimeout(() => upload(user, state), 3000)
    return () => { if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current) }
  }, [state.tasks, state.projects, state.labels, user, upload])

  // ── Public API ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return 'Supabase not configured'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return 'Supabase not configured'
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const syncNow = useCallback(async () => {
    if (!user) return
    await upload(user, state)
  }, [user, state, upload])

  return (
    <AuthContext.Provider value={{ user, loading, syncing, lastSynced, signIn, signUp, signOut, syncNow }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
