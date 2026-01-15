import { Repository, RepositoryStatus, SyncStatus } from '@repodepot/shared';
import RepoCard from './RepoCard';

interface RepoKanbanBoardProps {
  repositories: (Repository & { status: RepositoryStatus | null })[];
}

interface Column {
  id: string;
  title: string;
  statuses: SyncStatus[];
  color: string;
}

const COLUMNS: Column[] = [
  {
    id: 'up_to_date',
    title: 'Up to Date',
    statuses: ['up_to_date'],
    color: '#22c55e',
  },
  {
    id: 'needs_update',
    title: 'Needs Update',
    statuses: ['behind', 'diverged'],
    color: '#f59e0b',
  },
  {
    id: 'changes',
    title: 'Local Changes',
    statuses: ['has_changes', 'ahead'],
    color: '#3b82f6',
  },
  {
    id: 'issues',
    title: 'Issues',
    statuses: ['error', 'unknown'],
    color: '#ef4444',
  },
];

function RepoKanbanBoard({ repositories }: RepoKanbanBoardProps) {
  const getReposForColumn = (column: Column) => {
    return repositories.filter(repo => {
      const status = repo.status?.status || 'unknown';
      return column.statuses.includes(status);
    });
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginTop: '2rem',
      }}
    >
      {COLUMNS.map(column => {
        const repos = getReposForColumn(column);

        return (
          <div
            key={column.id}
            style={{
              backgroundColor: '#111827',
              borderRadius: '0.5rem',
              padding: '1rem',
              minHeight: '400px',
            }}
          >
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '0.75rem',
                    height: '0.75rem',
                    borderRadius: '50%',
                    backgroundColor: column.color,
                  }}
                />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', margin: 0 }}>
                  {column.title}
                </h2>
                <span
                  style={{
                    marginLeft: 'auto',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#1f2937',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#9ca3af',
                  }}
                >
                  {repos.length}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {repos.map(repo => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>

            {repos.length === 0 && (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                }}
              >
                No repositories
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RepoKanbanBoard;
