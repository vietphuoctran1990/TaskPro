function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function parseInline(line: string): string {
  const imgs: string[] = []
  const withPh = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const i = imgs.length
    imgs.push(`<img src="${src}" alt="${esc(alt)}" class="inline max-h-40 rounded my-1 align-middle" />`)
    return `\x00IMG${i}\x00`
  })
  let r = esc(withPh)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-[13px] font-mono">$1</code>')
  imgs.forEach((html, i) => { r = r.split(`\x00IMG${i}\x00`).join(html) })
  return r
}

export function renderMd(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inUl = false
  const flushUl = () => { if (inUl) { out.push('</ul>'); inUl = false } }

  for (const raw of lines) {
    const imgM = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgM) {
      flushUl()
      out.push(`<img src="${imgM[2]}" alt="${esc(imgM[1])}" class="max-w-full rounded-xl my-3 block shadow-sm" style="max-height:480px;object-fit:contain" />`)
      continue
    }
    const h1 = raw.match(/^# (.+)/)
    if (h1) { flushUl(); out.push(`<h1 class="text-xl font-bold mt-6 mb-2 text-slate-900 dark:text-slate-100">${parseInline(h1[1])}</h1>`); continue }
    const h2 = raw.match(/^## (.+)/)
    if (h2) { flushUl(); out.push(`<h2 class="text-lg font-semibold mt-4 mb-1 text-slate-800 dark:text-slate-200">${parseInline(h2[1])}</h2>`); continue }
    const h3 = raw.match(/^### (.+)/)
    if (h3) { flushUl(); out.push(`<h3 class="text-[15px] font-semibold mt-3 mb-0.5 text-slate-700 dark:text-slate-300">${parseInline(h3[1])}</h3>`); continue }
    if (raw === '---') { flushUl(); out.push('<hr class="my-4 border-slate-200 dark:border-slate-700" />'); continue }
    const li = raw.match(/^[-*] (.+)/)
    if (li) {
      if (!inUl) { out.push('<ul class="my-1.5 pl-5 space-y-0.5">'); inUl = true }
      out.push(`<li class="list-disc text-slate-700 dark:text-slate-300">${parseInline(li[1])}</li>`)
      continue
    }
    flushUl()
    if (raw.trim() === '') { out.push('<div class="h-3"></div>'); continue }
    out.push(`<p class="leading-relaxed text-slate-700 dark:text-slate-300">${parseInline(raw)}</p>`)
  }

  flushUl()
  return out.join('\n')
}
