import { Repository, RepositoryStatus, SyncStatus } from '@repodepot/shared';

interface RepoCardProps {
  repo: Repository & { status: RepositoryStatus | null };
}

const getStatusColor = (status: SyncStatus): string => {
  switch (status) {
    case 'up_to_date':
      return '#22c55e'; // green
    case 'behind':
      return '#f59e0b'; // amber
    case 'ahead':
      return '#3b82f6'; // blue
    case 'diverged':
      return '#a855f7'; // purple
    case 'has_changes':
      return '#f97316'; // orange
    case 'error':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
};

const getStatusLabel = (status: SyncStatus, statusInfo?: RepositoryStatus | null): string => {
  if (!statusInfo) return 'Unknown';

  switch (status) {
    case 'up_to_date':
      return 'Up to date';
    case 'behind':
      return `${statusInfo.behind} behind`;
    case 'ahead':
      return `${statusInfo.ahead} ahead`;
    case 'diverged':
      return `${statusInfo.ahead} ahead, ${statusInfo.behind} behind`;
    case 'has_changes':
      return 'Local changes';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
};

function RepoCard({ repo }: RepoCardProps) {
  const status = repo.status?.status || 'unknown';
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status, repo.status);

  return (
    <div
      style={{
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#4b5563';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#374151';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', margin: 0 }}>
          {repo.name}
        </h3>
        <div
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor: statusColor + '20',
            color: statusColor,
          }}
        >
          {statusLabel}
        </div>
      </div>

      <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.5rem 0' }}>
        {repo.fullName}
      </p>

      {repo.status && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.875rem' }}>
          <div style={{ color: '#9ca3af' }}>
            <span style={{ color: '#6b7280' }}>Branch:</span>{' '}
            <span style={{ color: '#d1d5db' }}>{repo.status.currentBranch}</span>
          </div>
          {repo.status.hasLocalChanges && (
            <div style={{ color: '#f97316' }}>● Local changes</div>
          )}
        </div>
      )}

      {repo.localPath && (
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', margin: 0 }}>
          {repo.localPath}
        </p>
      )}
    </div>
  );
}

export default RepoCard;
