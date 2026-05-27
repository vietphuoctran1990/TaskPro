import { GoogleGenAI } from '@google/genai'
import type { Config } from '@netlify/functions'
import { CORS_HEADERS, optionsResponse } from '../lib/utils'

const MODEL = 'gemini-3.5-flash'

function getClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  return new GoogleGenAI({ apiKey: key })
}

// Convert Anthropic-style messages to Gemini contents format
function toGeminiContents(messages: Array<{ role: string; content: string }>) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

function buildSystem(ctx: Record<string, unknown>): string {
  const today    = (ctx?.today as string) ?? new Date().toISOString().slice(0, 10)
  const lang     = ctx?.language === 'en' ? 'English' : 'Tiếng Việt'
  const tasks    = (ctx?.tasks    as Record<string, unknown>[]) ?? []
  const projs    = (ctx?.projects as Record<string, unknown>[]) ?? []
  const statuses = (ctx?.statuses as Record<string, unknown>[]) ?? []
  const notes    = (ctx?.notes    as Record<string, unknown>[]) ?? []
  const finalIds = new Set((ctx?.finalStatusIds as string[] | undefined) ?? ['done'])

  const statusLabel: Record<string, string> = {}
  for (const s of statuses) statusLabel[s.id as string] = s.name as string || s.id as string

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const activeTasks = tasks.filter(t => !(t.isDone === true || finalIds.has(t.status as string)))
  const doneTasks   = tasks.filter(t =>   t.isDone === true || finalIds.has(t.status as string))

  function formatTask(t: Record<string, unknown>): string {
    const done    = t.isDone === true || finalIds.has(t.status as string)
    const label   = done ? 'HOÀN THÀNH' : ((t.statusLabel as string) || statusLabel[t.status as string] || t.status as string)
    const overdue = !done && t.dueDate && (t.dueDate as string) < today ? ' [QUÁ HẠN]' : ''
    const time    = t.dueTime ? ` lúc ${t.dueTime}` : ''
    const est     = t.estimatedHours ? ` ước ${t.estimatedHours}h` : ''
    const proj    = t.projectName ? ` | Dự án: ${t.projectName}` : ''

    const lines = [
      `• Tên: ${t.title as string}`,
      `  Trạng thái: ${label}${overdue} | Ưu tiên: ${t.priority as string}${est}`,
    ]
    if (t.dueDate) lines.push(`  Deadline: ${t.dueDate as string}${time}`)
    if (proj) lines.push(`  ${proj.trim()}`)
    if (t.description) lines.push(`  Mô tả: ${t.description as string}`)
    if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
      lines.push(`  Subtasks:`)
      for (const s of t.subtasks as Array<{ title: string; done: boolean }>) {
        lines.push(`    ${s.done ? '[x]' : '[ ]'} ${s.title}`)
      }
    }
    if (Array.isArray(t.comments) && t.comments.length > 0) {
      lines.push(`  Bình luận gần nhất:`)
      for (const c of t.comments as Array<{ text: string; at: string }>) {
        lines.push(`    [${c.at}] ${c.text}`)
      }
    }
    return lines.join('\n')
  }

  const activeSection = activeTasks.length > 0
    ? activeTasks.map(formatTask).join('\n\n')
    : '  (không có task đang chạy)'

  const doneSection = doneTasks.length > 0
    ? doneTasks.map(t => `• [XONG] ${t.title as string}${t.projectName ? ` | ${t.projectName}` : ''}`).join('\n')
    : ''

  const statusList = statuses.map(s =>
    `${s.name as string}${s.isFinal ? ' (trạng thái hoàn thành)' : ''}`
  ).join(', ')

  // ── Notes ──────────────────────────────────────────────────────────────────
  const noteBlocks = notes.map((n, i) => {
    const pin    = n.pinned ? '[GHI CHÚ ĐÃ GHIM] ' : ''
    const folder = n.folder ? ` | Thư mục: ${n.folder as string}` : ''
    const body   = (n.content as string).trim() || '(trống)'
    return [
      `--- Ghi chú ${i + 1}: "${n.title as string}"${folder} | Cập nhật: ${n.updatedAt as string} ${pin}`,
      body,
    ].join('\n')
  }).join('\n\n')

  const noteSection = notes.length > 0
    ? `\n\n============================\nGHI CHÚ CỦA NGƯỜI DÙNG (${notes.length} ghi chú)\n============================\n${noteBlocks}`
    : '\n\nGHI CHÚ: (chưa có ghi chú nào)'

  return `Bạn là Gemini AI trợ lý được nhúng vào ứng dụng quản lý công việc TaskPro.
Ngôn ngữ trả lời: ${lang}.

QUAN TRỌNG: Dữ liệu thực tế của người dùng được cung cấp đầy đủ bên dưới. Hãy đọc kỹ và tham chiếu CHÍNH XÁC tên task, dự án, ghi chú khi trả lời. KHÔNG được bịa đặt thông tin.

============================
DỮ LIỆU THỰC TẾ CỦA NGƯỜI DÙNG
============================
Ngày hôm nay: ${today}
Dự án: ${projs.map(p => p.name).join(', ') || '(chưa có dự án)'}
Các trạng thái: ${statusList || '(mặc định)'}

============================
CÔNG VIỆC ĐANG TIẾN HÀNH (${activeTasks.length} tasks)
============================
${activeSection}
${doneSection ? `\n============================\nCÔNG VIỆC ĐÃ HOÀN THÀNH (${doneTasks.length} tasks)\n============================\n${doneSection}` : ''}${noteSection}

============================
QUY TẮC TRẢ LỜI
============================
- Task có trạng thái "HOÀN THÀNH" là đã xong — KHÔNG kể vào danh sách cần làm
- Task "[QUÁ HẠN]" là trễ deadline — ưu tiên nhắc nhở cao nhất
- Chỉ tham chiếu task/ghi chú/dự án có trong dữ liệu trên, không bịa thêm
- Khi hỏi về ghi chú, đọc và trích dẫn nội dung ghi chú từ phần "GHI CHÚ" phía trên
- Khi hỏi về subtask hay comment, trích dẫn chính xác từ dữ liệu task
- Dùng markdown (in đậm, bullet list) cho câu trả lời có cấu trúc
- Giọng văn thân thiện, thực tế, không dài dòng`
}

// ── Shared helper for non-streaming requests ──────────────────────────────

async function generate(
  ai: GoogleGenAI,
  system: string,
  prompt: string,
  maxOutputTokens: number,
): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction: system, maxOutputTokens },
  })
  const text = response.text
    ?? response.candidates?.[0]?.content?.parts?.[0]?.text
    ?? ''
  if (!text) console.warn('[ai-chat] empty response from model', JSON.stringify(response).slice(0, 300))
  return text
}

// ── Streaming chat ────────────────────────────────────────────────────────────

async function handleChat(body: Record<string, unknown>): Promise<Response> {
  const ai       = getClient()
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? []
  const context  = (body.context  as Record<string, unknown>) ?? {}
  const system   = buildSystem(context)

  const contents = toGeminiContents(messages)

  const stream = await ai.models.generateContentStream({
    model: MODEL,
    contents,
    config: { systemInstruction: system, maxOutputTokens: 2048 },
  })

  const enc = new TextEncoder()
  const readable = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text ?? chunk.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
        ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[ai-chat] stream error', err)
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
      } finally {
        ctrl.close()
      }
    },
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
  const ai       = getClient()
  const ctx      = (body.context as Record<string, unknown>) ?? {}
  const today    = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)
  const tasks    = (ctx.tasks  as Record<string, unknown>[]) ?? []
  const finalIds = new Set((ctx.finalStatusIds as string[] | undefined) ?? ['done'])

  const isTaskDone = (t: Record<string, unknown>) =>
    t.isDone === true || finalIds.has(t.status as string)

  const active    = tasks.filter(t => !isTaskDone(t))
  const todayList = active.filter(t => t.dueDate === today)
  const overdue   = active.filter(t => t.dueDate && (t.dueDate as string) < today)
  const highPrio  = active.filter(t => t.priority === 'urgent' || t.priority === 'high')
  const doneToday = tasks.filter(t => isTaskDone(t) && t.dueDate === today)

  const prompt = `Hôm nay ${today}.
Tasks hôm nay (${todayList.length}): ${todayList.map(t => t.title).join(', ') || 'không có'}
Quá hạn (${overdue.length}): ${overdue.map(t => t.title).join(', ') || 'không có'}
Đang hoạt động (${active.length} tổng): ${active.slice(0, 5).map(t => `${t.title} [${t.statusLabel ?? t.status}]`).join(', ') || 'không có'}
Đã hoàn thành hôm nay (${doneToday.length}): ${doneToday.map(t => t.title).join(', ') || 'không có'}
Ưu tiên cao/khẩn (${highPrio.length}): ${highPrio.slice(0, 5).map(t => t.title).join(', ') || 'không có'}

Viết briefing buổi sáng ngắn gọn (~120 từ):
1. Tóm tắt nhanh bức tranh hôm nay (1-2 câu)
2. **3 việc nên làm trước** (bullet, kèm lý do ngắn)
3. Lời động viên ngắn cuối

Dùng markdown. Thân thiện, tích cực.`

  const content = await generate(ai, buildSystem(ctx), prompt, 512)
  return new Response(JSON.stringify({ content }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Priority Insights ─────────────────────────────────────────────────────────

async function handlePriorities(body: Record<string, unknown>): Promise<Response> {
  const ai       = getClient()
  const ctx      = (body.context as Record<string, unknown>) ?? {}
  const today    = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)
  const finalIds = new Set((ctx.finalStatusIds as string[] | undefined) ?? ['done'])
  const tasks    = ((ctx.tasks as Record<string, unknown>[]) ?? [])
    .filter(t => !(t.isDone === true || finalIds.has(t.status as string))).slice(0, 15)

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
warnings: tối đa 3 cảnh báo (quá hạn, deadline gần, tasks bị block...)
tip: 1 mẹo productivity hôm nay`

  const text = await generate(ai, buildSystem(ctx), prompt, 600)
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
  const ai    = getClient()
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
subtasks: tối đa 4 items, chỉ khi cần thiết (task đủ phức tạp)`

  const text = await generate(ai, buildSystem(ctx), prompt, 256)
  let parsed: Record<string, unknown> = { description: '', priority: 'medium', estimatedHours: null, subtasks: [] }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { ...parsed, ...(JSON.parse(m[0]) as Record<string, unknown>) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Note: Summarize ───────────────────────────────────────────────────────────

async function handleSummarizeNote(body: Record<string, unknown>): Promise<Response> {
  const ai      = getClient()
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''
  const ctx     = (body.context as Record<string, unknown>) ?? {}

  const safeContent = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[ảnh]')
  const prompt = `Ghi chú: "${title}"

${safeContent}

---
Tóm tắt ghi chú trên thành 3-5 bullet points ngắn gọn, súc tích. Chỉ trả về bullet list, không thêm gì khác.`

  const summary = await generate(ai, buildSystem(ctx), prompt, 300)
  return new Response(JSON.stringify({ summary }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Note: Extract Tasks ───────────────────────────────────────────────────────

async function handleExtractTasks(body: Record<string, unknown>): Promise<Response> {
  const ai      = getClient()
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''
  const ctx     = (body.context as Record<string, unknown>) ?? {}

  const safeContent = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[ảnh]')
  const prompt = `Ghi chú: "${title}"

${safeContent}

---
Phân tích ghi chú và trích xuất danh sách action items / công việc cần làm.
Trả về JSON hợp lệ (không markdown):
{
  "tasks": [
    {"title": "...", "priority": "urgent|high|medium|low", "dueDate": "YYYY-MM-DD hoặc null"}
  ]
}
Tối đa 8 tasks. Chỉ lấy việc rõ ràng cần làm, không lấy thông tin thuần túy.`

  const text = await generate(ai, buildSystem(ctx), prompt, 400)
  let parsed: { tasks: Array<{ title: string; priority: string; dueDate: string | null }> } = { tasks: [] }
  try {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) parsed = { tasks: [], ...(JSON.parse(m[0]) as typeof parsed) }
  } catch { /* keep default */ }

  return new Response(JSON.stringify(parsed), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Note: Expand / Rewrite ────────────────────────────────────────────────────

async function handleExpandNote(body: Record<string, unknown>): Promise<Response> {
  const ai      = getClient()
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''
  const ctx     = (body.context as Record<string, unknown>) ?? {}

  const safeContent = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[ảnh]')
  const prompt = `Ghi chú gốc: "${title}"

${safeContent}

---
Dựa trên ý tưởng/ghi chú trên, viết mở rộng thành văn bản đầy đủ, có cấu trúc dùng markdown (tiêu đề, bullet, in đậm khi cần). Giữ nguyên ý chính, phát triển thêm chi tiết thực tế. Không thêm lời mở đầu hay kết luận chung chung.`

  const expanded = await generate(ai, buildSystem(ctx), prompt, 800)
  return new Response(JSON.stringify({ expanded }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Weekly Review ─────────────────────────────────────────────────────────────

async function handleWeeklyReview(body: Record<string, unknown>): Promise<Response> {
  const ai       = getClient()
  const ctx      = (body.context as Record<string, unknown>) ?? {}
  const today    = (ctx.today as string) ?? new Date().toISOString().slice(0, 10)
  const finalIds = new Set((ctx.finalStatusIds as string[] | undefined) ?? ['done'])
  const tasks    = (ctx.tasks as Record<string, unknown>[]) ?? []

  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  const isTaskDone   = (t: Record<string, unknown>) => t.isDone === true || finalIds.has(t.status as string)
  const completedThisWeek = tasks.filter(t => isTaskDone(t) && (t.updatedAt as string)?.slice(0, 10) >= weekAgoStr)
  const active            = tasks.filter(t => !isTaskDone(t))
  const overdueActive     = active.filter(t => t.dueDate && (t.dueDate as string) < today)
  const dueNextWeek       = active.filter(t => t.dueDate && (t.dueDate as string) >= today && (t.dueDate as string) <= new Date(new Date(today).getTime() + 7*86400000).toISOString().slice(0, 10))
  const urgentActive      = active.filter(t => t.priority === 'urgent' || t.priority === 'high')

  const prompt = `Hôm nay: ${today}. Tuần bắt đầu từ ${weekAgoStr}.

Đã hoàn thành trong tuần (${completedThisWeek.length}): ${completedThisWeek.slice(0, 10).map(t => t.title).join(', ') || 'không có'}
Đang còn active (${active.length}): ${active.slice(0, 8).map(t => `${t.title} [${t.statusLabel ?? t.status}]`).join(', ') || 'không có'}
Quá hạn (${overdueActive.length}): ${overdueActive.slice(0, 5).map(t => t.title).join(', ') || 'không có'}
Deadline 7 ngày tới (${dueNextWeek.length}): ${dueNextWeek.slice(0, 6).map(t => `${t.title} (${t.dueDate})`).join(', ') || 'không có'}
Ưu tiên cao/khẩn (${urgentActive.length}): ${urgentActive.slice(0, 5).map(t => t.title).join(', ') || 'không có'}

Viết Weekly Review (~180 từ) gồm:
1. **Tóm tắt tuần** — thành tựu nổi bật, số task hoàn thành
2. **Điểm cần chú ý** — quá hạn, rủi ro, task bị trì hoãn
3. **Ưu tiên tuần tới** — top 3 việc cần tập trung, có lý do
4. **Nhận xét** — 1 câu động viên/gợi ý cải thiện

Dùng markdown, xưng "bạn", thân thiện chuyên nghiệp.`

  const content = await generate(ai, buildSystem(ctx), prompt, 600)
  return new Response(JSON.stringify({ content }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Suggest Deadline ──────────────────────────────────────────────────────────

async function handleSuggestDeadline(body: Record<string, unknown>): Promise<Response> {
  const ai       = getClient()
  const today    = new Date().toISOString().slice(0, 10)
  const title    = (body.title as string) ?? ''
  const priority = (body.priority as string) ?? 'medium'
  const estHours = (body.estimatedHours as number | null) ?? null
  const tasks    = (body.activeTasks as { dueDate?: string; title: string }[]) ?? []

  const busyDays: Record<string, number> = {}
  tasks.forEach(t => { if (t.dueDate) busyDays[t.dueDate] = (busyDays[t.dueDate] ?? 0) + 1 })
  const busySummary = Object.entries(busyDays).sort(([a], [b]) => a.localeCompare(b)).slice(0, 7)
    .map(([d, n]) => `${d}: ${n} task`).join(', ') || 'không có task'

  const prompt = `Hôm nay: ${today}
Task cần xác định deadline: "${title}"
Mức ưu tiên: ${priority}
Giờ ước tính: ${estHours ?? 'chưa xác định'}
Các ngày đang bận: ${busySummary}

Đề xuất deadline hợp lý cho task này, cân nhắc:
- Độ ưu tiên (urgent=1-2 ngày, high=3-5 ngày, medium=1-2 tuần, low=2-4 tuần)
- Thời gian ước tính
- Tải công việc hiện tại

Trả về JSON hợp lệ (không markdown):
{"date": "YYYY-MM-DD", "reason": "Lý do ngắn gọn (1 câu)"}`

  const content = await generate(ai, '', prompt, 256)
  try {
    const clean = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(clean)
    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch {
    const match = content.match(/\d{4}-\d{2}-\d{2}/)
    return new Response(JSON.stringify({ date: match?.[0] ?? null, reason: content.slice(0, 100) }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}

// ── Decompose Project ─────────────────────────────────────────────────────────

async function handleDecomposeProject(body: Record<string, unknown>): Promise<Response> {
  const ai    = getClient()
  const goal  = (body.goal as string) ?? ''
  const today = new Date().toISOString().slice(0, 10)

  const prompt = `Hôm nay: ${today}
Mục tiêu dự án: "${goal}"

Phân tích và tạo kế hoạch thực hiện dự án. Trả về JSON hợp lệ (không markdown):
{
  "projectName": "Tên dự án ngắn gọn",
  "description": "Mô tả 1-2 câu",
  "tasks": [
    {
      "title": "Tiêu đề công việc",
      "description": "Mô tả ngắn",
      "priority": "low|medium|high|urgent",
      "estimatedHours": số,
      "daysFromNow": số ngày từ hôm nay để làm deadline
    }
  ]
}

Tạo 5-10 task thực tế, có thứ tự logic, ưu tiên phù hợp. Tasks phải cụ thể, có thể thực hiện được.`

  const content = await generate(ai, '', prompt, 1200)
  try {
    const clean = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(clean)
    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Could not parse AI response', raw: content }), {
      status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
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
    const type = body.type as string

    if (type === 'chat')           return handleChat(body)
    if (type === 'briefing')       return handleBriefing(body)
    if (type === 'priorities')     return handlePriorities(body)
    if (type === 'smartfill')      return handleSmartFill(body)
    if (type === 'summarize-note') return handleSummarizeNote(body)
    if (type === 'extract-tasks')  return handleExtractTasks(body)
    if (type === 'expand-note')    return handleExpandNote(body)
    if (type === 'weekly-review')        return handleWeeklyReview(body)
    if (type === 'suggest-deadline')     return handleSuggestDeadline(body)
    if (type === 'decompose-project')    return handleDecomposeProject(body)

    return new Response('Unknown type', { status: 400, headers: CORS_HEADERS })
  } catch (err) {
    console.error('[ai-chat]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}

export const config: Config = { path: '/api/ai-chat' }
