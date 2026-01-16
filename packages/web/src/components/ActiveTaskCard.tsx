import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Step {
  index: number;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
  note?: string;
}

interface ActiveTaskCardProps {
  issue: {
    id: string;
    title: string;
    repoId: number;
  };
  repoName: string;
}

export function ActiveTaskCard({ issue, repoName }: ActiveTaskCardProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const progress = await api.getProgress(issue.id);
        setSteps(progress.steps);
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [issue.id]);

  const completedCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.length;

  const getStepIcon = (status: Step['status']) => {
    switch (status) {
      case 'done': return '✓';
      case 'in_progress': return '●';
      case 'failed': return '✗';
      case 'skipped': return '−';
      default: return '○';
    }
  };

  const getStepColor = (status: Step['status']) => {
    switch (status) {
      case 'done': return '#22c55e';
      case 'in_progress': return '#3b82f6';
      case 'failed': return '#ef4444';
      case 'skipped': return '#9ca3af';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{repoName}</span>
          <h4 style={{ color: '#f1f5f9', margin: '4px 0', fontSize: '14px' }}>{issue.title}</h4>
        </div>
        {totalCount > 0 && (
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
            {completedCount}/{totalCount} steps
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: '12px' }}>Loading progress...</div>
      ) : steps.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '12px' }}>No plan defined yet</div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {steps.map((step) => (
            <div
              key={step.index}
              title={step.description + (step.note ? `\n${step.note}` : '')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                background: '#334155',
                fontSize: '12px',
              }}
            >
              <span style={{
                color: getStepColor(step.status),
                animation: step.status === 'in_progress' ? 'pulse 1.5s infinite' : 'none',
              }}>
                {getStepIcon(step.status)}
              </span>
              <span style={{
                color: step.status === 'done' ? '#94a3b8' : '#e2e8f0',
                textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {step.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
