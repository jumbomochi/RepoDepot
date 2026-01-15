import { PullRequest } from '@repodepot/shared';

interface PRCardProps {
  pr: PullRequest;
}

const getStateColor = (draft: boolean, state: string): string => {
  if (state === 'merged') return '#a855f7'; // purple
  if (state === 'closed') return '#6b7280'; // gray
  if (draft) return '#fbbf24'; // yellow
  return '#22c55e'; // green for open
};

function PRCard({ pr }: PRCardProps) {
  const stateColor = getStateColor(pr.draft, pr.state);

  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        padding: '1rem',
        textDecoration: 'none',
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div
          style={{
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            backgroundColor: stateColor,
            marginTop: '0.375rem',
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#f3f4f6',
              margin: '0 0 0.5rem 0',
              lineHeight: 1.4,
            }}
          >
            {pr.title}
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                padding: '0.125rem 0.5rem',
                backgroundColor: '#111827',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                color: '#9ca3af',
              }}
            >
              #{pr.number}
            </span>

            {pr.draft && (
              <span
                style={{
                  padding: '0.125rem 0.5rem',
                  backgroundColor: stateColor + '20',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: stateColor,
                  fontWeight: 500,
                }}
              >
                Draft
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            <div>{pr.repoFullName}</div>
            <div style={{ marginTop: '0.25rem' }}>by {pr.author}</div>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Updated {new Date(pr.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </a>
  );
}

export default PRCard;
