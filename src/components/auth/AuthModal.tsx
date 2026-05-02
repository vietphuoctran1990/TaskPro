import { useState, useCallback } from 'react'
import { X, Mail, Lock, LogIn, UserPlus, Loader2, CheckCircle2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../i18n'
import { supabase } from '../../lib/supabase'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

type Tab = 'login' | 'register'

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const t = useT()
  const [tab,      setTab]      = useState<Tab>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)  // register confirmation

  const reset = useCallback(() => {
    setEmail(''); setPassword(''); setError(null); setLoading(false); setDone(false)
  }, [])

  const switchTab = (t: Tab) => { setTab(t); reset() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { setError(t.auth.requiredFields); return }
    setError(null); setLoading(true)
    try {
      if (tab === 'login') {
        const err = await signIn(email, password)
        if (err) { setError(err); return }
        onClose(); reset()
      } else {
        const err = await signUp(email, password)
        if (err) { setError(err); return }
        setDone(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!supabase) return null  // Auth not configured

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} size="sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          {tab === 'login' ? t.auth.signIn : t.auth.createAccount}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => { onClose(); reset() }}><X size={16} /></Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-6">
        <button onClick={() => switchTab('login')}
          className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5
            ${tab === 'login' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <LogIn size={13} />{t.auth.signIn}
        </button>
        <button onClick={() => switchTab('register')}
          className={`py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5
            ${tab === 'register' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <UserPlus size={13} />{t.auth.createAccount}
        </button>
      </div>

      <div className="px-6 py-5">
        {done ? (
          // Registration confirmation
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-slate-800">{t.auth.checkEmail}</p>
            <p className="text-xs text-slate-500">{email}</p>
            <Button variant="primary" className="w-full mt-2" onClick={() => switchTab('login')}>
              {t.auth.goToSignIn}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{t.auth.email}</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email" autoComplete="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{t.auth.password}</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={tab === 'register' ? t.auth.passwordHint : '••••••••'}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
              {tab === 'register' && (
                <p className="text-xs text-slate-400 mt-1">{t.auth.passwordHint}</p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading
                ? <Loader2 size={15} className="animate-spin" />
                : tab === 'login' ? t.auth.signIn : t.auth.createAccount}
            </Button>

            <p className="text-xs text-center text-slate-400">
              {tab === 'login' ? t.auth.noAccount : t.auth.hasAccount}{' '}
              <button type="button" onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
                className="text-indigo-600 hover:underline font-medium">
                {tab === 'login' ? t.auth.createAccount : t.auth.signIn}
              </button>
            </p>
          </form>
        )}
      </div>
    </Modal>
  )
}
