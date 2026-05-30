import { useState, useRef, useCallback } from 'react'
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
  const [loading, setLoading]   = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Build full context from current app state
      const context = buildAIContext(state, finalStatusIds)

      // Only send the last 12 messages (6 exchanges) for history
      const history = messages.slice(-12).map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: text })

      const res = await fetch('/api/ai-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'chat', messages: history, context }),
        signal:  controller.signal,
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'Lỗi kết nối')
        throw new Error(errText)
      }

      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let   buf    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const chunk = JSON.parse(raw) as { text?: string; error?: string }
            if (chunk.error) throw new Error(chunk.error)
            if (chunk.text) {
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + chunk.text }
                }
                return next
              })
            }
          } catch (e) {
            if ((e as Error).message !== 'Unexpected end of JSON input') throw e
          }
        }
      }

      // Mark streaming done
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, streaming: false }
        }
        return next
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, streaming: false }
          }
          return next
        })
      } else {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              role: 'assistant',
              content: `Lỗi: ${(err as Error).message || 'Không thể kết nối AI'}`,
              error: true,
            }
          }
          return next
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [loading, messages, state, finalStatusIds])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setLoading(false)
  }, [])

  return { messages, loading, send, stop, clear }
}
