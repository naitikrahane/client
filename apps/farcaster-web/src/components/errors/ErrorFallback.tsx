import { FC, memo } from 'react';

import { DefaultButton } from '~/components/forms/buttons/DefaultButton';
import { getErrorDescription } from '~/utils/errorUtils';

type ErrorFallbackProps = {
  error: Error;
  resetErrorBoundary: () => void;
};

const ErrorFallback: FC<ErrorFallbackProps> = memo(
  ({ error, resetErrorBoundary }) => {
    // Automatically recover from Vite HMR chunk load errors
    if (error && error.message && error.message.includes('Failed to fetch dynamically imported module')) {
       window.location.reload();
       return null;
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 w-full h-full text-center">
        <div className="mb-4 text-red-500 font-bold text-lg">{getErrorDescription(error)}</div>
        <div className="bg-surface-secondary p-4 rounded-xl border border-red-500/30 w-full max-w-3xl mb-6 font-mono text-xs text-left overflow-x-auto text-default">
           <div className="font-bold mb-2">{String(error)}</div>
           <div className="whitespace-pre-wrap">{error?.stack || 'No stack trace'}</div>
        </div>
        <DefaultButton
          className="min-w-[140px]"
          onClick={() => {
            resetErrorBoundary();
          }}
        >
          Try again
        </DefaultButton>
      </div>
    );
  },
);

ErrorFallback.displayName = 'ErrorFallback';

export { ErrorFallback };
