import type { Config } from '@netlify/functions'
import { CORS_HEADERS, optionsResponse } from '../lib/utils'

const MODEL    = 'deepseek-chat'
const API_URL  = 'https://api.deepseek.com/v1/chat/completions'

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY not configured')
  return key
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystem(ctx: Record<string, unknown>): string {
  const today    = (ctx?.today as string) ?? new Date().toISOString().slice(0, 10)
  const lang     = ctx?.language === 'en' ? 'English' : 'Tiếng Việt'
  const tasks    = (ctx?.tasks    as Record<string, unknown>[]) ?? []
  const projs    = (ctx?.projects as Record<string, unknown>[]) ?? []
  const statuses = (ctx?.statuses as Record<string, unknown>[]) ?? []
  const labels   = (ctx?.labels   as Record<string, unknown>[]) ?? []
  const notes    = (ctx?.notes    as Record<string, unknown>[]) ?? []
  const folders  = (ctx?.noteFolders as Record<string, unknown>[]) ?? []
  const finalIds = new Set((ctx?.finalStatusIds as string[] | undefined) ?? ['done'])

  const activeTasks = tasks.filter(t => !finalIds.has(t.status as string))
  const doneTasks   = tasks.filter(t =>  finalIds.has(t.status as string))

  function fmtTask(t: Record<string, unknown>): string {
    const done    = finalIds.has(t.status as string)
    const label   = done ? 'HOÀN THÀNH' : ((t.statusLabel as string) || (t.status as string))
    const overdue = !done && t.dueDate && (t.dueDate as string) < today ? ' ⚠️ QUÁ HẠN' : ''
    const lines   = [`• [${label}${overdue}] ${t.title as string} (ưu tiên: ${t.priority})`]
    if (t.dueDate) lines.push(`  Deadline: ${t.dueDate}${t.dueTime ? ` lúc ${t.dueTime}` : ''}`)
    if (t.projectName) lines.push(`  Dự án: ${t.projectName}`)
    if (t.estimatedHours) lines.push(`  Ước tính: ${t.estimatedHours}h`)
    if (t.description) lines.push(`  Mô tả: ${(t.description as string).slice(0, 200)}`)
    if (Array.isArray(t.labels) && t.labels.length > 0)
      lines.push(`  Nhãn: ${(t.labels as string[]).join(', ')}`)
    if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
      const subs = t.subtasks as Array<{ title: string; done: boolean }>
      const done_ = subs.filter(s => s.done).length
      lines.push(`  Subtasks: ${done_}/${subs.length} xong`)
      subs.forEach(s => lines.push(`    ${s.done ? '[x]' : '[ ]'} ${s.title}`))
    }
    if (Array.isArray(t.comments) && t.comments.length > 0) {
      const cs = t.comments as Array<{ text: string; at: string }>
      lines.push(`  Bình luận (${cs.length}):`)
      cs.slice(-3).forEach(c => lines.push(`    [${c.at}] ${c.text}`))
    }
    return lines.join('\n')
  }

  const statusList = statuses.map(s =>
    `  • ${s.name as string}${s.isFinal ? ' (trạng thái hoàn thành)' : ''}`
  ).join('\n')

  const labelList = labels.length > 0
    ? labels.map(l => (l.name as string)).join(', ')
    : '(chưa có nhãn)'

  const projList = projs.length > 0
    ? projs.map(p => `  • ${p.name as string}${p.description ? `: ${p.description}` : ''} (${p.taskCount} tasks)`).join('\n')
    : '  (chưa có dự án)'

  const activeSection = activeTasks.length > 0
    ? activeTasks.map(fmtTask).join('\n\n')
    : '  (không có công việc đang tiến hành)'

  const doneSection = doneTasks.length > 0
    ? doneTasks.map(t => `  • [XONG] ${t.title as string}${t.projectName ? ` | ${t.projectName}` : ''}`).join('\n')
    : ''

  const noteSection = notes.length > 0
    ? notes.map((n, i) => {
        const pin = n.pinned ? ' 📌' : ''
        const folder = n.folder ? ` [${n.folder}]` : ''
        const content = (n.content as string).trim()
        return `--- Ghi chú ${i + 1}${pin}: "${n.title}"${folder} (cập nhật: ${n.updatedAt})\n${content || '(trống)'}`
      }).join('\n\n')
    : '(chưa có ghi chú)'

  const folderSection = folders.length > 0
    ? folders.map(f => `  • ${f.name}`).join('\n')
    : '  (chưa có thư mục)'

  return `Bạn là AI trợ lý thông minh tích hợp trong ứng dụng quản lý công việc TaskPro.
Ngôn ngữ trả lời: ${lang}.
Model: DeepSeek Chat.

QUAN TRỌNG: Toàn bộ dữ liệu thực tế của người dùng được cung cấp bên dưới. Hãy đọc kỹ và tham chiếu CHÍNH XÁC khi trả lời. KHÔNG được bịa đặt thông tin.

============================
DỮ LIỆU THỰC TẾ
============================
Ngày hôm nay: ${today}

--- CÁC TRẠNG THÁI (${statuses.length}) ---
${statusList || '  (mặc định)'}

--- DỰ ÁN (${projs.length}) ---
${projList}

--- NHÃN ---
${labelList}

--- THƯ MỤC GHI CHÚ ---
${folderSection}

============================
CÔNG VIỆC ĐANG TIẾN HÀNH (${activeTasks.length} tasks)
============================
${activeSection}
${doneSection ? `\n============================\nĐÃ HOÀN THÀNH (${doneTasks.length} tasks)\n============================\n${doneSection}` : ''}

============================
GHI CHÚ (${notes.length} ghi chú)
============================
${noteSection}

============================
QUY TẮC TRẢ LỜI
============================
- Tham chiếu ĐÚNG tên task/ghi chú/dự án từ dữ liệu trên
- Task trạng thái hoàn thành KHÔNG kể vào danh sách cần làm
- Task ⚠️ QUÁ HẠN cần được ưu tiên nhắc nhở cao nhất
- Khi hỏi về ghi chú: trích dẫn nội dung ghi chú từ dữ liệu trên
- Dùng markdown (in đậm, bullet list) cho câu trả lời có cấu trúc
- Giọng văn thân thiện, thực tế, không dài dòng`
}

// ── Non-streaming helper ──────────────────────────────────────────────────────

async function generate(system: string, prompt: string, maxTokens: number): Promise<string> {
  const key = getApiKey()
  const messages: Array<{ role: string; content: string }> = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, stream: false }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek API ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

// ── Streaming chat ────────────────────────────────────────────────────────────

async function handleChat(body: Record<string, unknown>): Promise<Response> {
  const key      = getApiKey()
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? []
  const context  = (body.context  as Record<string, unknown>) ?? {}
  const system   = buildSystem(context)

  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 2048,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: `DeepSeek error ${res.status}: ${err.slice(0, 200)}` }), {
      status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const enc      = new TextEncoder()
  const readable = new ReadableStream({
    async start(ctrl) {
      const reader = res.body!.getReader()
      const dec    = new TextDecoder()
      let   buf    = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') {
              ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
              ctrl.close()
              return
            }
            try {
              const chunk = JSON.parse(raw) as { choices: Array<{ delta: { content?: string } }> }
              const text  = chunk.choices?.[0]?.delta?.content
              if (text) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ text })}\n\n`))
            } catch { /* skip malformed */ }
          }
        }
        ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      } catch (err) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
      } finally {
        ctrl.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ── Priority Insights (JSON) ──────────────────────────────────────────────────

async function handlePriorities(body: Record<string, unknown>): Promise<Response> {
  const ctx      = (body.context as Record<string, unknown>) ?? {}
  const today    = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)
  const finalIds = new Set((ctx.finalStatusIds as string[] | undefined) ?? ['done'])
  const tasks    = ((ctx.tasks as Record<string, unknown>[]) ?? [])
    .filter(t => !finalIds.has(t.status as string)).slice(0, 20)

  const list = tasks.map((t, i) =>
    `${i + 1}. [${t.priority}] "${t.title}"${t.dueDate ? `, hạn: ${t.dueDate}` : ''}${t.projectName ? `, dự án: ${t.projectName}` : ''}`
  ).join('\n') || '(không có task nào)'

  const prompt = `Hôm nay: ${today}\nTasks:\n${list}\n\nTrả về JSON (không markdown bao ngoài):\n{"topTasks":[{"title":"...","reason":"..."}],"warnings":["..."],"tip":"..."}\ntopTasks: tối đa 5, lý do ngắn. warnings: tối đa 3. tip: 1 mẹo.`

  const text   = await generate(buildSystem(ctx), prompt, 600)
  let parsed: Record<string, unknown> = { topTasks: [], warnings: [], tip: '' }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { ...parsed, ...(JSON.parse(m[0]) as Record<string, unknown>) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })

  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY chưa được cấu hình trên Netlify' }), {
      status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    const type = body.type as string

    if (type === 'chat')       return handleChat(body)
    if (type === 'priorities') return handlePriorities(body)

    return new Response('Unknown type', { status: 400, headers: CORS_HEADERS })
  } catch (err) {
    console.error('[ai-chat]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}

export const config: Config = { path: '/api/ai-chat' }
