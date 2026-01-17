import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { ActiveTaskCard } from './ActiveTaskCard';
import { QuestionCard } from './QuestionCard';
import type { Issue, Repository } from '@repodepot/shared';

interface MissionControlProps {
  issues: Issue[];
  repositories: Repository[];
  onRefresh: () => void;
}

interface AwaitingTask {
  taskId: string;
  question: {
    id: string;
    taskId: string;
    question: string;
    choices?: string[];
    askedAt: string;
  };
}

export function MissionControl({ issues, repositories, onRefresh }: MissionControlProps) {
  const [awaitingTasks, setAwaitingTasks] = useState<AwaitingTask[]>([]);

  const fetchAwaiting = useCallback(async () => {
    try {
      const result = await api.getTasksAwaitingInput();
      setAwaitingTasks(result.tasks);
    } catch (error) {
      console.error('Error fetching awaiting tasks:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchWithCleanup = async () => {
      if (isMounted) {
        await fetchAwaiting();
      }
    };

    fetchWithCleanup();
    const interval = setInterval(fetchWithCleanup, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchAwaiting]);

  const getRepoName = (repoId: number) => {
    const repo = repositories.find(r => r.id === repoId);
    return repo?.fullName || `Repo ${repoId}`;
  };

  const getIssueById = (taskId: string) => {
    return issues.find(i => i.id === taskId);
  };

  // Categorize issues
  const needsAttention = awaitingTasks
    .map(t => {
      const issue = getIssueById(t.taskId);
      return issue ? { ...t, issue } : null;
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const active = issues.filter(i =>
    (i.agentStatus === 'in_progress' || i.agentStatus === 'assigned') &&
    !awaitingTasks.some(t => t.taskId === i.id)
  );

  const queued = issues.filter(i =>
    i.agentStatus === 'pending' && i.status !== 'done'
  );

  const completedToday = issues.filter(i => {
    if (i.agentStatus !== 'completed') return false;
    if (!i.agentCompletedAt) return false;
    const completed = new Date(i.agentCompletedAt);
    const today = new Date();
    return completed.toDateString() === today.toDateString();
  });

  // Group queued by repo
  const queuedByRepo = queued.reduce((acc, issue) => {
    const repoName = getRepoName(issue.repoId);
    if (!acc[repoName]) acc[repoName] = [];
    acc[repoName].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);

  const handleAnswered = () => {
    fetchAwaiting();
    onRefresh();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            color: '#f59e0b',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>⚠️</span> NEEDS ATTENTION ({needsAttention.length})
          </h2>
          {needsAttention.map(({ taskId, question, issue }) => (
            <QuestionCard
              key={taskId}
              taskId={taskId}
              taskTitle={issue.title}
              repoName={getRepoName(issue.repoId)}
              question={question}
              onAnswered={handleAnswered}
            />
          ))}
        </section>
      )}

      {/* Active */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{
          color: '#3b82f6',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>🔄</span> ACTIVE ({active.length})
        </h2>
        {active.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No active tasks</div>
        ) : (
          active.map(issue => (
            <ActiveTaskCard
              key={issue.id}
              issue={issue}
              repoName={getRepoName(issue.repoId)}
            />
          ))
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Queued */}
        <section>
          <h2 style={{
            color: '#94a3b8',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>📋</span> QUEUED ({queued.length})
          </h2>
          {Object.keys(queuedByRepo).length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>No queued tasks</div>
          ) : (
            Object.entries(queuedByRepo).map(([repoName, repoIssues]) => (
              <div key={repoName} style={{ marginBottom: '8px' }}>
                <span style={{ color: '#e2e8f0', fontSize: '13px' }}>
                  {repoName}: {repoIssues.length} task{repoIssues.length !== 1 ? 's' : ''}
                </span>
              </div>
            ))
          )}
        </section>

        {/* Completed Today */}
        <section>
          <h2 style={{
            color: '#22c55e',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>✅</span> COMPLETED TODAY ({completedToday.length})
          </h2>
          {completedToday.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>No completions today</div>
          ) : (
            completedToday.map(issue => (
              <div key={issue.id} style={{
                color: '#94a3b8',
                fontSize: '13px',
                marginBottom: '4px',
              }}>
                {getRepoName(issue.repoId)}: {issue.title}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
