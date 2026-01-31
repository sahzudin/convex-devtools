import { useState, useEffect } from 'react';
import { FunctionTree } from './components/FunctionTree';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { CollectionsSidebar } from './components/CollectionsSidebar';
import { AuthPanel } from './components/AuthPanel';
import { useSchemaStore } from './stores/schema-store';
import { useRequestStore } from './stores/request-store';
import { usePersistenceStore } from './stores/persistence-store';

function App() {
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [showCollections, setShowCollections] = useState(true);
  const [convexUrl, setConvexUrl] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as
        | 'light'
        | 'dark'
        | 'system'
        | null;
      return stored || 'system';
    }
    return 'system';
  });
  const { connect, isConnected, schema, error } = useSchemaStore();
  const {
    selectedFunction,
    setSelectedFunction,
    jwtToken,
    setJwtToken,
    setProjectName: setProjectNameInStore,
    recentTabs,
    removeFromRecentTabs,
  } = useRequestStore();
  const { loadFromStorage, loadSavedToken } = usePersistenceStore();

  // Compute the actual theme based on system preference
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Compute actual theme
  const actualTheme =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    connect();
    void loadFromStorage();
    // Load saved JWT token
    const savedToken = loadSavedToken();
    if (savedToken && !jwtToken) {
      setJwtToken(savedToken);
    }
    // Fetch the convex URL from the health endpoint
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.convexUrl) {
          setConvexUrl(data.convexUrl);
        }
        if (data.projectName) {
          setProjectName(data.projectName);
          setProjectNameInStore(data.projectName);
        }
      })
      .catch(() => {});
  }, [connect, loadFromStorage, loadSavedToken, setJwtToken, jwtToken]);

  // Reload persistence when window regains focus to sync across instances
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[DevTools] Tab visible, reloading persistence...');
        void loadFromStorage();
      }
    };
    const handleFocus = () => {
      console.log('[DevTools] Window focused, reloading persistence...');
      void loadFromStorage();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadFromStorage]);

  useEffect(() => {
    if (actualTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    try {
      localStorage.setItem('theme', theme);
    } catch {}
  }, [actualTheme, theme]);

  // Extract deployment name from convexUrl (e.g. "https://festive-dotterel-544.convex.cloud" -> "festive-dotterel-544")
  const deploymentName = convexUrl
    ? new URL(convexUrl).hostname.replace('.convex.cloud', '')
    : '';
  const envLabel = convexUrl?.includes('convex.cloud')
    ? 'Development (Cloud)'
    : 'Development (Local)';

  return (
    <div className='h-screen flex flex-col bg-convex-dark text-white'>
      {/* Header */}
      <header className='h-14 border-b border-convex-border flex items-center justify-between px-4 flex-shrink-0'>
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 bg-convex-accent rounded-lg flex items-center justify-center'>
            <span className='text-white font-bold text-sm'>C</span>
          </div>
          <h1 className='text-lg font-semibold'>Convex DevTools</h1>
          <span className='text-xs px-2 py-0.5 bg-convex-border rounded text-gray-400'>
            v0.1.0
          </span>
          <span className='ml-2 text-xs px-3 py-1 rounded-full border border-convex-border text-gray-300 bg-convex-darker flex items-center gap-2'>
            <svg
              className='w-4 h-4 text-green-400'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
            >
              <circle cx='12' cy='12' r='10' strokeWidth='2' />
            </svg>
            {projectName ? `${projectName} • ` : ''}
            {envLabel} • {deploymentName || 'loading...'}
          </span>
        </div>

        <div className='flex items-center gap-4'>
          {isConnected ? (
            <span className='flex items-center gap-2 text-sm text-green-400'>
              <span className='w-2 h-2 bg-green-400 rounded-full animate-pulse' />
              Connected
            </span>
          ) : error ? (
            <span className='flex items-center gap-2 text-sm text-red-400'>
              <span className='w-2 h-2 bg-red-400 rounded-full' />
              {error}
            </span>
          ) : (
            <span className='flex items-center gap-2 text-sm text-yellow-400'>
              <span className='w-2 h-2 bg-yellow-400 rounded-full animate-pulse' />
              Connecting...
            </span>
          )}

          <button
            onClick={() => {
              // Cycle through: system -> light -> dark -> system
              if (theme === 'system') setTheme('light');
              else if (theme === 'light') setTheme('dark');
              else setTheme('system');
            }}
            className='p-2 rounded hover:bg-convex-border transition-colors text-gray-400'
            title={`Theme: ${theme} (click to change)`}
          >
            {theme === 'system' ? (
              // Computer/monitor icon for system theme
              <svg
                className='w-5 h-5'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
              >
                <rect
                  x='2'
                  y='3'
                  width='20'
                  height='14'
                  rx='2'
                  strokeWidth={2}
                />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M8 21h8M12 17v4'
                />
              </svg>
            ) : actualTheme === 'light' ? (
              <svg
                className='w-5 h-5'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'
                />
              </svg>
            ) : (
              <svg
                className='w-5 h-5'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
              >
                <circle cx='12' cy='12' r='5' strokeWidth={2} />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42'
                />
              </svg>
            )}
          </button>

          <button
            onClick={() => setShowCollections(!showCollections)}
            className={`p-2 rounded hover:bg-convex-border transition-colors ${
              showCollections ? 'text-convex-accent' : 'text-gray-400'
            }`}
            title='Toggle Collections'
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
              />
            </svg>
          </button>

          <button
            onClick={() => setShowAuthPanel(!showAuthPanel)}
            className={`p-2 rounded hover:bg-convex-border transition-colors ${
              showAuthPanel
                ? 'text-convex-accent'
                : jwtToken
                  ? 'text-green-400'
                  : 'text-gray-400'
            }`}
            title={
              jwtToken ? 'Authenticated (click to manage)' : 'Authentication'
            }
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Collections Sidebar */}
        {showCollections && (
          <CollectionsSidebar onClose={() => setShowCollections(false)} />
        )}

        {/* Function Tree */}
        <div className='w-72 border-r border-convex-border flex-shrink-0 overflow-auto'>
          <FunctionTree
            schema={schema}
            selectedFunction={selectedFunction}
            onSelectFunction={setSelectedFunction}
          />
        </div>

        {/* Main Area */}
        <div className='flex-1 flex flex-col min-w-0'>
          {/* Recent Tabs Bar */}
          {recentTabs.length > 0 && (
            <div className='flex items-center gap-1 px-2 py-1 bg-convex-darker border-b border-convex-border overflow-x-auto flex-shrink-0'>
              {recentTabs.map((tab) => {
                const isActive = selectedFunction?.path === tab.path;
                const typeColor =
                  tab.type === 'query'
                    ? 'text-blue-400'
                    : tab.type === 'mutation'
                      ? 'text-orange-400'
                      : 'text-purple-400';
                return (
                  <div
                    key={tab.path}
                    className={`flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-gray-300 dark:bg-convex-border text-gray-900 dark:text-white'
                        : 'hover:bg-gray-200 dark:hover:bg-convex-border/50 text-gray-600 dark:text-gray-400'
                    }`}
                    title={tab.path}
                  >
                    <button
                      onClick={() => setSelectedFunction(tab)}
                      className='flex items-center gap-1 truncate max-w-[150px]'
                    >
                      <span
                        className={`font-semibold flex-shrink-0 ${typeColor}`}
                      >
                        {tab.type.charAt(0).toUpperCase()}
                      </span>
                      <span className='truncate'>{tab.name}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromRecentTabs(tab.path);
                      }}
                      className='p-0.5 rounded hover:bg-convex-dark text-gray-500 hover:text-white transition-colors flex-shrink-0'
                      title='Close tab'
                    >
                      <svg
                        className='w-3 h-3'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Request Panel */}
          <div className='h-1/2 border-b border-convex-border overflow-auto'>
            <RequestPanel />
          </div>

          {/* Response Panel */}
          <div className='h-1/2 overflow-auto'>
            <ResponsePanel />
          </div>
        </div>

        {/* Auth Panel Sidebar */}
        {showAuthPanel && <AuthPanel onClose={() => setShowAuthPanel(false)} />}
      </div>
    </div>
  );
}

export default App;
