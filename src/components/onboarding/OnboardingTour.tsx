import { useState } from 'react'
import { CheckSquare, Bell, FolderOpen, RefreshCw, X } from 'lucide-react'
import Button from '../ui/Button'
import { useT } from '../../i18n'

const STEPS_ICONS = [CheckSquare, FolderOpen, Bell, RefreshCw]

interface Props {
  onFinish: () => void
}

export default function OnboardingTour({ onFinish }: Props) {
  const t = useT()
  const [step, setStep] = useState(0)

  const steps = [
    { title: t.onboarding.step1Title, desc: t.onboarding.step1Desc },
    { title: t.onboarding.step2Title, desc: t.onboarding.step2Desc },
    { title: t.onboarding.step3Title, desc: t.onboarding.step3Desc },
    { title: t.onboarding.step4Title, desc: t.onboarding.step4Desc },
  ]

  const isLast = step === steps.length - 1
  const Icon = STEPS_ICONS[step]

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-in">
        {/* Skip */}
        <button
          onClick={onFinish}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Skip"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-5 mx-auto">
          <Icon size={28} className="text-indigo-600" />
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2">{steps[step].title}</h2>
          <p className="text-sm text-slate-500 leading-relaxed">{steps[step].desc}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-200 ${
                i === step
                  ? 'w-5 h-2 bg-indigo-600'
                  : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setStep(s => s - 1)}>
              ←
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => isLast ? onFinish() : setStep(s => s + 1)}
          >
            {isLast ? t.onboarding.getStarted : t.onboarding.next}
          </Button>
        </div>
      </div>
    </div>
  )
}
