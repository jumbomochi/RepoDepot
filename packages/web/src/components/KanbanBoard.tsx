import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';
import { Issue, IssueStatus } from '@repodepot/shared';
import KanbanColumn from './KanbanColumn';
import IssueCard from './IssueCard';

interface KanbanBoardProps {
  issues: Issue[];
  onIssueUpdate: (issueId: string, updates: Partial<Issue>) => void;
}

const COLUMNS: { id: IssueStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

function KanbanBoard({ issues, onIssueUpdate }: KanbanBoardProps) {
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getIssuesForColumn = (status: IssueStatus) => {
    return issues.filter(issue => issue.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const issue = issues.find(i => i.id === event.active.id);
    if (issue) {
      setActiveIssue(issue);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const newStatus = over.id as IssueStatus;
      onIssueUpdate(active.id as string, { status: newStatus });
    }

    setActiveIssue(null);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1rem',
        marginTop: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem',
      }}>
        {COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            title={column.title}
            status={column.id}
            issues={getIssuesForColumn(column.id)}
            onIssueUpdate={onIssueUpdate}
          />
        ))}
      </div>

      <DragOverlay>
        {activeIssue ? (
          <IssueCard issue={activeIssue} onUpdate={onIssueUpdate} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;
