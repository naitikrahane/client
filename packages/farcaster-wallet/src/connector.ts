import { farcasterWeb3Provider } from './web3Provider';

export const FARCASTER_PROVIDER_INFO = {
  uuid: 'farcaster-embedded-wallet-v1',
  name: 'Farcaster Wallet',
  icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiPjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiByeD0iNTYiIGZpbGw9IiM3QzY1QzEiPjwvcmVjdD48cGF0aCBkPSJNMTgzLjI5NiA3MS42OEgyMTEuOTY4TDIwNy44NzIgOTQuMjA4SDIwMC43MDRWMTgwLjIyNEwyMDEuMDIgMTgwLjEzMkMyMDQuMjY2IDE4MC4zOTYgMjA2Ljg0OCAxODMuMDgxIDIwNi44NDggMTg2LjM6OC0xOTEuNDg4TDIwNy4xNjQgMTkxLjQ5NkMyMTAuNDEgMTkxLjY2IDIxMi45OTIgMTk0LjM0NSAyMTIuOTkyIDE5Ny42MzJWMjAyLjc1MkgxNTUuNjQ4VjE5Ny42MzJDMTU1LjY0OCAxOTQuMzQ1IDE1OC4yMjkgMTkxLjY2IDE2MS40NzYgMTkxLjQ5NkwxNjEuNzkyIDE5MS40ODhWMTg2LjM2OEMxNjEuNzkyIDE4My4wODEgMTY0LjM3MyAxODAuMzk2IDE2Ny42MiAxODAuMjcyTDE2Ny45MzYgMTgwLjIyNFYxMzguMjRDMTY3Ljk3NiAxMTYuMTg0IDE1MC4wNTYgOTguMzA0IDEyOCA5OC4zMDRDMTA1Ljk0NCA5OC4zMDQgODguMDYzOCAxMTYuMTg0IDg4LjA2MzggMTM4LjI0VjE4MC4yMjRMODguMzc5OCAxODAuMjMyQzkxLjYyNjIgMTgwLjM5NiA5NC4yMDc4IDE4My4wODEgOTQuMjA3OCAxODYuMzY4VjE5MS40ODhMOTQuNTIzOCAxOTEuNDk2Qzk7Ljc3MDIgMTkxLjY2IDEwMC4zNTIgMTk0LjM4NSAxMDAuMzUyIDE5Ny42MzJWMjAyLjc1Mkg0My4wMDc4VjE5Ny42MzJDNDMuMDA3OCAxOTQuMzQ1IDQ1LjU4OTQgMTkxLjY2IDQ4LjgzNTggMTkxLjQ5Nkw0OS4xNTE4IDE5MS40ODhWMTg2LjM2OEM0OS4xNTE4IDE4My4wODEgNTEuNzMzNCAxODAuMzk2IDU0Ljk3OTggMTgwLjIzMkw1NS4yOTU4IDE4MC4yMjRWOTQuMjA4SDQ4LjEtMjc4TDQ0LjAzMTggNzEuNjhINzIuNzAzOFY1NC4yNzJIMTgzLjI5NlY3MS42OFoiIGZpbGw9IndoaXRlIj48L3BhdGg+PC9zdmc+',
  rdns: 'xyz.farcaster',
};

export function announceFarcasterWallet() {
  if (typeof window === 'undefined') return;

  const announceEvent = new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze({
      info: FARCASTER_PROVIDER_INFO,
      provider: farcasterWeb3Provider,
    }),
  });

  window.dispatchEvent(announceEvent);

  window.addEventListener('eip6963:requestProvider', () => {
    window.dispatchEvent(announceEvent);
  });
}

// Auto-announce in browser environment
if (typeof window !== 'undefined') {
  announceFarcasterWallet();
}
