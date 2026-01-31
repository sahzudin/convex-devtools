import { useState } from 'react';
import { useRequestStore } from '../stores/request-store';

export function ResponsePanel() {
  const { response, isLoading, selectedFunction } = useRequestStore();
  const [searchQuery, setSearchQuery] = useState('');

  if (!selectedFunction) {
    return null;
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full text-gray-500'>
        <div className='flex items-center gap-2'>
          <svg className='animate-spin w-5 h-5' viewBox='0 0 24 24'>
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
              fill='none'
            />
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            />
          </svg>
          Executing...
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className='flex items-center justify-center h-full text-gray-500'>
        <div className='text-center'>
          <p>Response will appear here after running the function</p>
        </div>
      </div>
    );
  }

  const formatJson = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const syntaxHighlight = (json: string): string => {
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  const highlightSearch = (html: string, query: string): string => {
    if (!query.trim()) return html;
    try {
      // Escape special regex chars
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Only highlight text outside of HTML tags
      const regex = new RegExp(`(${escaped})(?![^<]*>)`, 'gi');
      return html.replace(
        regex,
        '<mark class="bg-yellow-300 text-black rounded px-0.5">$1</mark>'
      );
    } catch {
      return html;
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(
        formatJson(response.success ? response.result : response.error)
      );
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Check if the response indicates an error - either from response.success or from result.status
  const isError =
    !response.success ||
    (response.success &&
      response.result &&
      typeof response.result === 'object' &&
      (response.result as Record<string, unknown>)?.status === 'error');

  return (
    <div className='flex flex-col h-full'>
      {/* Header - Compact */}
      <div className='flex items-center justify-between px-3 py-1.5 border-b border-convex-border'>
        <div className='flex items-center gap-2'>
          {!isError ? (
            <span className='flex items-center gap-1.5 text-green-400 text-sm'>
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              Success
            </span>
          ) : (
            <span className='flex items-center gap-1.5 text-red-400 text-sm'>
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              Error
            </span>
          )}

          {response.duration !== undefined && (
            <span className='text-sm text-gray-500'>{response.duration}ms</span>
          )}

          <span className='text-sm text-gray-600'>
            {new Date(response.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className='flex items-center gap-2'>
          {/* Search inline */}
          <div className='relative'>
            <svg
              className='absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
            <input
              type='text'
              placeholder='Search...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-40 bg-convex-darker border border-convex-border rounded-md pl-8 pr-2 py-1 text-xs focus:outline-none focus:border-convex-accent'
            />
          </div>

          <button
            onClick={copyToClipboard}
            className='p-2 text-gray-400 hover:text-white hover:bg-convex-border rounded transition-colors'
            title='Copy to clipboard'
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Response Body */}
      <div className='flex-1 overflow-auto p-4'>
        {response.success ? (
          <pre
            className='font-mono text-sm whitespace-pre-wrap break-words'
            dangerouslySetInnerHTML={{
              __html: highlightSearch(
                syntaxHighlight(formatJson(response.result)),
                searchQuery
              ),
            }}
          />
        ) : (
          <div className='space-y-3'>
            <div className='bg-red-900/20 border border-red-800 rounded-lg p-4'>
              <div className='flex items-start gap-3'>
                <svg
                  className='w-5 h-5 text-red-400 flex-shrink-0 mt-0.5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                <div>
                  <p className='text-red-700 dark:text-red-300 font-medium'>
                    {response.error?.message}
                  </p>
                  {response.error?.code && (
                    <p className='text-red-600 dark:text-red-400 text-sm mt-1'>
                      Code: {response.error.code}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {response.error?.data !== undefined &&
              response.error.data !== null && (
                <div>
                  <p className='text-sm text-gray-400 mb-2'>Error Details:</p>
                  <pre
                    className='font-mono text-sm whitespace-pre-wrap break-words bg-convex-darker border border-convex-border rounded-lg p-4'
                    dangerouslySetInnerHTML={{
                      __html: syntaxHighlight(
                        formatJson(
                          response.error.data as Record<string, unknown>
                        )
                      ),
                    }}
                  />
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
