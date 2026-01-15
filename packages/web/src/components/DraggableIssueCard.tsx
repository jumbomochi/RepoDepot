import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Issue } from '@repodepot/shared';
import IssueCard from './IssueCard';

interface DraggableIssueCardProps {
  issue: Issue;
  onUpdate: (issueId: string, updates: Partial<Issue>) => void;
  onSyncComplete?: (issue: Issue) => void;
  repoName?: string;
}

function DraggableIssueCard({ issue, onUpdate, onSyncComplete, repoName }: DraggableIssueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <IssueCard issue={issue} onUpdate={onUpdate} onSyncComplete={onSyncComplete} repoName={repoName} />
    </div>
  );
}

export default DraggableIssueCard;
