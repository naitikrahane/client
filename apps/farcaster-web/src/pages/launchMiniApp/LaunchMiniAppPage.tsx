import {
  useFrameDetails,
  useGloballyCachedFrame,
} from 'farcaster-client-hooks';
import React from 'react';

import { MiniApp } from '~/components/miniApp/MiniApp';
import { FullScreenLoadingIndicator } from '~/components/loaders/FullScreenLoadingIndicator';
import { useNavigate } from '~/hooks/navigation/useNavigate';
import { useParams } from '~/hooks/navigation/useParams';
import { useSearchParams } from '~/hooks/navigation/useSearchParams';

const LaunchMiniAppPage: React.FC = React.memo(() => {
  const navigate = useNavigate();

  const {
    domain: domainParam,
    url,
  } = useSearchParams('launchMiniApp');
  const { id } = useParams('miniAppsCanonical');

  const domain = (() => {
    if (url) {
      try {
        return new URL(url).hostname;
      } catch {
        return domainParam;
      }
    }
    return domainParam;
  })();

  const { data } = useFrameDetails({
    domain: id ? undefined : domain,
    id,
  });
  const frame = useGloballyCachedFrame(data);

  const launchUrl = url ?? frame?.homeUrl;

  const handleClose = React.useCallback(() => {
    navigate({
      to: 'homeFeed',
      params: {},
      searchParams: {},
    });
  }, [navigate]);

  if (!launchUrl) {
    return <FullScreenLoadingIndicator />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app">
      <div className="flex-1">
        <MiniApp
          launchConfig={{
            type: 'standalone',
            url: launchUrl,
            name: frame?.name || domain || 'Mini App',
            splashImageUrl: frame?.splashImageUrl,
            splashBackgroundColor: frame?.splashBackgroundColor,
          }}
          context={{ type: 'dev_preview' }}
          onClose={handleClose}
        />
      </div>
    </div>
  );
});

LaunchMiniAppPage.displayName = 'LaunchMiniAppPage';

export { LaunchMiniAppPage };
