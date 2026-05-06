export interface Translations {
  app: { name: string }
  auth: {
    signIn: string; createAccount: string; email: string; password: string
    passwordHint: string; noAccount: string; hasAccount: string; goToSignIn: string
    checkEmail: string; requiredFields: string; syncedAt: (d: string) => string
    syncing: string; notSynced: string; myAccount: string; signOut: string; syncNow: string
  }
  sidebar: {
    allTasks: string; today: string; tomorrow: string; upcoming: string
    projects: string; newProject: string; labels: string
    overallProgress: string; breached: string; critical: string; atRisk: string; inProgress: string
    syncBackup: string; manage: string
  }
  manage: {
    title: string; projects: string; labels: string
    projectName: string; labelName: string; description: string; color: string
    addProject: string; addLabel: string; save: string; cancel: string; delete: string; edit: string
    confirmDelete: string; noProjects: string; noLabels: string
    taskCount: (n: number) => string
  }
  header: {
    newTask: string; search: string; allPriorities: string; allStatuses: string
    allSLA: string; clear: string; language: string; filters: string; tasks: string
  }
  views: { dashboard: string; kanban: string; list: string; calendar: string; timeline: string }
  status: { todo: string; in_progress: string; in_review: string; done: string }
  priority: {
    low: string; medium: string; high: string; urgent: string; allPriorities: string
    urgentIcon: string; highIcon: string; mediumIcon: string; lowIcon: string
  }
  sla: {
    on_track: string; at_risk: string; critical: string; breached: string
    completed: string; none: string; deadline: string; remaining: string
    overdueBy: string; window: string; p1: string; p2: string; p3: string; p4: string
    none_preset: string; custom: string; resolutionHint: string; allSLA: string; slaBreached: string
  }
  form: {
    newTask: string; editTask: string; title: string; titlePlaceholder: string
    description: string; descPlaceholder: string; status: string; priority: string
    project: string; dueDate: string; dueTime: string; slaTimeHint: string
    slaWindow: string; slaWindowHint: string; estimatedHours: string; estPlaceholder: string
    hours: string; labels: string; links: string; linkPlaceholder: string; addLink: string
    cancel: string; create: string; save: string; titleRequired: string
  }
  detail: {
    description: string; labels: string; subtasks: string; comments: string; links: string
    addSubtask: string; addComment: string; ctrlEnter: string; moveTo: string
    estimated: string; overdueBy: string; remaining: string; slaDeadline: string
    slaWindow: string; edit: string; delete: string
  }
  list: {
    task: string; status: string; priority: string; sla: string; deadline: string
    project: string; noTasks: string
    tasks: (n: number) => string
    completed: (n: number) => string
  }
  calendar: {
    today: string; breached: string; critical: string; atRisk: string; onTrack: string
    more: (n: number) => string
    months: string[]
    days: string[]
  }
  dashboard: {
    title: string; totalTasks: string; inProgress: string; completedToday: string
    slaBreached: string; slaHealth: string; weeklyActivity: string
    upcomingDeadlines: string; projectBreakdown: string; noDeadlines: string
    onTrack: string; atRisk: string; critical: string
    tasks: (n: number) => string
    done: (n: number) => string
    reports: string; monthlyTrend: string; byPriority: string; completionRate: string
    week: (n: number) => string
  }
  onboarding: {
    step1Title: string; step1Desc: string
    step2Title: string; step2Desc: string
    step3Title: string; step3Desc: string
    step4Title: string; step4Desc: string
    next: string; skip: string; getStarted: string
  }
  timeline: {
    title: string; noTasks: string; today: string; noDueDate: string
  }
  recurrence: {
    title: string; none: string; daily: string; weekly: string; monthly: string
    every: string; days: string; weeks: string; months: string
    endDate: string; repeats: string
  }
  sync: {
    title: string; exportTitle: string; exportDesc: string; exportBtn: string
    importTitle: string; importDesc: string; importBtn: string
    importReplace: string; importMerge: string
    importSuccess: string; importError: string; confirmReplace: string
    codeTitle: string; codeDesc: string; copyCode: string; pasteCode: string
    copied: string; codePlaceholder: string; applyCode: string
  }
  pomodoro: {
    focus: string; work: string; shortBreak: string; longBreak: string
    start: string; pause: string; reset: string; done: string
    nextShortBreak: string; nextLongBreak: string; nextWork: string
    session: (n: number) => string
    min25: string; min50: string
  }
  notifications: {
    title: string; enable: string; denied: string; noUpcoming: string
    dueIn60: string; dueIn30: string; dueIn15: string; overdue: string; dueSoon: string
    notifTitle: (label: string) => string; markDone: string; viewTask: string
    permissionGranted: string; upcomingCount: (n: number) => string
    notifyBefore: string; min15: string; min30: string; hour1: string
  }
  pwa: {
    installTitle: string; installDesc: string; install: string; installing: string
    notNow: string; updateTitle: string; update: string; offline: string; backOnline: string
  }
}
