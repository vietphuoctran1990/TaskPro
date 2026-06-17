import {
  createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { useApp } from './AppContext'
import type { AppState, DeletedIds } from '../types'

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

// Polling is the fallback when Supabase Realtime isn't available; Realtime (below)
// delivers near-instant cross-device updates when the table is in the publication.
const POLL_MS = 15_000
const UPLOAD_DEBOUNCE_MS = 1_500

// Merge tombstones from two sources; union of both
function mergeTombstones(a?: Partial<DeletedIds>, b?: Partial<DeletedIds>): DeletedIds {
  const merge = (x?: Record<string, number>, y?: Record<string, number>) => ({ ...(x ?? {}), ...(y ?? {}) })
  return {
    tasks:       merge(a?.tasks,       b?.tasks),
    projects:    merge(a?.projects,    b?.projects),
    labels:      merge(a?.labels,      b?.labels),
    notes:       merge(a?.notes,       b?.notes),
    noteFolders: merge(a?.noteFolders, b?.noteFolders),
    statuses:    merge(a?.statuses,    b?.statuses),
    habits:      merge(a?.habits,      b?.habits),
  }
}

// Merge two arrays by id; prefer newer updatedAt. Drop items present in tombstones
// — both local AND remote — so a deletion on one device propagates to the others.
function mergeByDate<T extends { id: string }>(local: T[], remote: T[], deleted: Record<string, number> = {}, dateKey = 'updatedAt'): T[] {
  const map = new Map<string, T>()
  for (const item of local) {
    if (deleted[item.id]) continue
    map.set(item.id, item)
  }
  for (const item of remote) {
    if (deleted[item.id]) continue
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
    } else {
      const lt = (existing as Record<string, unknown>)[dateKey] as string ?? ''
      const rt = (item   as Record<string, unknown>)[dateKey] as string ?? ''
      if (rt > lt) map.set(item.id, item)
    }
  }
  return Array.from(map.values())
}

// Add cloud items not already present locally. Drop tombstoned items (local + remote)
// so deletions propagate across devices.
function addOnly<T extends { id: string }>(local: T[], remote: T[], deleted: Record<string, number> = {}): T[] {
  const kept = local.filter(i => !deleted[i.id])
  const ids  = new Set(kept.map(i => i.id))
  return [...kept, ...remote.filter(i => !ids.has(i.id) && !deleted[i.id])]
}

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
        data:       { tasks: s.tasks, projects: s.projects, labels: s.labels, notes: s.notes, noteFolders: s.noteFolders, statuses: s.statuses, habits: s.habits, _deletedIds: s._deletedIds },
        updated_at: new Date().toISOString(),
      })
      if (!error) {
        const now = new Date()
        setLastSynced(now)
        lastSyncedRef.current = now
      } else {
        logger.error('[sync] upload error:', error.message)
      }
    } catch (err) {
      logger.error('[sync] upload failed:', err)
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

      if (error) { logger.error('[sync] pull error:', error.message); return false }
      if (!data?.data) return false

      const cloudMs = data.updated_at ? new Date(data.updated_at).getTime() : 0
      const localMs = lastSyncedRef.current?.getTime() ?? 0

      if (!force && cloudMs <= localMs) return false // nothing newer

      const { tasks = [], projects = [], labels = [], notes = [], noteFolders = [], statuses = [], habits = [], _deletedIds: cloudDeleted } = data.data as {
        tasks?: AppState['tasks'], projects?: AppState['projects'], labels?: AppState['labels'],
        notes?: AppState['notes'], noteFolders?: AppState['noteFolders'], statuses?: AppState['statuses'],
        habits?: AppState['habits'],
        _deletedIds?: Partial<DeletedIds>
      }

      const cur     = stateRef.current
      const deleted = mergeTombstones(cur._deletedIds, cloudDeleted)

      dispatch({
        type: 'IMPORT_STATE',
        payload: {
          data: {
            ...cur,
            tasks:       mergeByDate(cur.tasks,       tasks,       deleted.tasks),
            projects:    addOnly(cur.projects,         projects,    deleted.projects),
            labels:      addOnly(cur.labels,           labels,      deleted.labels),
            notes:       mergeByDate(cur.notes,        notes,       deleted.notes),
            noteFolders: addOnly(cur.noteFolders,      noteFolders, deleted.noteFolders),
            statuses:    addOnly(cur.statuses,         statuses,    deleted.statuses),
            // Habits change often (toggling logs) → merge by recency like tasks/notes.
            habits:      mergeByDate(cur.habits ?? [], habits,      deleted.habits),
            _deletedIds: deleted,
          },
          mode: 'replace',
        },
      })
      const synced = new Date(cloudMs || Date.now())
      setLastSynced(synced)
      lastSyncedRef.current = synced
      return true
    } catch (err) {
      logger.error('[sync] pull failed:', err)
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
    }, UPLOAD_DEBOUNCE_MS)
    return () => { if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current) }
  }, [state.tasks, state.projects, state.labels, state.notes, state.noteFolders, state.statuses, state.habits, upload])

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

  // ── Realtime: pull instantly when another device writes to our cloud row ───
  // Best-effort — if the table isn't in the Supabase realtime publication this
  // simply never fires and the 15s poll above keeps things in sync.
  useEffect(() => {
    if (!supabase || !user) return
    const channel = supabase
      .channel(`user_state:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_state', filter: `user_id=eq.${user.id}` },
        () => { if (initializedRef.current) pullFromCloud(user) }
      )
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  }, [user, pullFromCloud])

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
