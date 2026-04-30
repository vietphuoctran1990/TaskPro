import { createContext, useContext, type ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import { en } from './en'
import { vi } from './vi'
import type { Translations } from './types'

export type { Translations }

const translations: Record<string, Translations> = { en, vi }

const I18nContext = createContext<Translations>(en)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { state } = useApp()
  const t = translations[state.language] ?? en
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>
}

export function useT(): Translations {
  return useContext(I18nContext)
}
