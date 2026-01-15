import { useState, useEffect } from 'react';

interface AddRepoFormProps {
  isOpen: boolean;
  onClose: () => void;
  onRepoAdded: () => void;
}

function AddRepoForm({ isOpen, onClose, onRepoAdded }: AddRepoFormProps) {
  const [repoInput, setRepoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRepoInput('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const parseRepoInput = (input: string): { owner: string; name: string } | null => {
    const trimmed = input.trim();

    // Handle GitHub URL format
    const urlMatch = trimmed.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
    if (urlMatch) {
      return { owner: urlMatch[1], name: urlMatch[2].replace('.git', '') };
    }

    // Handle owner/repo format
    const slashMatch = trimmed.match(/^([^\/\s]+)\/([^\/\s]+)$/);
    if (slashMatch) {
      return { owner: slashMatch[1], name: slashMatch[2] };
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      setError('Invalid format. Use "owner/repo" or a GitHub URL');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: parsed.name,
          fullName: `${parsed.owner}/${parsed.name}`,
          cloneUrl: `https://github.com/${parsed.owner}/${parsed.name}.git`,
          defaultBranch: 'main',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add repository');
      }

      setSuccess(`Added ${parsed.owner}/${parsed.name}`);
      setRepoInput('');
      onRepoAdded();

      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '400px',
          margin: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
            Add Repository
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '0',
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo or GitHub URL"
            autoFocus
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
              boxSizing: 'border-box',
            }}
            disabled={loading}
          />

          <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: '#6b7280' }}>
            Examples: facebook/react, https://github.com/vercel/next.js
          </p>

          {error && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#dc2626' }}>{error}</p>
          )}
          {success && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#16a34a' }}>{success}</p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !repoInput.trim()}
              style={{
                padding: '0.5rem 1rem',
                background: loading ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: loading || !repoInput.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Adding...' : 'Add Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRepoForm;
