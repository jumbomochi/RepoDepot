import { useEffect, useState } from 'react';
import { Repository, RepositoryStatus } from '@repodepot/shared';
import RepoKanbanBoard from '../components/RepoKanbanBoard';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function Repositories() {
  const [repositories, setRepositories] = useState<(Repository & { status: RepositoryStatus | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/repositories?includeStatus=true`);

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchRepositories, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        Loading repositories...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#f3f4f6', margin: 0 }}>
            Repositories
          </h1>
          <p style={{ fontSize: '1rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            {repositories.length} repositories tracked
          </p>
        </div>

        <button
          onClick={fetchRepositories}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          Refresh
        </button>
      </div>

      {repositories.length === 0 ? (
        <div
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            backgroundColor: '#1f2937',
            borderRadius: '0.5rem',
            marginTop: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f3f4f6', marginBottom: '0.5rem' }}>
            No repositories yet
          </h2>
          <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
            Add repositories using the CLI: repodepot add owner/repo
          </p>
        </div>
      ) : (
        <RepoKanbanBoard repositories={repositories} />
      )}
    </div>
  );
}

export default Repositories;
