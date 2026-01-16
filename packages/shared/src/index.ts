// Repository types
export interface Repository {
  id: number;
  name: string;
  fullName: string; // owner/repo
  localPath: string | null;
  cloneUrl: string;
  defaultBranch: string;
  groupId: number | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface RepositoryStatus {
  repoId: number;
  status: SyncStatus;
  ahead: number;
  behind: number;
  hasLocalChanges: boolean;
  currentBranch: string;
  lastCheckedAt: string;
}

export type SyncStatus = 'up_to_date' | 'behind' | 'ahead' | 'diverged' | 'has_changes' | 'error' | 'unknown';

// Group types
export interface Group {
  id: number;
  name: string;
  color: string | null;
  position: number;
}

// Pull Request types
export interface PullRequest {
  id: number;
  repoId: number;
  githubId: number;
  number: number;
  title: string;
  state: PRState;
  draft: boolean;
  author: string;
  updatedAt: string;
  url: string;
  repoFullName: string;
}

export type PRState = 'open' | 'closed' | 'merged';

export type PRBoardColumn = 'draft' | 'review' | 'approved' | 'changes_requested' | 'merged';

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Config types
export interface AppConfig {
  githubToken?: string;
  defaultClonePath: string;
  autoFetch: boolean;
  fetchIntervalMinutes: number;
}

// Kanban board types
export interface KanbanColumn<T> {
  id: string;
  title: string;
  items: T[];
}

export interface RepoKanbanBoard {
  columns: KanbanColumn<Repository & { status: RepositoryStatus }>[];
}

export interface PRKanbanBoard {
  columns: KanbanColumn<PullRequest>[];
}

// Issue Management types
export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export type IssueStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type AgentStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';

export interface Issue {
  id: string;
  repoId: number;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: string;
  reporterId: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  // GitHub sync fields
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  syncedAt?: string;
  // Agent fields
  agentStatus?: AgentStatus;
  agentClaimedAt?: string;
  agentCompletedAt?: string;
  agentError?: string;
}

export interface Comment {
  id: string;
  issueId: string;
  userId: string;
  content: string;
  createdAt: string;
}

// Activity & Commit types
export interface Commit {
  hash: string;
  hashShort: string;
  author: string;
  authorEmail: string;
  message: string;
  date: string;
}

export interface Contributor {
  login: string;
  avatarUrl: string;
  contributions: number;
}

export interface RepoActivity {
  repoId: number;
  repoFullName: string;
  recentCommits: Commit[];
  commitsThisWeek: number;
  topContributors: Contributor[];
  openIssues: number;
  openPRs: number;
}

export interface ActivitySummary {
  totalCommitsThisWeek: number;
  totalPRsMerged: number;
  activeContributors: number;
  recentActivity: {
    type: 'commit' | 'pr_merged' | 'issue_opened' | 'issue_closed';
    repoFullName: string;
    title: string;
    author: string;
    timestamp: string;
    url?: string;
  }[];
}

// Agent Progress types
export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';

export interface TaskStep {
  id: string;
  taskId: string;
  index: number;
  description: string;
  status: StepStatus;
  note?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskQuestion {
  id: string;
  taskId: string;
  question: string;
  choices?: string[];
  answer?: string;
  askedAt: string;
  answeredAt?: string;
}

export interface TaskProgress {
  taskId: string;
  steps: TaskStep[];
  currentQuestion?: TaskQuestion;
}
