import { PullRequest } from '@repodepot/shared';
import PRCard from './PRCard';

interface PRKanbanBoardProps {
  pullRequests: PullRequest[];
}

interface Column {
  id: string;
  title: string;
  filter: (pr: PullRequest) => boolean;
  color: string;
}

const COLUMNS: Column[] = [
  {
    id: 'draft',
    title: 'Draft',
    filter: (pr) => pr.state === 'open' && pr.draft,
    color: '#fbbf24',
  },
  {
    id: 'review',
    title: 'Ready for Review',
    filter: (pr) => pr.state === 'open' && !pr.draft,
    color: '#22c55e',
  },
  {
    id: 'merged',
    title: 'Merged',
    filter: (pr) => pr.state === 'merged',
    color: '#a855f7',
  },
  {
    id: 'closed',
    title: 'Closed',
    filter: (pr) => pr.state === 'closed',
    color: '#6b7280',
  },
];

function PRKanbanBoard({ pullRequests }: PRKanbanBoardProps) {
  const getPRsForColumn = (column: Column) => {
    return pullRequests.filter(column.filter);
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
        const prs = getPRsForColumn(column);

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
                  {prs.length}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {prs.map(pr => (
                <PRCard key={pr.id} pr={pr} />
              ))}
            </div>

            {prs.length === 0 && (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                }}
              >
                No pull requests
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PRKanbanBoard;
