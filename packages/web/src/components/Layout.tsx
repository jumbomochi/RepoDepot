import { Outlet, Link, useLocation } from 'react-router-dom';

function Layout() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navLinkStyle = (path: string) => ({
    color: isActive(path) ? '#3b82f6' : '#9ca3af',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: 500,
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    backgroundColor: isActive(path) ? '#1f2937' : 'transparent',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
      <header style={{
        background: '#1e293b',
        color: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #374151',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>RepoDepot</h1>

          <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link to="/" style={navLinkStyle('/')}>
              Dashboard
            </Link>
            <Link to="/activity" style={navLinkStyle('/activity')}>
              Activity
            </Link>
            <div style={{ width: '1px', height: '1.5rem', backgroundColor: '#374151', margin: '0 0.5rem' }} />
            <Link to="/settings" style={navLinkStyle('/settings')}>
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
