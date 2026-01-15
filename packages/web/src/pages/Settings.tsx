import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Config {
  hasGitHubToken: boolean;
  defaultClonePath: string;
  autoFetch: boolean;
  fetchIntervalMinutes: number;
}

function Settings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [clonePathInput, setClonePathInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{
    verified: boolean;
    username?: string;
    error?: string;
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getConfig();
      setConfig(data);
      setClonePathInput(data.defaultClonePath);
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleVerifyToken = async () => {
    if (!tokenInput.trim()) return;

    setVerifying(true);
    setTokenStatus(null);
    try {
      const result = await api.testGitHubToken(tokenInput);
      setTokenStatus({
        verified: result.valid,
        username: result.username,
        error: result.error,
      });
    } catch (err) {
      setTokenStatus({
        verified: false,
        error: (err as Error).message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim() || !tokenStatus?.verified) return;

    setSaving(true);
    try {
      await api.updateConfig({ githubToken: tokenInput });
      await fetchConfig();
      setTokenInput('');
      setTokenStatus(null);
      setMessage({ type: 'success', text: 'GitHub token saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleClearToken = async () => {
    setSaving(true);
    try {
      await api.updateConfig({ githubToken: '' });
      await fetchConfig();
      setMessage({ type: 'success', text: 'GitHub token cleared' });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClonePath = async () => {
    if (!clonePathInput.trim()) return;

    setSaving(true);
    try {
      await api.updateConfig({ defaultClonePath: clonePathInput });
      await fetchConfig();
      setMessage({ type: 'success', text: 'Clone path saved' });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#f3f4f6', margin: 0, marginBottom: '2rem' }}>
        Settings
      </h1>

      {/* Message Banner */}
      {message && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            backgroundColor: message.type === 'success' ? '#22c55e20' : '#ef444420',
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
            border: `1px solid ${message.type === 'success' ? '#22c55e40' : '#ef444440'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* GitHub Token Section */}
      <div
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f3f4f6', margin: 0, marginBottom: '0.5rem' }}>
          GitHub Token
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>
          Required for fetching pull requests and issues from GitHub.
          Create a token at{' '}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3b82f6' }}
          >
            github.com/settings/tokens
          </a>{' '}
          with <code style={{ backgroundColor: '#374151', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>repo</code> scope.
        </p>

        {/* Current Status */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            backgroundColor: config?.hasGitHubToken ? '#22c55e20' : '#374151',
            border: `1px solid ${config?.hasGitHubToken ? '#22c55e40' : '#4b5563'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: config?.hasGitHubToken ? '#22c55e' : '#9ca3af' }}>
              {config?.hasGitHubToken ? 'Token configured' : 'No token configured'}
            </span>
            {config?.hasGitHubToken && (
              <button
                onClick={handleClearToken}
                disabled={saving}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Clear Token
              </button>
            )}
          </div>
        </div>

        {/* Token Input */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value);
              setTokenStatus(null);
            }}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#f3f4f6',
              fontSize: '0.875rem',
            }}
          />
          <button
            onClick={handleVerifyToken}
            disabled={!tokenInput.trim() || verifying}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: verifying ? '#4b5563' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: !tokenInput.trim() || verifying ? 'not-allowed' : 'pointer',
              opacity: !tokenInput.trim() ? 0.5 : 1,
            }}
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        {/* Verification Result */}
        {tokenStatus && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginTop: '0.75rem',
              backgroundColor: tokenStatus.verified ? '#22c55e20' : '#ef444420',
              color: tokenStatus.verified ? '#22c55e' : '#ef4444',
              border: `1px solid ${tokenStatus.verified ? '#22c55e40' : '#ef444440'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {tokenStatus.verified
                ? `Valid token for @${tokenStatus.username}`
                : tokenStatus.error || 'Invalid token'}
            </span>
            {tokenStatus.verified && (
              <button
                onClick={handleSaveToken}
                disabled={saving}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Token'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Clone Path Section */}
      <div
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '0.5rem',
          padding: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f3f4f6', margin: 0, marginBottom: '0.5rem' }}>
          Default Clone Path
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>
          Where repositories will be cloned by default. Repositories will be placed in subdirectories like{' '}
          <code style={{ backgroundColor: '#374151', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>
            {clonePathInput}/owner/repo
          </code>
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={clonePathInput}
            onChange={(e) => setClonePathInput(e.target.value)}
            placeholder="/path/to/repos"
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#f3f4f6',
              fontSize: '0.875rem',
            }}
          />
          <button
            onClick={handleSaveClonePath}
            disabled={!clonePathInput.trim() || clonePathInput === config?.defaultClonePath || saving}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor:
                !clonePathInput.trim() || clonePathInput === config?.defaultClonePath
                  ? '#4b5563'
                  : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor:
                !clonePathInput.trim() || clonePathInput === config?.defaultClonePath || saving
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
