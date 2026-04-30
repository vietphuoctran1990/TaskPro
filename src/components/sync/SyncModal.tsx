import { useState, useRef } from 'react'
import { Download, Upload, Copy, Check, X, RefreshCw } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { AppState } from '../../types'

interface SyncModalProps {
  open: boolean
  onClose: () => void
}

type Tab = 'export' | 'import' | 'code'

export default function SyncModal({ open, onClose }: SyncModalProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const [tab, setTab] = useState<Tab>('export')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [applyStatus, setApplyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const data = JSON.stringify(state, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `taskpro-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ────────────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as AppState
        if (!data.tasks || !data.projects) throw new Error('invalid')
        if (importMode === 'replace' && !window.confirm(t.sync.confirmReplace)) return
        dispatch({ type: 'IMPORT_STATE', payload: { data, mode: importMode } })
        setImportStatus('success')
        setTimeout(() => setImportStatus('idle'), 3000)
      } catch {
        setImportStatus('error')
        setTimeout(() => setImportStatus('idle'), 3000)
      }
    }
    reader.readAsText(file)
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // ── Sync code ─────────────────────────────────────────────────────────────
  const syncCode = btoa(unescape(encodeURIComponent(JSON.stringify(state))))

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(syncCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApplyCode = () => {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(pasteValue.trim())))) as AppState
      if (!data.tasks || !data.projects) throw new Error('invalid')
      dispatch({ type: 'IMPORT_STATE', payload: { data, mode: importMode } })
      setApplyStatus('success')
      setPasteValue('')
      setTimeout(() => setApplyStatus('idle'), 3000)
    } catch {
      setApplyStatus('error')
      setTimeout(() => setApplyStatus('idle'), 3000)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'export', label: t.sync.exportTitle, icon: <Download size={14} /> },
    { id: 'import', label: t.sync.importTitle, icon: <Upload size={14} /> },
    { id: 'code',   label: t.sync.codeTitle,   icon: <RefreshCw size={14} /> },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t.sync.title} size="md">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 px-6">
        {tabs.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === tb.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-5">
        {/* ── Export tab ── */}
        {tab === 'export' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t.sync.exportDesc}</p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500 space-y-1">
              <p>📋 {state.tasks.length} tasks</p>
              <p>📁 {state.projects.length} projects</p>
              <p>🏷️ {state.labels.length} labels</p>
            </div>
            <Button variant="primary" onClick={handleExport} className="w-full justify-center">
              <Download size={14} /> {t.sync.exportBtn}
            </Button>
          </div>
        )}

        {/* ── Import tab ── */}
        {tab === 'import' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t.sync.importDesc}</p>
            {/* Mode selector */}
            <div className="flex gap-2">
              {(['merge', 'replace'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setImportMode(mode)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    importMode === mode
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {mode === 'merge' ? t.sync.importMerge : t.sync.importReplace}
                </button>
              ))}
            </div>
            {importMode === 'replace' && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                ⚠️ {t.sync.confirmReplace}
              </p>
            )}
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFilePick} />
            <Button
              variant={importStatus === 'error' ? 'ghost' : 'primary'}
              onClick={() => fileRef.current?.click()}
              className="w-full justify-center"
            >
              <Upload size={14} />
              {importStatus === 'success' ? `✓ ${t.sync.importSuccess}` :
               importStatus === 'error'   ? `✗ ${t.sync.importError}` :
               t.sync.importBtn}
            </Button>
          </div>
        )}

        {/* ── Sync code tab ── */}
        {tab === 'code' && (
          <div className="space-y-5">
            {/* Copy code */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">{t.sync.codeTitle}</p>
              <p className="text-xs text-slate-500 mb-3">{t.sync.codeDesc}</p>
              <div className="flex gap-2">
                <div className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 truncate text-slate-500 select-all">
                  {syncCode.slice(0, 40)}…
                </div>
                <Button variant={copied ? 'primary' : 'secondary'} size="sm" onClick={handleCopyCode} className="shrink-0">
                  {copied ? <><Check size={13} /> {t.sync.copied}</> : <><Copy size={13} /> {t.sync.copyCode}</>}
                </Button>
              </div>
            </div>

            {/* Paste & apply */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">{t.sync.pasteCode}</p>
              <div className="flex gap-2">
                <select
                  value={importMode}
                  onChange={e => setImportMode(e.target.value as 'merge' | 'replace')}
                  className="h-9 px-2 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="merge">{t.sync.importMerge}</option>
                  <option value="replace">{t.sync.importReplace}</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={pasteValue}
                onChange={e => { setPasteValue(e.target.value); setApplyStatus('idle') }}
                placeholder={t.sync.codePlaceholder}
                className="w-full mt-2 px-3 py-2 font-mono text-xs rounded-xl border border-slate-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button
                variant="primary"
                onClick={handleApplyCode}
                disabled={!pasteValue.trim()}
                className="w-full justify-center mt-2"
              >
                {applyStatus === 'success' ? `✓ ${t.sync.importSuccess}` :
                 applyStatus === 'error'   ? `✗ ${t.sync.importError}` :
                 t.sync.applyCode}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={13} /> {t.form.cancel}
        </Button>
      </div>
    </Modal>
  )
}
