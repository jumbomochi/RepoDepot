import { Issue } from '@repodepot/shared';

interface IssueCardProps {
  issue: Issue;
  onUpdate: (issueId: string, updates: Partial<Issue>) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

function IssueCard({ issue }: IssueCardProps) {
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
      <h4 style={{
        margin: '0 0 0.5rem 0',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#1f2937',
      }}>
        {issue.title}
      </h4>

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
      </div>
    </div>
  );
}

export default IssueCard;
