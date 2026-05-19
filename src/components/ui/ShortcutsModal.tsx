import Modal from './Modal'
import { useT } from '../../i18n'

interface Props { open: boolean; onClose: () => void }

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
      {children}
    </kbd>
  )
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{title}</p>
      <div>{children}</div>
    </div>
  )
}

export default function ShortcutsModal({ open, onClose }: Props) {
  const t = useT()
  return (
    <Modal open={open} onClose={onClose} title={t.shortcuts.title} size="sm">
      <div className="px-6 py-5">
        <Section title={t.shortcuts.groupGeneral}>
          <Row keys={['⌘', 'K']}   label={t.shortcuts.palette} />
          <Row keys={['?']}         label={t.shortcuts.showShortcuts} />
          <Row keys={['Esc']}       label={t.shortcuts.closeDialog} />
        </Section>
        <Section title={t.shortcuts.groupView}>
          <Row keys={['↑', '↓']}   label={t.shortcuts.navigate} />
          <Row keys={['↵']}         label={t.shortcuts.switchView} />
        </Section>
      </div>
    </Modal>
  )
}
