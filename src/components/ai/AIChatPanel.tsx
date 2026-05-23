import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Bot, Send, Square, Trash2, X, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAIChat } from '../../hooks/useAIChat'

// ── Minimal markdown renderer for chat ───────────────────────────────────────

function renderChat(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return text
    .split('\n')
    .map(line => {
      const li = line.match(/^[-*] (.+)/)
      if (li) return `<li class="ml-4 list-disc">${fmt(esc(li[1]))}</li>`
      if (!line.trim()) return '<div class="h-2"></div>'
      return `<p>${fmt(esc(line))}</p>`
    })
    .join('')
}

function fmt(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/10 px-1 rounded text-[12px] font-mono">$1</code>')
}

// ── Quick prompts ─────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'Tôi nên làm gì trước hôm nay?',
  'Tasks nào đang quá hạn?',
  'Gợi ý cách sắp xếp công việc',
  'Tóm tắt tiến độ dự án',
]

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ReturnType<typeof useAIChat>['messages'][number] }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-2 items-end', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mb-0.5">
          <Bot size={13} className="text-white" />
        </div>
      )}
      <div className={cn(
        'max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
        isUser
          ? 'bg-indigo-600 text-white rounded-br-sm'
          : msg.error
          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-bl-sm'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm',
      )}>
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <>
            <div
              className="prose-sm [&_li]:my-0.5 [&_p]:my-0.5"
              dangerouslySetInnerHTML={{ __html: renderChat(msg.content) || '<span class="opacity-40">…</span>' }}
            />
            {msg.streaming && (
              <span className="inline-block w-1.5 h-3.5 bg-current rounded-sm ml-0.5 animate-pulse align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function AIChatPanel() {
  const { messages, loading, send, stop, clear } = useAIChat()
  const [open,   setOpen]   = useState(false)
  const [input,  setInput]  = useState('')
  const [showTip, setShowTip] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setShowTip(false)
    send(text)
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleQuick = (prompt: string) => {
    setShowTip(false)
    send(prompt)
  }

  return (
    <>
      {/* ── Mobile backdrop (tap to close) ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Panel ── */}
      {open && (
        <div className={cn(
          /* Mobile: above bottom-nav FABs */
          'fixed bottom-40 right-4 z-50',
          /* sm+: still above FAB but less offset needed (FAB moves to bottom-24) */
          'sm:bottom-40 sm:right-6',
          /* lg+: no bottom nav, FAB at bottom-6 so panel at bottom-24 */
          'lg:bottom-24 lg:right-6',
          'w-[calc(100vw-2rem)] sm:w-[380px]',
          'max-h-[55dvh] sm:max-h-[60dvh] lg:max-h-[75dvh]',
          'flex flex-col',
          'bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700',
          'panel-slide-up',
        )}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">AI Trợ lý</p>
              <p className="text-[10px] text-slate-400 mt-0.5">claude-haiku · TaskPro</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clear} title="Xoá hội thoại"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)} title="Thu nhỏ"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.length === 0 && showTip && (
              <div className="py-4 space-y-3">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-2">
                    <Sparkles size={22} className="text-indigo-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Xin chào! Tôi có thể giúp gì?</p>
                  <p className="text-xs text-slate-400 mt-0.5">Hỏi về tasks, deadline, hoặc lời khuyên năng suất</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_PROMPTS.map(q => (
                    <button key={q} onClick={() => handleQuick(q)}
                      className="text-left px-2.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors border border-slate-100 dark:border-slate-700 leading-tight">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-3 py-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Nhập tin nhắn… (Enter gửi)"
                className="flex-1 bg-transparent resize-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none max-h-28 leading-relaxed"
                style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
              />
              {loading ? (
                <button onClick={stop} title="Dừng"
                  className="shrink-0 p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button onClick={handleSend} disabled={!input.trim()} title="Gửi"
                  className="shrink-0 p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        onClick={() => setOpen(v => !v)}
        title="AI Trợ lý"
        className={cn(
          /* Mobile/tablet: above bottom nav */
          'fixed bottom-24 right-4 z-50',
          /* lg+: no bottom nav, standard position */
          'lg:bottom-6 lg:right-6',
          'w-14 h-14 rounded-full flex items-center justify-center shadow-xl',
          'transition-all duration-200 active:scale-90',
          open
            ? 'bg-slate-700 dark:bg-slate-600 hover:bg-slate-800 dark:hover:bg-slate-500 scale-95'
            : 'bg-gradient-to-br from-violet-500 to-indigo-600 hover:shadow-indigo-500/40 hover:shadow-2xl hover:scale-105',
        )}
      >
        {open
          ? <X size={22} className="text-white" />
          : <Bot size={22} className="text-white" />
        }
        {messages.length > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 text-[9px] font-bold text-white flex items-center justify-center">
            {messages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>
    </>
  )
}
