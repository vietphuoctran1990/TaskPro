import {
  createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useApp } from './AppContext'
import type { AppState } from '../types'

interface AuthContextValue {
  user:       User | null
  loading:    boolean
  syncing:    boolean
  lastSynced: Date | null
  signIn:  (email: string, password: string) => Promise<string | null>
  signUp:  (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const POLL_MS = 30_000 // poll every 30s for changes from other devices

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp()
  const [user,       setUser]       = useState<User | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [syncing,    setSyncing]    = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  // Refs so effects always see fresh values without re-running
  const stateRef          = useRef(state)
  const userRef           = useRef<User | null>(null)
  const lastSyncedRef     = useRef<Date | null>(null)
  const uploadTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef    = useRef(false)

  useEffect(() => { stateRef.current = state }, [state])

  // ── Upload ─────────────────────────────────────────────────────────────────
  const upload = useCallback(async (u: User, s: AppState) => {
    if (!supabase) return
    try {
      // Store everything nested inside the `data` column (matches the SQL schema)
      const { error } = await supabase.from('user_state').upsert({
        user_id:    u.id,
        data:       { tasks: s.tasks, projects: s.projects, labels: s.labels, notes: s.notes, noteFolders: s.noteFolders },
        updated_at: new Date().toISOString(),
      })
      if (!error) {
        const now = new Date()
        setLastSynced(now)
        lastSyncedRef.current = now
      } else {
        console.error('[sync] upload error:', error.message)
      }
    } catch (err) {
      console.error('[sync] upload failed:', err)
    }
  }, [])

  // ── Pull from cloud ────────────────────────────────────────────────────────
  // Returns true if cloud data was applied (it was newer than local)
  const pullFromCloud = useCallback(async (u: User, force = false): Promise<boolean> => {
    if (!supabase) return false
    try {
      const { data, error } = await supabase
        .from('user_state')
        .select('data, updated_at')
        .eq('user_id', u.id)
        .maybeSingle()

      if (error) { console.error('[sync] pull error:', error.message); return false }
      if (!data?.data) return false

      const cloudMs = data.updated_at ? new Date(data.updated_at).getTime() : 0
      const localMs = lastSyncedRef.current?.getTime() ?? 0

      if (!force && cloudMs <= localMs) return false // nothing newer

      const { tasks = [], projects = [], labels = [], notes = [], noteFolders = [] } = data.data as {
        tasks?: AppState['tasks'], projects?: AppState['projects'], labels?: AppState['labels'],
        notes?: AppState['notes'], noteFolders?: AppState['noteFolders']
      }

      dispatch({
        type: 'IMPORT_STATE',
        payload: {
          data: { ...stateRef.current, tasks, projects, labels, notes, noteFolders },
          mode: 'replace',
        },
      })
      const synced = new Date(cloudMs || Date.now())
      setLastSynced(synced)
      lastSyncedRef.current = synced
      return true
    } catch (err) {
      console.error('[sync] pull failed:', err)
      return false
    }
  }, [dispatch])

  // ── Init on login: pull first, upload if nothing in cloud ─────────────────
  const initSync = useCallback(async (u: User) => {
    if (!supabase) return
    setSyncing(true)
    try {
      const hadData = await pullFromCloud(u, true)
      if (!hadData) await upload(u, stateRef.current)
    } finally {
      setSyncing(false)
      initializedRef.current = true
    }
  }, [pullFromCloud, upload])

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u); userRef.current = u
      setLoading(false)
      if (u) initSync(u)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      const u = session?.user ?? null
      setUser(u); userRef.current = u
      if (u && !initializedRef.current) initSync(u)
      if (!u) {
        initializedRef.current = false
        setLastSynced(null); lastSyncedRef.current = null
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-upload on local state changes (debounced 3s) ─────────────────────
  useEffect(() => {
    if (!supabase || !initializedRef.current) return
    const u = userRef.current
    if (!u) return
    if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current)
    uploadTimerRef.current = setTimeout(() => {
      if (userRef.current) upload(userRef.current, stateRef.current)
    }, 3000)
    return () => { if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current) }
  }, [state.tasks, state.projects, state.labels, state.notes, state.noteFolders, upload])

  // ── Poll every 30s for changes from other devices ─────────────────────────
  useEffect(() => {
    if (!supabase) return
    const id = setInterval(() => {
      const u = userRef.current
      if (u && initializedRef.current) pullFromCloud(u)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [pullFromCloud])

  // ── Sync when tab becomes visible (switching back from another app) ────────
  useEffect(() => {
    if (!supabase) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const u = userRef.current
      if (u && initializedRef.current) pullFromCloud(u)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pullFromCloud])

  // ── Public API ─────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase not configured'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase not configured'
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const syncNow = useCallback(async () => {
    const u = userRef.current
    if (!u) return
    setSyncing(true)
    try {
      await pullFromCloud(u, true)
    } finally {
      setSyncing(false)
    }
  }, [pullFromCloud])

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
