import { useState } from 'react';
import { api } from '../services/api';

interface QuestionCardProps {
  taskId: string;
  taskTitle: string;
  repoName: string;
  question: {
    id: string;
    question: string;
    choices?: string[];
    askedAt: string;
  };
  onAnswered: () => void;
}

export function QuestionCard({ taskId, taskTitle, repoName, question, onAnswered }: QuestionCardProps) {
  const [customAnswer, setCustomAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnswer = async (answer: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.answerQuestion(taskId, answer);
      onAnswered();
    } catch (err) {
      console.error('Error submitting answer:', err);
      setError('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      borderLeft: '4px solid #f59e0b',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{repoName}</span>
        <h4 style={{ color: '#f1f5f9', margin: '4px 0', fontSize: '14px' }}>{taskTitle}</h4>
      </div>

      <div style={{
        background: '#334155',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '12px',
      }}>
        <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '4px' }}>Agent asks:</div>
        <div style={{ color: '#f1f5f9', fontSize: '14px' }}>{question.question}</div>
      </div>

      {question.choices && question.choices.length > 0 ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {question.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(choice)}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#3b82f6',
                color: 'white',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                fontSize: '13px',
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder="Type your answer..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #475569',
              background: '#0f172a',
              color: '#f1f5f9',
              fontSize: '13px',
            }}
          />
          <button
            onClick={() => handleAnswer(customAnswer)}
            disabled={submitting || !customAnswer.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#3b82f6',
              color: 'white',
              cursor: (submitting || !customAnswer.trim()) ? 'not-allowed' : 'pointer',
              opacity: (submitting || !customAnswer.trim()) ? 0.5 : 1,
              fontSize: '13px',
            }}
          >
            Send
          </button>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          borderRadius: '6px',
          background: '#7f1d1d',
          color: '#fca5a5',
          fontSize: '13px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
