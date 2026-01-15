import { useState } from 'react';
import { Issue } from '@repodepot/shared';
import { api } from '../services/api';

interface IssueCardProps {
  issue: Issue;
  onUpdate: (issueId: string, updates: Partial<Issue>) => void;
  onSyncComplete?: (issue: Issue) => void;
  repoName?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const AGENT_STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  assigned: '#3b82f6',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  failed: '#ef4444',
};

const AGENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

function IssueCard({ issue, onSyncComplete, repoName }: IssueCardProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSyncToGitHub = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      const result = await api.syncIssueToGitHub(issue.id);
      if (onSyncComplete && result.issue) {
        onSyncComplete(result.issue);
      }
    } catch (error) {
      console.error('Error syncing issue to GitHub:', error);
    } finally {
      setSyncing(false);
    }
  };

  const formatSyncDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      padding: '0.75rem',
      cursor: 'pointer',
      transition: 'box-shadow 0.2s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {/* Repo name badge */}
      {repoName && (
        <div style={{
          fontSize: '0.625rem',
          fontWeight: 500,
          color: '#6b7280',
          marginBottom: '0.375rem',
          padding: '0.125rem 0.375rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '0.25rem',
          display: 'inline-block',
        }}>
          {repoName}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h4 style={{
          margin: 0,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#1f2937',
          flex: 1,
        }}>
          {issue.title}
        </h4>

        {/* GitHub sync status */}
        {issue.githubIssueUrl ? (
          <a
            href={issue.githubIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.5rem',
              height: '1.5rem',
              backgroundColor: '#f3f4f6',
              borderRadius: '0.25rem',
              marginLeft: '0.5rem',
              flexShrink: 0,
            }}
            title={`GitHub #${issue.githubIssueNumber}${issue.syncedAt ? `\nLast synced: ${formatSyncDate(issue.syncedAt)}` : ''}`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#333">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
        ) : (
          <button
            onClick={handleSyncToGitHub}
            disabled={syncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem 0.5rem',
              backgroundColor: syncing ? '#d1d5db' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              fontSize: '0.625rem',
              fontWeight: 500,
              cursor: syncing ? 'not-allowed' : 'pointer',
              marginLeft: '0.5rem',
              flexShrink: 0,
            }}
            title="Sync this issue to GitHub"
          >
            {syncing ? '...' : 'Sync'}
          </button>
        )}
      </div>

      {issue.description && (
        <p style={{
          margin: '0 0 0.5rem 0',
          fontSize: '0.75rem',
          color: '#6b7280',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {issue.description}
        </p>
      )}

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.25rem',
        marginTop: '0.5rem',
      }}>
        <span style={{
          padding: '0.125rem 0.5rem',
          borderRadius: '999px',
          fontSize: '0.625rem',
          fontWeight: 500,
          background: PRIORITY_COLORS[issue.priority],
          color: 'white',
        }}>
          {issue.priority}
        </span>

        {issue.labels.map(label => (
          <span key={label} style={{
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.625rem',
            fontWeight: 500,
            background: '#e5e7eb',
            color: '#374151',
          }}>
            {label}
          </span>
        ))}

        {issue.githubIssueNumber && (
          <span style={{
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.625rem',
            fontWeight: 500,
            background: '#dbeafe',
            color: '#1d4ed8',
          }}>
            #{issue.githubIssueNumber}
          </span>
        )}

        {/* Agent Status Badge */}
        {issue.agentStatus && issue.githubIssueNumber && (
          <span style={{
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.625rem',
            fontWeight: 500,
            background: `${AGENT_STATUS_COLORS[issue.agentStatus]}20`,
            color: AGENT_STATUS_COLORS[issue.agentStatus],
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: AGENT_STATUS_COLORS[issue.agentStatus],
              animation: issue.agentStatus === 'in_progress' ? 'pulse 1.5s infinite' : 'none',
            }} />
            {AGENT_STATUS_LABELS[issue.agentStatus]}
          </span>
        )}
      </div>

      {issue.syncedAt && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.625rem',
          color: '#9ca3af',
        }}>
          Synced: {formatSyncDate(issue.syncedAt)}
        </div>
      )}
    </div>
  );
}

export default IssueCard;
