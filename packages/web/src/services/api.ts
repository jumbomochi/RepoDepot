const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Repository CRUD
  getRepositories: (includeStatus = false) =>
    request<any[]>(`/api/repositories${includeStatus ? '?includeStatus=true' : ''}`),

  getRepository: (id: number) =>
    request<any>(`/api/repositories/${id}`),

  createRepository: (data: any) =>
    request<any>('/api/repositories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRepository: (id: number) =>
    fetch(`${API_BASE}/api/repositories/${id}`, { method: 'DELETE' }),

  // Repository Actions
  syncRepo: (id: number) =>
    request<{ success: boolean; status: any; error?: string }>(
      `/api/repositories/${id}/sync`,
      { method: 'POST' }
    ),

  pullRepo: (id: number) =>
    request<{ success: boolean; changes: number; status: any; error?: string }>(
      `/api/repositories/${id}/pull`,
      { method: 'POST' }
    ),

  cloneRepo: (id: number, path?: string) =>
    request<{ success: boolean; repository: any; status: any; error?: string }>(
      `/api/repositories/${id}/clone`,
      {
        method: 'POST',
        body: JSON.stringify({ path }),
      }
    ),

  syncAllRepos: () =>
    request<{ success: boolean; results: any[] }>(
      '/api/repositories/sync-all',
      { method: 'POST' }
    ),

  // GitHub PRs
  fetchPRs: (repoId: number) =>
    request<{ success: boolean; count: number; prs: any[] }>(
      `/api/repositories/${repoId}/fetch-prs`,
      { method: 'POST' }
    ),

  fetchAllPRs: () =>
    request<{ success: boolean; results: any[] }>(
      '/api/repositories/fetch-all-prs',
      { method: 'POST' }
    ),

  getPullRequests: () =>
    request<any[]>('/api/pull-requests'),

  // Issues
  getIssues: (repoId?: number) =>
    request<any[]>(`/api/issues${repoId ? `?repoId=${repoId}` : ''}`),

  updateIssue: (id: string, data: any) =>
    request<any>(`/api/issues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Config
  getConfig: () =>
    request<{
      hasGitHubToken: boolean;
      defaultClonePath: string;
      autoFetch: boolean;
      fetchIntervalMinutes: number;
    }>('/api/config'),

  updateConfig: (data: {
    githubToken?: string;
    defaultClonePath?: string;
    autoFetch?: boolean;
    fetchIntervalMinutes?: number;
  }) =>
    request<{ success: boolean; config: any }>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  verifyGitHubToken: () =>
    request<{ valid: boolean; username?: string; error?: string }>(
      '/api/config/github/verify'
    ),

  testGitHubToken: (token: string) =>
    request<{ valid: boolean; username?: string; error?: string }>(
      '/api/config/github/test',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      }
    ),

  // Activity
  getActivitySummary: () =>
    request<{
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
    }>('/api/activity/summary'),

  getRepoActivity: (repoId: number) =>
    request<{
      repoId: number;
      repoFullName: string;
      recentCommits: any[];
      commitsThisWeek: number;
      topContributors: any[];
      openIssues: number;
      openPRs: number;
    }>(`/api/activity/repositories/${repoId}/activity`),

  getRepoCommits: (repoId: number, count = 20) =>
    request<any[]>(`/api/activity/repositories/${repoId}/commits?count=${count}`),

  getRepoGitHubCommits: (repoId: number, count = 20) =>
    request<any[]>(`/api/activity/repositories/${repoId}/github-commits?count=${count}`),

  getRepoContributors: (repoId: number) =>
    request<any[]>(`/api/activity/repositories/${repoId}/contributors`),

  // Issue Sync
  createIssue: (data: any) =>
    request<any>('/api/issues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  syncIssueToGitHub: (issueId: string) =>
    request<{ issue: any; githubIssue: any }>(`/api/issues/${issueId}/sync-to-github`, {
      method: 'POST',
    }),

  syncIssueFromGitHub: (issueId: string) =>
    request<{ issue: any; githubIssue: any }>(`/api/issues/${issueId}/sync-from-github`, {
      method: 'POST',
    }),

  syncAllIssuesToGitHub: (repoId: number) =>
    request<{ total: number; synced: number; results: any[] }>(`/api/issues/sync-all/${repoId}`, {
      method: 'POST',
    }),

  importIssuesFromGitHub: (repoId: number) =>
    request<{ total: number; created: number; updated: number; results: any[] }>(
      `/api/issues/import-from-github/${repoId}`,
      { method: 'POST' }
    ),

  // Agent Control
  startAgent: (repoId: number, workDir?: string) =>
    request<{ success: boolean; message: string; repoId: number; startedAt: string; pid: number }>(
      `/api/agent/start/${repoId}`,
      {
        method: 'POST',
        body: JSON.stringify({ workDir }),
      }
    ),

  stopAgent: (repoId: number) =>
    request<{ success: boolean; message: string }>(
      `/api/agent/stop/${repoId}`,
      { method: 'POST' }
    ),

  getAgentStatus: (repoId: number) =>
    request<{ running: boolean; repoId: number; startedAt?: string; pid?: number; recentLogs?: string[] }>(
      `/api/agent/status/${repoId}`
    ),

  getRunningAgents: () =>
    request<{ agents: { repoId: number; startedAt: string; pid: number }[]; count: number }>(
      '/api/agent/running'
    ),

  getAgentTasks: (repoId: number) =>
    request<{ repository: any; tasks: any[]; count: number }>(
      `/api/agent/tasks/${repoId}`
    ),

  startAllAgents: () =>
    request<{
      success: boolean;
      summary: {
        totalRepos: number;
        agentsStarted: number;
        alreadyRunning: number;
        noTasks: number;
        errors: number;
        totalPendingTasks: number;
      };
      results: {
        repoId: number;
        repoName: string;
        status: 'started' | 'already_running' | 'no_tasks' | 'no_local_path' | 'error';
        pendingTasks?: number;
        error?: string;
        pid?: number;
      }[];
    }>('/api/agent/start-all', { method: 'POST' }),

  stopAllAgents: () =>
    request<{
      success: boolean;
      stoppedCount: number;
      stoppedRepos: number[];
    }>('/api/agent/stop-all', { method: 'POST' }),
};
