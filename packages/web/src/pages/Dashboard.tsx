import { useState, useEffect } from 'react';
import { Project, Issue } from '@repodepot/shared';
import ProjectSelector from '../components/ProjectSelector';
import KanbanBoard from '../components/KanbanBoard';

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchIssues(selectedProjectId);
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async (projectId: string) => {
    try {
      const response = await fetch(`/api/issues?projectId=${projectId}`);
      const data = await response.json();
      setIssues(data);
    } catch (error) {
      console.error('Error fetching issues:', error);
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
    return <div>Loading...</div>;
  }

  if (projects.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>No projects found</h2>
        <p>Create a project using the CLI: repodepot add-project</p>
      </div>
    );
  }

  return (
    <div>
      <ProjectSelector
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
      />
      {selectedProjectId && (
        <KanbanBoard
          issues={issues}
          onIssueUpdate={handleIssueUpdate}
        />
      )}
    </div>
  );
}

export default Dashboard;
