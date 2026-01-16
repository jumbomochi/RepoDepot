import { useState, useEffect } from 'react';
import { Repository, Issue, IssuePriority, IssueStatus } from '@repodepot/shared';
import AddRepoForm from '../components/AddRepoForm';
import KanbanBoard from '../components/KanbanBoard';
import { api } from '../services/api';

function Dashboard() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    priority: 'medium' as IssuePriority,
    repoId: null as number | null,
    syncToGitHub: false
  });
  const [creating, setCreating] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [runningAgents, setRunningAgents] = useState<Set<number>>(new Set());
  const [startingAllAgents, setStartingAllAgents] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Sync issues from GitHub for all repos
  const syncFromGitHub = async (repositories: Repository[], tokenAvailable: boolean) => {
    if (!tokenAvailable || repositories.length === 0) return;

    setSyncing(true);
    try {
      // Sync all repos in parallel
      await Promise.all(
        repositories.map(repo =>
          api.importIssuesFromGitHub(repo.id).catch(err => {
            console.error(`Error syncing repo ${repo.fullName}:`, err);
          })
        )
      );
      // Refresh issues after sync
      const updatedIssues = await api.getIssues();
      setIssues(updatedIssues);
    } catch (error) {
      console.error('Error syncing from GitHub:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Check config first to get token status
      let tokenAvailable = false;
      try {
        const config = await api.getConfig();
        tokenAvailable = config.hasGitHubToken;
        setHasToken(tokenAvailable);
      } catch {
        setHasToken(false);
      }

      const repoData = await api.getRepositories().catch(() => []);
      setRepos(repoData);
      if (repoData.length > 0 && !newIssue.repoId) {
        setNewIssue(prev => ({ ...prev, repoId: repoData[0].id }));
      }

      // Sync from GitHub after fetching repos (pass token status)
      await syncFromGitHub(repoData, tokenAvailable);
      setLoading(false);
    };
    init();
    fetchAllIssues();
    checkRunningAgents();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchRepos = async () => {
    try {
      const data = await api.getRepositories();
      setRepos(data);
      if (data.length > 0 && !newIssue.repoId) {
        setNewIssue(prev => ({ ...prev, repoId: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllIssues = async () => {
    try {
      const data = await api.getIssues();
      setIssues(data);
    } catch (error) {
      console.error('Error fetching issues:', error);
    }
  };

  const checkConfig = async () => {
    try {
      const config = await api.getConfig();
      setHasToken(config.hasGitHubToken);
    } catch {
      setHasToken(false);
    }
  };

  const checkRunningAgents = async () => {
    try {
      const result = await api.getRunningAgents();
      setRunningAgents(new Set(result.agents.map(a => a.repoId)));
    } catch {
      setRunningAgents(new Set());
    }
  };

  const handleCreateIssue = async () => {
    if (!newIssue.repoId || !newIssue.title.trim()) return;

    setCreating(true);
    try {
      const issue = await api.createIssue({
        repoId: newIssue.repoId,
        title: newIssue.title,
        description: newIssue.description || undefined,
        priority: newIssue.priority,
        status: 'backlog' as IssueStatus,
        labels: [],
        reporterId: 'local-user',
      });

      if (newIssue.syncToGitHub && hasToken) {
        try {
          const result = await api.syncIssueToGitHub(issue.id);
          setIssues(prev => [...prev, result.issue]);
          setMessage({ type: 'success', text: `Issue created and synced to GitHub as #${result.issue.githubIssueNumber}` });
        } catch {
          setIssues(prev => [...prev, issue]);
          setMessage({ type: 'success', text: 'Issue created (GitHub sync failed)' });
        }
      } else {
        setIssues(prev => [...prev, issue]);
        setMessage({ type: 'success', text: 'Issue created' });
      }

      setNewIssue(prev => ({ ...prev, title: '', description: '', syncToGitHub: false }));
      setShowIssueForm(false);
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const handleSyncComplete = (updatedIssue: Issue) => {
    setIssues(prev => prev.map(issue =>
      issue.id === updatedIssue.id ? updatedIssue : issue
    ));
  };

  const handleStartAgent = async (repoId: number) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo?.localPath) {
      setMessage({ type: 'error', text: 'Repository has no local path. Clone it first.' });
      return;
    }

    try {
      await api.startAgent(repoId, repo.localPath);
      setRunningAgents(prev => new Set([...prev, repoId]));
      setMessage({ type: 'success', text: `Agent started for ${repo.fullName}` });
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    }
  };

  const handleStopAgent = async (repoId: number) => {
    try {
      await api.stopAgent(repoId);
      setRunningAgents(prev => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
      setMessage({ type: 'success', text: 'Agent stopped.' });
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    }
  };

  const handleStartAllAgents = async () => {
    setStartingAllAgents(true);
    try {
      const result = await api.startAllAgents();
      const { summary } = result;

      // Update running agents set
      const newRunning = new Set(runningAgents);
      result.results.forEach(r => {
        if (r.status === 'started' || r.status === 'already_running') {
          newRunning.add(r.repoId);
        }
      });
      setRunningAgents(newRunning);

      if (summary.agentsStarted > 0) {
        setMessage({
          type: 'success',
          text: `Started ${summary.agentsStarted} agent${summary.agentsStarted !== 1 ? 's' : ''} for ${summary.totalPendingTasks} pending task${summary.totalPendingTasks !== 1 ? 's' : ''}`
        });
      } else if (summary.alreadyRunning > 0) {
        setMessage({ type: 'success', text: `All repos with tasks already have agents running` });
      } else {
        setMessage({ type: 'success', text: 'No pending tasks found across repositories' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setStartingAllAgents(false);
    }
  };

  const handleStopAllAgents = async () => {
    try {
      const result = await api.stopAllAgents();
      setRunningAgents(new Set());
      setMessage({
        type: 'success',
        text: `Stopped ${result.stoppedCount} agent${result.stoppedCount !== 1 ? 's' : ''}`
      });
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    }
  };

  const handleRepoAdded = () => {
    fetchRepos();
  };

  const handleDeleteRepo = async (repoId: number) => {
    try {
      await api.deleteRepository(repoId);
      setRepos(prev => prev.filter(r => r.id !== repoId));
      setIssues(prev => prev.filter(i => i.repoId !== repoId));
    } catch (error) {
      console.error('Error deleting repository:', error);
    }
  };

  const handleIssueUpdate = async (issueId: string, updates: Partial<Issue>) => {
    try {
      const updatedIssue = await api.updateIssue(issueId, updates);
      setIssues(prev => prev.map(issue =>
        issue.id === issueId ? updatedIssue : issue
      ));
    } catch (error) {
      console.error('Error updating issue:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '1.5rem',
        textAlign: 'center'
      }}>
        {syncing ? 'Syncing from GitHub...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1600px',
      margin: '0 auto',
      padding: '1.5rem',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Add Repo Modal */}
      <AddRepoForm
        isOpen={showAddRepoModal}
        onClose={() => setShowAddRepoModal(false)}
        onRepoAdded={handleRepoAdded}
      />

      {/* Syncing Indicator */}
      {syncing && (
        <div
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '0.5rem',
            backgroundColor: '#3b82f620',
            color: '#3b82f6',
            border: '1px solid #3b82f640',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{
            width: '12px',
            height: '12px',
            border: '2px solid #3b82f6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          Syncing issues from GitHub...
        </div>
      )}

      {/* Message Banner */}
      {message && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            backgroundColor: message.type === 'success' ? '#22c55e20' : '#ef444420',
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
            border: `1px solid ${message.type === 'success' ? '#22c55e40' : '#ef444440'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {repos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ marginBottom: '1rem' }}>No repositories yet. Add one to get started.</p>
          <button
            onClick={() => setShowAddRepoModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            + Add Repository
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {/* Main Content - Kanban Board */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Issue Actions Bar */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <button
                onClick={() => setShowIssueForm(!showIssueForm)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: showIssueForm ? '#374151' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {showIssueForm ? 'Cancel' : '+ New Issue'}
              </button>

              {/* Agent Control Buttons */}
              {runningAgents.size > 0 ? (
                <button
                  onClick={handleStopAllAgents}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    animation: 'pulse 1.5s infinite',
                  }} />
                  Stop All ({runningAgents.size})
                </button>
              ) : (
                <button
                  onClick={handleStartAllAgents}
                  disabled={startingAllAgents || issues.filter(i => i.status !== 'done' && i.agentStatus === 'pending').length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: startingAllAgents || issues.filter(i => i.status !== 'done' && i.agentStatus === 'pending').length === 0
                      ? '#9ca3af'
                      : '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: startingAllAgents || issues.filter(i => i.status !== 'done' && i.agentStatus === 'pending').length === 0
                      ? 'not-allowed'
                      : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                  title="Start agents for all repos with pending tasks"
                >
                  {startingAllAgents ? 'Starting...' : 'Start All Agents'}
                </button>
              )}

              <span style={{
                marginLeft: 'auto',
                fontSize: '0.875rem',
                color: '#6b7280',
              }}>
                {issues.length} issue{issues.length !== 1 ? 's' : ''} across {repos.length} repo{repos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Issue Creation Form */}
            {showIssueForm && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={newIssue.repoId || ''}
                    onChange={(e) => setNewIssue(prev => ({ ...prev, repoId: parseInt(e.target.value) }))}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      flex: 1,
                      minWidth: '150px',
                    }}
                  >
                    <option value="">Select repository...</option>
                    {repos.map(repo => (
                      <option key={repo.id} value={repo.id}>
                        {repo.fullName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newIssue.priority}
                    onChange={(e) => setNewIssue(prev => ({ ...prev, priority: e.target.value as IssuePriority }))}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="Issue title"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue(prev => ({ ...prev, title: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                    boxSizing: 'border-box',
                  }}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newIssue.description}
                  onChange={(e) => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                    minHeight: '60px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {hasToken && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newIssue.syncToGitHub}
                        onChange={(e) => setNewIssue(prev => ({ ...prev, syncToGitHub: e.target.checked }))}
                      />
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>Create as GitHub Issue</span>
                    </label>
                  )}

                  <button
                    onClick={handleCreateIssue}
                    disabled={creating || !newIssue.title.trim() || !newIssue.repoId}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: creating || !newIssue.title.trim() || !newIssue.repoId ? '#9ca3af' : '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: creating || !newIssue.title.trim() || !newIssue.repoId ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      marginLeft: 'auto',
                    }}
                  >
                    {creating ? 'Creating...' : 'Create Issue'}
                  </button>
                </div>
              </div>
            )}

            <KanbanBoard
              issues={issues}
              repos={repos}
              onIssueUpdate={handleIssueUpdate}
              onSyncComplete={handleSyncComplete}
            />
          </div>

          {/* Right Sidebar - Repositories */}
          <div style={{
            width: '220px',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Repositories
              </h3>
              <button
                onClick={() => setShowAddRepoModal(true)}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                + Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {repos.map(repo => {
                const repoIssueCount = issues.filter(i => i.repoId === repo.id).length;
                const isRunning = runningAgents.has(repo.id);

                return (
                  <div
                    key={repo.id}
                    style={{
                      background: 'white',
                      borderRadius: '0.375rem',
                      padding: '0.625rem',
                      border: '1px solid #e5e7eb',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.fullName?.split('/')[1] || repo.name}
                      </span>
                      <button
                        onClick={() => handleDeleteRepo(repo.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          padding: '0',
                          lineHeight: 1,
                        }}
                        title="Remove repo"
                      >
                        ×
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#6b7280' }}>
                        {repoIssueCount} issue{repoIssueCount !== 1 ? 's' : ''}
                      </span>

                      <button
                        onClick={() => isRunning ? handleStopAgent(repo.id) : handleStartAgent(repo.id)}
                        style={{
                          padding: '0.125rem 0.375rem',
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          borderRadius: '0.25rem',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: isRunning ? '#ef4444' : '#22c55e',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {isRunning && (
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            animation: 'pulse 1.5s infinite',
                          }} />
                        )}
                        {isRunning ? 'Stop' : 'Agent'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
