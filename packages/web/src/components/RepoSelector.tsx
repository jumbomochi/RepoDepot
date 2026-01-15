import { useState } from 'react';
import { Repository } from '@repodepot/shared';

interface RepoSelectorProps {
  repos: Repository[];
  selectedRepoId: number | null;
  onSelectRepo: (repoId: number) => void;
  onDeleteRepo: (repoId: number) => Promise<void>;
}

function RepoSelector({ repos, selectedRepoId, onSelectRepo, onDeleteRepo }: RepoSelectorProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedRepo = repos.find(r => r.id === selectedRepoId);

  const handleDelete = async () => {
    if (!selectedRepoId) return;

    setDeleting(true);
    try {
      await onDeleteRepo(selectedRepoId);
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#374151',
      }}>
        Select Repository
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <select
          value={selectedRepoId || ''}
          onChange={(e) => onSelectRepo(Number(e.target.value))}
          style={{
            flex: '1 1 200px',
            maxWidth: '400px',
            minWidth: '0',
            padding: '0.625rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '1rem',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          {repos.map(repo => (
            <option key={repo.id} value={repo.id}>
              {repo.fullName}
            </option>
          ))}
        </select>

        {selectedRepoId && !showConfirm && (
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              padding: '0.625rem 1rem',
              background: 'white',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Remove repository"
          >
            Remove
          </button>
        )}

        {showConfirm && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            background: '#fef2f2',
            borderRadius: '6px',
            border: '1px solid #fecaca',
          }}>
            <span style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: 500 }}>
              Remove {selectedRepo?.fullName}?
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  minWidth: '60px',
                }}
              >
                {deleting ? '...' : 'Yes'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  minWidth: '60px',
                }}
              >
                No
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RepoSelector;
