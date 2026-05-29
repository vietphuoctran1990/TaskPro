import type { Config } from '@netlify/functions'
import { CORS_HEADERS, optionsResponse } from '../lib/utils'

const MODEL      = 'gemini-2.0-flash'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  return key
}

function buildSystem(ctx: Record<string, unknown>): string {
  const today   = (ctx?.today as string) ?? new Date().toISOString().slice(0, 10)
  const lang    = ctx?.language === 'en' ? 'English' : 'Tiếng Việt'
  const tasks   = (ctx?.tasks   as Record<string, unknown>[]) ?? []
  const projs   = (ctx?.projects as Record<string, unknown>[]) ?? []
  const statuses = (ctx?.statuses as Record<string, unknown>[]) ?? []
  const notes   = (ctx?.notes   as Record<string, unknown>[]) ?? []
  const projMap = Object.fromEntries(projs.map(p => [p.id, p.name]))

  const taskLines = tasks.slice(0, 30).map(t =>
    `- [${t.status}|${t.priority}] ${t.title}${t.dueDate ? ` (hạn ${t.dueDate})` : ''}${t.projectId && projMap[t.projectId as string] ? ` / ${projMap[t.projectId as string]}` : ''}`
  ).join('\n') || '(chưa có task)'

  const noteLines = notes.slice(0, 10).map(n => `- "${n.title}"`).join('\n') || '(chưa có)'
  const statusNames = statuses.map(s => s.name || s.id).join(', ') || 'todo, in_progress, done'

  return `Bạn là AI trợ lý thông minh tích hợp trong ứng dụng quản lý công việc TaskPro. Trả lời bằng ${lang}, ngắn gọn và thực tế.

NGÀY HÔM NAY: ${today}
DỰ ÁN: ${projs.map(p => p.name).join(', ') || '(chưa có)'}
GIAI ĐOẠN: ${statusNames}
TASKS ĐANG CÓ:
${taskLines}
GHI CHÚ: ${noteLines}

NGUYÊN TẮC:
- Tham chiếu đúng tên task/dự án từ dữ liệu trên khi người dùng hỏi
- Gợi ý ưu tiên dựa trên deadline và mức độ ưu tiên thực tế
- Dùng markdown (bold, bullet) cho câu trả lời dài
- Giữ giọng thân thiện, chuyên nghiệp`
}

// ── Non-streaming helper ──────────────────────────────────────────────────────

async function generate(system: string, prompt: string, maxTokens = 512): Promise<string> {
  const res = await fetch(`${GEMINI_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: prompt },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

// ── Streaming chat ────────────────────────────────────────────────────────────

async function handleChat(body: Record<string, unknown>): Promise<Response> {
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? []
  const context  = (body.context  as Record<string, unknown>) ?? {}

  const res = await fetch(`${GEMINI_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: buildSystem(context) },
        ...messages,
      ],
    }),
  })

  if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}`)

  const enc    = new TextEncoder()
  const reader = res.body.getReader()
  const dec    = new TextDecoder()

  const readable = new ReadableStream({
    async start(ctrl) {
      let buf = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const parts = buf.split('\n')
          buf = parts.pop() ?? ''
          for (const line of parts) {
            const stripped = line.replace(/^data:\s*/, '').trim()
            if (!stripped || stripped === '[DONE]') continue
            try {
              const j = JSON.parse(stripped) as { choices: Array<{ delta: { content?: string } }> }
              const text = j.choices?.[0]?.delta?.content
              if (text) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ text })}\n\n`))
            } catch { /* non-JSON line */ }
          }
        }
        ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      } finally {
        ctrl.close()
        reader.releaseLock()
      }
    },
    cancel() { reader.cancel() },
  })

  return new Response(readable, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ── Daily Briefing ────────────────────────────────────────────────────────────

async function handleBriefing(body: Record<string, unknown>): Promise<Response> {
  const ctx    = (body.context as Record<string, unknown>) ?? {}
  const today  = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)
  const tasks  = (ctx.tasks  as Record<string, unknown>[]) ?? []

  const todayList  = tasks.filter(t => t.dueDate === today)
  const overdue    = tasks.filter(t => t.dueDate && (t.dueDate as string) < today && t.status !== 'done')
  const highPrio   = tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'done')
  const inProgress = tasks.filter(t => t.status === 'in_progress')

  const prompt = `Hôm nay ${today}.
Tasks hôm nay (${todayList.length}): ${todayList.map(t => t.title).join(', ') || 'không có'}
Quá hạn (${overdue.length}): ${overdue.map(t => t.title).join(', ') || 'không có'}
Đang làm (${inProgress.length}): ${inProgress.slice(0,5).map(t => t.title).join(', ') || 'không có'}
Ưu tiên cao (${highPrio.length}): ${highPrio.slice(0,5).map(t => t.title).join(', ') || 'không có'}

Viết briefing buổi sáng ngắn gọn (~120 từ):
1. Tóm tắt nhanh bức tranh hôm nay (1-2 câu)
2. **3 việc nên làm trước** (bullet, kèm lý do ngắn)
3. Lời động viên ngắn cuối

Dùng markdown. Thân thiện, tích cực.`

  const content = await generate(buildSystem(ctx), prompt, 512)
  return new Response(JSON.stringify({ content }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Priority Insights ─────────────────────────────────────────────────────────

async function handlePriorities(body: Record<string, unknown>): Promise<Response> {
  const ctx   = (body.context as Record<string, unknown>) ?? {}
  const today = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)
  const tasks = ((ctx.tasks as Record<string, unknown>[]) ?? [])
    .filter(t => t.status !== 'done').slice(0, 15)

  const list = tasks.map((t, i) =>
    `${i+1}. [${t.priority}] "${t.title}"${t.dueDate ? `, hạn: ${t.dueDate}` : ''}${t.projectName ? `, proj: ${t.projectName}` : ''}`
  ).join('\n') || '(không có task nào)'

  const prompt = `Hôm nay: ${today}
Tasks đang có:
${list}

Trả về JSON hợp lệ (không markdown xung quanh JSON):
{
  "topTasks": [{"title":"...","reason":"..."}],
  "warnings": ["..."],
  "tip": "..."
}
topTasks: tối đa 5 tasks cần làm trước nhất, lý do ngắn (1 câu)
warnings: tối đa 3 cảnh báo (quá hạn, deadline gần...)
tip: 1 mẹo productivity hôm nay`

  const text = await generate(buildSystem(ctx), prompt, 600)
  let parsed: Record<string, unknown> = { topTasks: [], warnings: [], tip: '' }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { ...parsed, ...(JSON.parse(m[0]) as Record<string, unknown>) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Smart Fill ────────────────────────────────────────────────────────────────

async function handleSmartFill(body: Record<string, unknown>): Promise<Response> {
  const title = (body.title as string) ?? ''
  const ctx   = (body.context as Record<string, unknown>) ?? {}

  const prompt = `Task title: "${title}"

Gợi ý thông tin cho task này. JSON hợp lệ (không markdown):
{
  "description": "mô tả ngắn 1-2 câu thực tế",
  "priority": "urgent|high|medium|low",
  "estimatedHours": số_giờ_hoặc_null,
  "subtasks": ["subtask 1", "subtask 2"]
}
subtasks: tối đa 4 items, chỉ khi task đủ phức tạp`

  const text = await generate(buildSystem(ctx), prompt, 256)
  let parsed: Record<string, unknown> = { description: '', priority: 'medium', estimatedHours: null, subtasks: [] }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { ...parsed, ...(JSON.parse(m[0]) as Record<string, unknown>) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Suggest Deadline ──────────────────────────────────────────────────────────

async function handleSuggestDeadline(body: Record<string, unknown>): Promise<Response> {
  const title          = (body.title as string) ?? ''
  const priority       = (body.priority as string) ?? 'medium'
  const estimatedHours = (body.estimatedHours as number | null) ?? null
  const activeTasks    = (body.activeTasks as Array<{ title: string; dueDate: string | null }>) ?? []
  const today          = new Date().toISOString().slice(0, 10)

  const taskList = activeTasks.slice(0, 15).map(t => `- "${t.title}" (hạn: ${t.dueDate ?? 'chưa có'})`).join('\n')

  const prompt = `Hôm nay: ${today}
Task cần gợi ý deadline: "${title}"
Mức độ ưu tiên: ${priority}
Ước tính giờ: ${estimatedHours ?? 'chưa biết'}
Các task đang có:
${taskList || '(trống)'}

Gợi ý ngày deadline phù hợp. JSON hợp lệ (không markdown):
{"date": "YYYY-MM-DD", "reason": "lý do ngắn 1 câu"}`

  const text = await generate('Bạn là trợ lý lập kế hoạch thông minh.', prompt, 128)
  let parsed: Record<string, unknown> = { date: '', reason: '' }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { ...parsed, ...(JSON.parse(m[0]) as Record<string, unknown>) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Summarize Note ────────────────────────────────────────────────────────────

async function handleSummarizeNote(body: Record<string, unknown>): Promise<Response> {
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''

  const prompt = `Ghi chú: "${title}"
${content}

Tóm tắt thành bullet points ngắn gọn (tối đa 5 bullet). Giữ ý chính quan trọng nhất.`

  const summary = await generate('Bạn là trợ lý tóm tắt văn bản.', prompt, 300)
  return new Response(JSON.stringify({ summary }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Extract Tasks from Note ───────────────────────────────────────────────────

async function handleExtractTasks(body: Record<string, unknown>): Promise<Response> {
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''
  const ctx     = (body.context as Record<string, unknown>) ?? {}
  const today   = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)

  const prompt = `Hôm nay: ${today}
Ghi chú: "${title}"
${content}

Trích xuất action items thành danh sách task. JSON hợp lệ (không markdown):
{"tasks": [{"title": "...", "priority": "urgent|high|medium|low", "dueDate": "YYYY-MM-DD hoặc null"}]}
Chỉ trích xuất các việc cần làm rõ ràng. Tối đa 8 tasks.`

  const text = await generate(buildSystem(ctx), prompt, 512)
  let parsed: Record<string, unknown> = { tasks: [] }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { ...parsed, ...(JSON.parse(m[0]) as Record<string, unknown>) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Expand Note ───────────────────────────────────────────────────────────────

async function handleExpandNote(body: Record<string, unknown>): Promise<Response> {
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''

  const prompt = `Ghi chú gốc: "${title}"
${content}

Viết mở rộng thành bài viết hoàn chỉnh, giữ ý tưởng gốc nhưng phát triển thêm chi tiết, ví dụ, và cấu trúc rõ ràng hơn. Dùng markdown.`

  const expanded = await generate('Bạn là trợ lý viết văn chuyên nghiệp.', prompt, 800)
  return new Response(JSON.stringify({ expanded }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Decompose Project ─────────────────────────────────────────────────────────

async function handleDecomposeProject(body: Record<string, unknown>): Promise<Response> {
  const projectName = (body.projectName as string) ?? ''
  const description = (body.description as string) ?? ''
  const ctx         = (body.context as Record<string, unknown>) ?? {}

  const prompt = `Dự án: "${projectName}"
Mô tả: ${description || '(chưa có)'}

Phân tích và tạo danh sách tasks cho dự án này. JSON hợp lệ (không markdown):
{
  "tasks": [
    {"title": "...", "priority": "urgent|high|medium|low", "estimatedHours": số_hoặc_null, "subtasks": ["..."]}
  ]
}
Tạo 5-12 tasks có tính thực tế, bao gồm cả planning, execution và review. Subtasks chỉ khi cần (tối đa 4 per task).`

  const text = await generate(buildSystem(ctx), prompt, 1024)
  let parsed: Record<string, unknown> = { tasks: [] }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { ...parsed, ...(JSON.parse(m[0]) as Record<string, unknown>) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Weekly Review ─────────────────────────────────────────────────────────────

async function handleWeeklyReview(body: Record<string, unknown>): Promise<Response> {
  const ctx   = (body.context as Record<string, unknown>) ?? {}
  const tasks = (ctx.tasks as Record<string, unknown>[]) ?? []
  const today = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)

  const weekAgo = new Date(new Date(today).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const done    = tasks.filter(t => t.status === 'done' && t.updatedAt && (t.updatedAt as string) >= weekAgo)
  const pending = tasks.filter(t => t.status !== 'done' && t.dueDate && (t.dueDate as string) <= today)
  const upcoming = tasks.filter(t => t.status !== 'done' && t.dueDate && (t.dueDate as string) > today)

  const prompt = `Tuần vừa qua (${weekAgo} → ${today}):
Hoàn thành (${done.length}): ${done.slice(0,8).map(t => t.title).join(', ') || 'không có'}
Quá hạn (${pending.length}): ${pending.slice(0,5).map(t => t.title).join(', ') || 'không có'}
Sắp đến (${upcoming.length}): ${upcoming.slice(0,5).map(t => t.title).join(', ') || 'không có'}

Viết báo cáo review tuần (~150 từ):
1. Thành tích nổi bật
2. Điểm cần cải thiện
3. Kế hoạch tuần tới (3 ưu tiên)

Dùng markdown, thân thiện.`

  const content = await generate(buildSystem(ctx), prompt, 600)
  return new Response(JSON.stringify({ content }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })

  if (!process.env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    switch (body.type as string) {
      case 'chat':             return handleChat(body)
      case 'briefing':         return handleBriefing(body)
      case 'priorities':       return handlePriorities(body)
      case 'smartfill':        return handleSmartFill(body)
      case 'suggest-deadline': return handleSuggestDeadline(body)
      case 'summarize-note':   return handleSummarizeNote(body)
      case 'extract-tasks':    return handleExtractTasks(body)
      case 'expand-note':      return handleExpandNote(body)
      case 'decompose-project':return handleDecomposeProject(body)
      case 'weekly-review':    return handleWeeklyReview(body)
      default:
        return new Response('Unknown type', { status: 400, headers: CORS_HEADERS })
    }
  } catch (err) {
    console.error('[ai-chat]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}

export const config: Config = { path: '/api/ai-chat' }
