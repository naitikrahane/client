import { memo } from 'react';

import { BorderedMainContent } from '~/components/BorderedMainContent';
import { Page } from '~/components/page/Page';
import { PageHeader } from '~/components/page/PageHeader';
import { PageTitle } from '~/components/page/PageTitle';

import { WalletUI } from '~/wallet/WalletUI';

const WalletPage = memo(() => {
  return (
    <Page meta={{ title: 'Wallet / Farcaster' }}>
      <div className="border-default sm:border-x">
        <PageHeader hideCastButton>
          <div className="flex items-center">
            <PageTitle>Wallet</PageTitle>
          </div>
        </PageHeader>
      </div>
      <BorderedMainContent className="flex flex-col items-center w-full min-h-screen p-6">
        <WalletUI />
      </BorderedMainContent>
    </Page>
  );
});

WalletPage.displayName = 'WalletPage';

export { WalletPage };
