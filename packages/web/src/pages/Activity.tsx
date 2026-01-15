import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface ActivitySummary {
  totalCommitsThisWeek: number;
  totalPRsMerged: number;
  activeContributors: number;
  recentActivity: {
    type: 'commit' | 'pr_merged' | 'issue_opened' | 'issue_closed';
    repoFullName: string;
    title: string;
    author: string;
    timestamp: string;
    url?: string;
  }[];
}

interface Repository {
  id: number;
  name: string;
  fullName: string;
}

interface RepoActivity {
  repoId: number;
  repoFullName: string;
  recentCommits: {
    hash: string;
    hashShort: string;
    author: string;
    authorEmail: string;
    message: string;
    date: string;
  }[];
  commitsThisWeek: number;
  topContributors: {
    login: string;
    avatarUrl: string;
    contributions: number;
  }[];
  openIssues: number;
  openPRs: number;
}

function Activity() {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [repoActivity, setRepoActivity] = useState<RepoActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [repoLoading, setRepoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryData, reposData] = await Promise.all([
          api.getActivitySummary(),
          api.getRepositories(),
        ]);
        setSummary(summaryData);
        setRepositories(reposData);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      const fetchRepoActivity = async () => {
        setRepoLoading(true);
        try {
          const data = await api.getRepoActivity(selectedRepoId);
          setRepoActivity(data);
        } catch (err) {
          console.error('Error fetching repo activity:', err);
          setRepoActivity(null);
        } finally {
          setRepoLoading(false);
        }
      };

      fetchRepoActivity();
    } else {
      setRepoActivity(null);
    }
  }, [selectedRepoId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'commit':
        return '>';
      case 'pr_merged':
        return '<>';
      case 'issue_opened':
        return '+';
      case 'issue_closed':
        return 'x';
      default:
        return '*';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        Loading activity...
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
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#f3f4f6', margin: 0, marginBottom: '2rem' }}>
        Activity Dashboard
      </h1>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#3b82f6' }}>
            {summary?.totalCommitsThisWeek || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Commits This Week
          </div>
        </div>

        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#22c55e' }}>
            {summary?.totalPRsMerged || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            PRs Merged
          </div>
        </div>

        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#8b5cf6' }}>
            {summary?.activeContributors || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Active Contributors
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Recent Activity Feed */}
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f3f4f6', margin: 0, marginBottom: '1rem' }}>
            Recent Activity
          </h2>

          {summary?.recentActivity && summary.recentActivity.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {summary.recentActivity.slice(0, 10).map((activity, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: '#374151',
                    borderRadius: '0.375rem',
                  }}
                >
                  <span style={{
                    color: activity.type === 'commit' ? '#3b82f6' :
                           activity.type === 'pr_merged' ? '#22c55e' :
                           activity.type === 'issue_opened' ? '#f59e0b' : '#ef4444',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    minWidth: '1.5rem',
                  }}>
                    {getActivityIcon(activity.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#f3f4f6',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {activity.title}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      marginTop: '0.25rem',
                    }}>
                      {activity.author} in {activity.repoFullName}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatDate(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              No recent activity
            </div>
          )}
        </div>

        {/* Per-Repository Activity */}
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f3f4f6', margin: 0, marginBottom: '1rem' }}>
            Repository Activity
          </h2>

          <select
            value={selectedRepoId || ''}
            onChange={(e) => setSelectedRepoId(e.target.value ? parseInt(e.target.value, 10) : null)}
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#f3f4f6',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            <option value="">Select a repository...</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
          </select>

          {repoLoading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
              Loading...
            </div>
          ) : repoActivity ? (
            <div>
              {/* Repo Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}>
                <div style={{
                  backgroundColor: '#374151',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#3b82f6' }}>
                    {repoActivity.commitsThisWeek}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Commits/Week</div>
                </div>
                <div style={{
                  backgroundColor: '#374151',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f59e0b' }}>
                    {repoActivity.openIssues}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Open Issues</div>
                </div>
                <div style={{
                  backgroundColor: '#374151',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#22c55e' }}>
                    {repoActivity.openPRs}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Open PRs</div>
                </div>
                <div style={{
                  backgroundColor: '#374151',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#8b5cf6' }}>
                    {repoActivity.topContributors.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Contributors</div>
                </div>
              </div>

              {/* Top Contributors */}
              {repoActivity.topContributors.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.5rem' }}>
                    Top Contributors
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {repoActivity.topContributors.slice(0, 5).map((contributor) => (
                      <div
                        key={contributor.login}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          backgroundColor: '#374151',
                          borderRadius: '9999px',
                          padding: '0.25rem 0.75rem 0.25rem 0.25rem',
                        }}
                      >
                        {contributor.avatarUrl && (
                          <img
                            src={contributor.avatarUrl}
                            alt={contributor.login}
                            style={{
                              width: '1.5rem',
                              height: '1.5rem',
                              borderRadius: '50%',
                            }}
                          />
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#f3f4f6' }}>
                          {contributor.login}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          ({contributor.contributions})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Commits */}
              {repoActivity.recentCommits.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.5rem' }}>
                    Recent Commits
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {repoActivity.recentCommits.slice(0, 5).map((commit) => (
                      <div
                        key={commit.hash}
                        style={{
                          backgroundColor: '#374151',
                          borderRadius: '0.375rem',
                          padding: '0.5rem 0.75rem',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.25rem',
                        }}>
                          <code style={{
                            fontSize: '0.75rem',
                            color: '#3b82f6',
                            backgroundColor: '#1f2937',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                          }}>
                            {commit.hashShort}
                          </code>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {formatDate(commit.date)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.8125rem',
                          color: '#f3f4f6',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {commit.message.split('\n')[0]}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          by {commit.author}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              Select a repository to view activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Activity;
