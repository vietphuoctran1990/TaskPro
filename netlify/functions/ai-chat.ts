import Anthropic from '@anthropic-ai/sdk'
import type { Config } from '@netlify/functions'
import { CORS_HEADERS, optionsResponse } from '../lib/utils'

const MODEL = 'claude-haiku-4-5-20251001'

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey: key })
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
  for (const s of statuses) {
    statusLabel[s.id as string] = s.name as string || s.id as string
  }

  const taskLines = tasks.slice(0, 25).map(t => {
    const done    = t.isDone === true || finalIds.has(t.status as string)
    const label   = done ? '✅ Hoàn thành' : ((t.statusLabel as string) || statusLabel[t.status as string] || t.status as string)
    const overdue = !done && t.dueDate && (t.dueDate as string) < today ? ' ⚠️ QUÁ HẠN' : ''
    const desc    = t.description ? ` — ${t.description}` : ''
    return `- [${label}|${t.priority}] ${t.title}${t.dueDate ? ` (hạn ${t.dueDate}${overdue})` : ''}${t.projectName ? ` / ${t.projectName}` : ''}${desc}`
  }).join('\n') || '(chưa có task)'

  const statusInfo = statuses.length > 0
    ? `\nCÁC TRẠNG THÁI: ${statuses.map(s => `${s.name as string}${s.isFinal ? ' [hoàn thành]' : ''}`).join(', ')}`
    : ''

  const noteLines = notes.slice(0, 10).map(n => {
    const pin    = n.pinned ? '📌 ' : ''
    const folder = n.folder ? ` [${n.folder as string}]` : ''
    const snip   = n.snippet ? `: ${(n.snippet as string).slice(0, 150)}` : ''
    return `- ${pin}"${n.title as string}"${folder} (${n.updatedAt as string})${snip}`
  }).join('\n')

  const noteSection = notes.length > 0
    ? `\nGHI CHÚ (${notes.length}):\n${noteLines}`
    : ''

  return `Bạn là trợ lý AI tích hợp trong ứng dụng quản lý công việc TaskPro. Trả lời bằng ${lang}, ngắn gọn và thực tế.

NGÀY HÔM NAY: ${today}${statusInfo}
DỰ ÁN: ${projs.map(p => p.name).join(', ') || '(chưa có)'}
TASKS ĐANG CÓ:
${taskLines}${noteSection}

NGUYÊN TẮC:
- Task có "✅ Hoàn thành" là đã xong — KHÔNG tính là đang làm hay cần làm
- Task có "⚠️ QUÁ HẠN" là đã trễ deadline, cần xử lý ưu tiên cao
- Tham chiếu đúng tên task/dự án/ghi chú từ dữ liệu trên khi người dùng hỏi
- Gợi ý ưu tiên dựa trên deadline và mức độ ưu tiên thực tế
- Dùng markdown (bold, bullet) cho câu trả lời dài
- Giữ giọng thân thiện, chuyên nghiệp`
}

// ── Streaming chat ────────────────────────────────────────────────────────────

async function handleChat(body: Record<string, unknown>): Promise<Response> {
  const client   = getClient()
  const messages = (body.messages as Anthropic.Messages.MessageParam[]) ?? []
  const context  = (body.context  as Record<string, unknown>) ?? {}

  const stream = client.messages.stream({
    model: MODEL, max_tokens: 1024,
    system: buildSystem(context),
    messages,
  })

  const enc = new TextEncoder()
  const readable = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ text: ev.delta.text })}\n\n`))
          }
        }
        ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      } finally {
        ctrl.close()
      }
    },
    cancel() { stream.abort() },
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
  const client   = getClient()
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

  const msg = await client.messages.create({
    model: MODEL, max_tokens: 512,
    system: buildSystem(ctx),
    messages: [{ role: 'user', content: prompt }],
  })

  const content = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return new Response(JSON.stringify({ content }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Priority Insights ─────────────────────────────────────────────────────────

async function handlePriorities(body: Record<string, unknown>): Promise<Response> {
  const client   = getClient()
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

  const msg = await client.messages.create({
    model: MODEL, max_tokens: 600,
    system: buildSystem(ctx),
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
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
  const client = getClient()
  const title  = (body.title as string) ?? ''
  const ctx    = (body.context as Record<string, unknown>) ?? {}

  const prompt = `Task title: "${title}"

Gợi ý thông tin cho task này. JSON hợp lệ (không markdown):
{
  "description": "mô tả ngắn 1-2 câu thực tế",
  "priority": "urgent|high|medium|low",
  "estimatedHours": số_giờ_hoặc_null,
  "subtasks": ["subtask 1", "subtask 2"]
}
subtasks: tối đa 4 items, chỉ khi cần thiết (task đủ phức tạp)`

  const msg = await client.messages.create({
    model: MODEL, max_tokens: 256,
    system: buildSystem(ctx),
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
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
  const client  = getClient()
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''
  const ctx     = (body.context as Record<string, unknown>) ?? {}

  // Strip base64 images before sending to AI
  const safeContent = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[ảnh]')

  const prompt = `Ghi chú: "${title}"

${safeContent}

---
Tóm tắt ghi chú trên thành 3-5 bullet points ngắn gọn, súc tích. Chỉ trả về bullet list, không thêm gì khác.`

  const msg = await client.messages.create({
    model: MODEL, max_tokens: 300,
    system: buildSystem(ctx),
    messages: [{ role: 'user', content: prompt }],
  })

  const summary = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return new Response(JSON.stringify({ summary }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Note: Extract Tasks ───────────────────────────────────────────────────────

async function handleExtractTasks(body: Record<string, unknown>): Promise<Response> {
  const client  = getClient()
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

  const msg = await client.messages.create({
    model: MODEL, max_tokens: 400,
    system: buildSystem(ctx),
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
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
  const client  = getClient()
  const title   = (body.title   as string) ?? ''
  const content = (body.content as string) ?? ''
  const ctx     = (body.context as Record<string, unknown>) ?? {}

  const safeContent = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[ảnh]')

  const prompt = `Ghi chú gốc: "${title}"

${safeContent}

---
Dựa trên ý tưởng/ghi chú trên, viết mở rộng thành văn bản đầy đủ, có cấu trúc dùng markdown (tiêu đề, bullet, in đậm khi cần). Giữ nguyên ý chính, phát triển thêm chi tiết thực tế. Không thêm lời mở đầu hay kết luận chung chung.`

  const msg = await client.messages.create({
    model: MODEL, max_tokens: 800,
    system: buildSystem(ctx),
    messages: [{ role: 'user', content: prompt }],
  })

  const expanded = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return new Response(JSON.stringify({ expanded }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
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

    return new Response('Unknown type', { status: 400, headers: CORS_HEADERS })
  } catch (err) {
    console.error('[ai-chat]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}

export const config: Config = { path: '/api/ai-chat' }
