import type { Project, Label, Task, StatusDef, TaskTemplate } from '../types'

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: 'todo',        name: '', color: '#94a3b8', order: 0, isFinal: false, isBuiltin: true },
  { id: 'in_progress', name: '', color: '#3b82f6', order: 1, isFinal: false, isBuiltin: true },
  { id: 'in_review',   name: '', color: '#8b5cf6', order: 2, isFinal: false, isBuiltin: true },
  { id: 'done',        name: '', color: '#22c55e', order: 3, isFinal: true,  isBuiltin: true },
]

export const DEFAULT_PROJECTS: Project[] = []
export const DEFAULT_LABELS: Label[]  = []
export const DEFAULT_TASKS: Task[]    = []

export const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-bug',
    name: '🐛 Bug Fix',
    description: '**Mô tả lỗi:**\n\n**Bước tái hiện:**\n1. \n2. \n\n**Kết quả mong đợi:**\n\n**Kết quả thực tế:**',
    priority: 'high',
    estimatedHours: 2,
    slaHours: 8,
    labels: [],
    subtasks: ['Tái hiện lỗi', 'Xác định nguyên nhân', 'Viết fix', 'Test fix', 'Deploy'],
    isBuiltin: true,
  },
  {
    id: 'tpl-feature',
    name: '✨ Feature Request',
    description: '**Mục tiêu:**\n\n**Mô tả tính năng:**\n\n**Tiêu chí chấp nhận:**\n- [ ] \n- [ ] \n\n**Ghi chú kỹ thuật:**',
    priority: 'medium',
    estimatedHours: 8,
    slaHours: null,
    labels: [],
    subtasks: ['Thiết kế', 'Implement', 'Viết test', 'Review', 'Deploy'],
    isBuiltin: true,
  },
  {
    id: 'tpl-review',
    name: '👀 Code Review',
    description: '**PR/Branch:**\n\n**Điểm cần chú ý:**\n\n**Checklist:**\n- [ ] Logic đúng\n- [ ] Test coverage\n- [ ] Performance\n- [ ] Security',
    priority: 'medium',
    estimatedHours: 1,
    slaHours: 4,
    labels: [],
    subtasks: ['Đọc code', 'Chạy test local', 'Để lại nhận xét', 'Approve/Request changes'],
    isBuiltin: true,
  },
  {
    id: 'tpl-meeting',
    name: '📋 Meeting Prep',
    description: '**Mục tiêu buổi họp:**\n\n**Agenda:**\n1. \n2. \n\n**Tài liệu cần chuẩn bị:**\n\n**Quyết định cần đưa ra:**',
    priority: 'low',
    estimatedHours: 0.5,
    slaHours: null,
    labels: [],
    subtasks: ['Chuẩn bị tài liệu', 'Gửi agenda', 'Họp', 'Ghi biên bản'],
    isBuiltin: true,
  },
]
