import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Issue, IssueStatus } from '@repodepot/shared';
import DraggableIssueCard from './DraggableIssueCard';

interface KanbanColumnProps {
  title: string;
  status: IssueStatus;
  issues: Issue[];
  onIssueUpdate: (issueId: string, updates: Partial<Issue>) => void;
}

function KanbanColumn({ title, status, issues, onIssueUpdate }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? '#f0f9ff' : 'white',
        borderRadius: '8px',
        padding: '1rem',
        minHeight: '500px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '2px solid #e5e7eb',
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
        <span style={{
          background: '#f3f4f6',
          padding: '0.25rem 0.5rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}>
          {issues.length}
        </span>
      </div>

      <SortableContext
        items={issues.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {issues.map(issue => (
            <DraggableIssueCard
              key={issue.id}
              issue={issue}
              onUpdate={onIssueUpdate}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default KanbanColumn;
