import { useState, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { buildAIContext } from '../lib/aiContext'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: boolean
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
        body:    JSON.stringify({ type: 'chat', messages: apiHistory, context: buildAIContext(state, finalStatusIds) }),
        signal:  ctrl.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full   = ''
      let buffer = ''

      let streamErr: string | null = null

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
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string }
            if (parsed.error) streamErr = parsed.error
            else if (parsed.text) full += parsed.text
          } catch { /* ignore */ }
        }
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: full, streaming: true }
          return copy
        })
      }

      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = streamErr
          ? { role: 'assistant', content: 'Lỗi từ AI: ' + streamErr, error: true }
          : { role: 'assistant', content: full || '…', streaming: false }
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
