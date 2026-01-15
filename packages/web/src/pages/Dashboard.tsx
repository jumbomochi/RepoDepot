import { useState, useEffect } from 'react';
import { Repository, Issue } from '@repodepot/shared';
import AddRepoForm from '../components/AddRepoForm';
import RepoSelector from '../components/RepoSelector';
import KanbanBoard from '../components/KanbanBoard';

function Dashboard() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRepos();
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      fetchIssues(selectedRepoId);
    } else {
      setIssues([]);
    }
  }, [selectedRepoId]);

  const fetchRepos = async () => {
    try {
      const response = await fetch('/api/repositories');
      const data = await response.json();
      setRepos(data);
      if (data.length > 0 && !selectedRepoId) {
        setSelectedRepoId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async (repoId: number) => {
    try {
      const response = await fetch(`/api/issues?repoId=${repoId}`);
      const data = await response.json();
      setIssues(data);
    } catch (error) {
      console.error('Error fetching issues:', error);
    }
  };

  const handleRepoAdded = () => {
    fetchRepos();
  };

  const handleDeleteRepo = async (repoId: number) => {
    try {
      const response = await fetch(`/api/repositories/${repoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from local state
        const updatedRepos = repos.filter(r => r.id !== repoId);
        setRepos(updatedRepos);

        // Select another repo if the deleted one was selected
        if (selectedRepoId === repoId) {
          setSelectedRepoId(updatedRepos.length > 0 ? updatedRepos[0].id : null);
        }
      }
    } catch (error) {
      console.error('Error deleting repository:', error);
    }
  };

  const handleIssueUpdate = async (issueId: string, updates: Partial<Issue>) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedIssue = await response.json();
        setIssues(prev => prev.map(issue =>
          issue.id === issueId ? updatedIssue : issue
        ));
      }
    } catch (error) {
      console.error('Error updating issue:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '1.5rem',
        textAlign: 'center'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '1.5rem',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <AddRepoForm onRepoAdded={handleRepoAdded} />

      {repos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          <p>No repositories yet. Add one above to get started.</p>
        </div>
      ) : (
        <>
          <RepoSelector
            repos={repos}
            selectedRepoId={selectedRepoId}
            onSelectRepo={setSelectedRepoId}
            onDeleteRepo={handleDeleteRepo}
          />
          {selectedRepoId && (
            <KanbanBoard
              issues={issues}
              onIssueUpdate={handleIssueUpdate}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
