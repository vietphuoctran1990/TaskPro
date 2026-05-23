import { useState, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { todayLocalISO } from '../lib/dateLocal'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: boolean
}

function buildContext(
  state: ReturnType<typeof useApp>['state'],
  finalStatusIds: ReadonlySet<string>,
) {
  const today   = todayLocalISO()
  const projMap = Object.fromEntries(state.projects.map(p => [p.id, p.name]))
  return {
    today,
    language:      state.language,
    finalStatusIds: [...finalStatusIds],
    statuses:      state.statuses.map(s => ({ id: s.id, name: s.name || s.id, isFinal: s.isFinal ?? false })),
    projects:      state.projects.map(p => ({ id: p.id, name: p.name })),
    tasks:         state.tasks.slice(0, 25).map(t => ({
      id:          t.id,
      title:       t.title,
      status:      t.status,
      isDone:      finalStatusIds.has(t.status),
      priority:    t.priority,
      dueDate:     t.dueDate,
      projectName: projMap[t.projectId] ?? '',
    })),
  }
}

export function useAIChat() {
  const { state, finalStatusIds } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading,  setLoading]  = useState(false)
  const abortRef   = useRef<AbortController | null>(null)

  const send = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', content: text }
    const apiHistory = [...messages, userMsg]
      .filter(m => !m.error)
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }])
    setLoading(true)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/ai-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'chat', messages: apiHistory, context: buildContext(state, finalStatusIds) }),
        signal:  ctrl.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full   = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try { full += (JSON.parse(data) as { text: string }).text } catch { /* ignore */ }
        }
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: full, streaming: true }
          return copy
        })
      }

      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: full || '…', streaming: false }
        return copy
      })
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: 'Lỗi kết nối. Vui lòng thử lại.', error: true }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }, [messages, state, finalStatusIds])

  const stop  = useCallback(() => abortRef.current?.abort(), [])
  const clear = useCallback(() => setMessages([]), [])

  return { messages, loading, send, stop, clear }
}
