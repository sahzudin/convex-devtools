import { useState } from 'react';
import { useRequestStore } from '../stores/request-store';

interface AuthPanelProps {
  onClose: () => void;
}

export function AuthPanel({ onClose }: AuthPanelProps) {
  const { jwtToken, setJwtToken } = useRequestStore();
  const [tokenInput, setTokenInput] = useState(jwtToken);
  const [decodedPayload, setDecodedPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Decode JWT to show the payload
  const decodeJwt = (token: string) => {
    if (!token) {
      setDecodedPayload(null);
      setDecodeError(null);
      return;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        setDecodeError(
          'Invalid JWT format (should have 3 parts separated by dots)'
        );
        setDecodedPayload(null);
        return;
      }

      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]));
      setDecodedPayload(payload);
      setDecodeError(null);
    } catch (e) {
      setDecodeError('Failed to decode JWT');
      setDecodedPayload(null);
    }
  };

  const handleTokenChange = (value: string) => {
    setTokenInput(value);
    decodeJwt(value);
  };

  const applyToken = () => {
    setJwtToken(tokenInput.trim());
  };

  const clearToken = () => {
    setTokenInput('');
    setJwtToken('');
    setDecodedPayload(null);
    setDecodeError(null);
  };

  // Check if token is expired
  const isExpired = decodedPayload?.exp
    ? (decodedPayload.exp as number) * 1000 < Date.now()
    : false;

  return (
    <div className='w-96 border-l border-convex-border flex flex-col bg-convex-darker'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-convex-border'>
        <h2 className='font-semibold flex items-center gap-2'>
          <svg
            className='w-5 h-5 text-green-400'
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
          Authentication
        </h2>
        <button
          onClick={onClose}
          className='p-1 text-gray-400 hover:text-white transition-colors'
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
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className='p-4 bg-blue-900/20 border-b border-convex-border'>
        <p className='text-xs text-blue-300'>
          Paste a JWT token from your auth provider (Clerk, Auth0, etc.) to
          authenticate requests as that user.
        </p>
        <p className='text-xs text-gray-400 mt-2'>
          <strong>How to get your token (Clerk):</strong>
          <br />
          • Open your app in the browser console
          <br />• Run:{' '}
          <code className='bg-convex-dark px-1 rounded'>
            await window.Clerk?.session?.getToken({`{ template: "convex" }`})
          </code>
          <br />• Paste the returned JWT here
        </p>
        <p className='text-xs text-gray-400 mt-2'>
          For Convex Auth: use the{' '}
          <code className='bg-convex-dark px-1 rounded'>__convexAuthJWT_*</code>{' '}
          value from cookies/localStorage.
        </p>
      </div>

      {/* Token Input */}
      <div className='flex-1 p-4 space-y-4 overflow-auto'>
        <div>
          <label className='block text-xs text-gray-400 mb-2'>JWT Token</label>
          <textarea
            value={tokenInput}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder='eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
            rows={6}
            className='w-full bg-convex-dark border border-convex-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-convex-accent resize-none'
            spellCheck={false}
          />
        </div>

        {/* Token Status */}
        {tokenInput && (
          <div
            className={`p-3 rounded border ${
              decodeError
                ? 'bg-red-900/20 border-red-800'
                : isExpired
                  ? 'bg-yellow-900/20 border-yellow-800'
                  : 'bg-green-900/20 border-green-800'
            }`}
          >
            {decodeError ? (
              <p className='text-xs text-red-400'>{decodeError}</p>
            ) : isExpired ? (
              <p className='text-xs text-yellow-400'>
                ⚠️ Token is expired! Get a fresh one from your app.
              </p>
            ) : (
              <p className='text-xs text-green-400'>✓ Valid JWT token</p>
            )}
          </div>
        )}

        {/* Decoded Payload */}
        {decodedPayload && (
          <div>
            <label className='block text-xs text-gray-400 mb-2'>
              Decoded Payload
            </label>
            <div className='bg-convex-dark border border-convex-border rounded p-3 max-h-48 overflow-auto'>
              <pre className='text-xs text-gray-300 font-mono whitespace-pre-wrap'>
                {JSON.stringify(decodedPayload, null, 2)}
              </pre>
            </div>
            {decodedPayload.sub ? (
              <p className='text-xs text-gray-500 mt-2'>
                Subject:{' '}
                <span className='text-gray-300'>
                  {String(decodedPayload.sub)}
                </span>
              </p>
            ) : null}
            {decodedPayload.exp ? (
              <p className='text-xs text-gray-500'>
                Expires:{' '}
                <span className={isExpired ? 'text-red-400' : 'text-gray-300'}>
                  {new Date(
                    (decodedPayload.exp as number) * 1000
                  ).toLocaleString()}
                </span>
              </p>
            ) : null}
          </div>
        )}

        {/* Current Status */}
        <div className='pt-4 border-t border-convex-border'>
          <label className='block text-xs text-gray-400 mb-2'>
            Current Auth Status
          </label>
          <div
            className={`p-3 rounded ${jwtToken ? 'bg-green-900/20' : 'bg-gray-800'}`}
          >
            {jwtToken ? (
              <div className='flex items-center gap-2 text-sm text-green-400'>
                <span className='w-2 h-2 bg-green-400 rounded-full'></span>
                Authenticated
              </div>
            ) : (
              <div className='flex items-center gap-2 text-sm text-gray-400'>
                <span className='w-2 h-2 bg-gray-500 rounded-full'></span>
                No authentication
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className='p-4 border-t border-convex-border space-y-2'>
        <button
          onClick={applyToken}
          disabled={!tokenInput || !!decodeError}
          className={`w-full py-2 rounded text-sm font-medium transition-colors ${
            !tokenInput || decodeError
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          Apply Token
        </button>
        <button
          onClick={clearToken}
          className='w-full py-2 bg-convex-border hover:bg-gray-600 rounded text-sm transition-colors'
        >
          Clear (No Auth)
        </button>
      </div>
    </div>
  );
}
