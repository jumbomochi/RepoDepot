import { Project } from '@repodepot/shared';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}

function ProjectSelector({ projects, selectedProjectId, onSelectProject }: ProjectSelectorProps) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#374151',
      }}>
        Select Project
      </label>
      <select
        value={selectedProjectId || ''}
        onChange={(e) => onSelectProject(e.target.value)}
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '0.5rem 1rem',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '0.875rem',
          background: 'white',
          cursor: 'pointer',
        }}
      >
        {projects.map(project => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ProjectSelector;
