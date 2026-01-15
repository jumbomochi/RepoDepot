import { useState } from 'react';

interface AddRepoFormProps {
  onRepoAdded: () => void;
}

function AddRepoForm({ onRepoAdded }: AddRepoFormProps) {
  const [repoInput, setRepoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '1rem',
      background: '#f9fafb',
      borderRadius: '8px',
      marginBottom: '1.5rem',
    }}>
      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
        Add Repository
      </h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo or GitHub URL"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
            disabled={loading}
          />
          {error && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#dc2626' }}>{error}</p>
          )}
          {success && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#16a34a' }}>{success}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !repoInput.trim()}
          style={{
            padding: '0.5rem 1rem',
            background: loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </form>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
        Examples: facebook/react, https://github.com/vercel/next.js
      </p>
    </div>
  );
}

export default AddRepoForm;
