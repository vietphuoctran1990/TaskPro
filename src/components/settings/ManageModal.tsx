import { useState } from 'react'
import { FolderOpen, Tag, CircleDot, Layers, X } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { ProjectsSection } from './ProjectsSection'
import { LabelsSection } from './LabelsSection'
import { StatusesSection } from './StatusesSection'
import { TemplatesSection } from './TemplatesSection'

type Tab = 'projects' | 'labels' | 'statuses' | 'templates'

interface ManageModalProps {
  open: boolean
  onClose: () => void
  initialTab?: Tab
}

export default function ManageModal({ open, onClose, initialTab = 'projects' }: ManageModalProps) {
  const { state } = useApp()
  const t = useT()
  const [tab, setTab] = useState<Tab>(initialTab)

  const TABS = [
    { key: 'projects'  as Tab, icon: FolderOpen, label: t.manage.projects,  count: state.projects.length },
    { key: 'labels'    as Tab, icon: Tag,         label: t.manage.labels,    count: state.labels.length },
    { key: 'statuses'  as Tab, icon: CircleDot,   label: t.manage.statuses,  count: state.statuses.length },
    { key: 'templates' as Tab, icon: Layers,       label: state.language === 'vi' ? 'Mẫu' : 'Templates', count: (state.templates ?? []).length },
  ]

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t.manage.title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700 px-4 overflow-x-auto">
        {TABS.map(({ key, icon: Icon, label, count }) => (
          <button key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 py-3 px-2 mr-4 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}>
            <Icon size={14} />{label}
            <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">({count})</span>
          </button>
        ))}
      </div>

      <div className="px-4 py-3 overflow-y-auto max-h-[60vh]">
        {tab === 'projects'  && <ProjectsSection />}
        {tab === 'labels'    && <LabelsSection />}
        {tab === 'statuses'  && <StatusesSection />}
        {tab === 'templates' && <TemplatesSection />}
      </div>
    </Modal>
  )
}
