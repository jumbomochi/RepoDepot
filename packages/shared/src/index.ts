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
}

export interface Comment {
  id: string;
  issueId: string;
  userId: string;
  content: string;
  createdAt: string;
}
