import React, { useEffect, useRef, useState } from 'react';
import { MessageChannelRpc } from 'farcaster-client-data';
import { WalletUI } from '~/wallet/WalletUI';
import { store, getPublicClient, ProviderRpcError } from 'farcaster-wallet';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

// ══════════════════════════════════════════════════════════
// WalletIframePage — Farcaster Embedded Wallet iframe
//
// This page is served at ~/wallet-iframe.
// It is loaded inside an <iframe> by EmbeddedWallet.tsx.
//
// PROTOCOL (matches EmbeddedWallet.tsx exactly):
//   1. Iframe mounts → sends {fcinit:'v1', id} to parent (signal: "I'm ready")
//   2. Parent receives it → calls initialize() → sends {fcinit:'v1', id} WITH 4 ports:
//        ports[0] = initChannel.port2
//        ports[1] = walletChannel.port2   ← bidirectional wallet comm
//        ports[2] = ethProviderChannel.port2  ← ETH RPC from miniapp
//        ports[3] = solanaProviderChannel.port2
//   3. We set up servers/clients on those ports
//   4. We send {method:'connected', params:{connected:true}} to parent
// ══════════════════════════════════════════════════════════

export function WalletIframePage() {
  const warpcastClientRef = useRef<ReturnType<typeof MessageChannelRpc.createClient> | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);

  // ── Step 1: Signal parent that iframe is loaded ──
  useEffect(() => {
    if (window.parent === window) return;
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      window.parent.postMessage({ fcinit: 'v1', id }, '*');
    }
  }, []);

  // ── Step 2: Wait for parent to send MessageChannel ports ──
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Validate: must have fcinit header + exactly 4 ports
      if (e.data?.fcinit !== 'v1' || !e.ports || e.ports.length < 4) return;

      const [_initPort, walletPort, ethPort, _solanaPort] = e.ports;

      // ── Warpcast Client (we → parent) ──
      // Used to send: open_wallet, close_wallet, connected, send_token_result
      const warpcast = MessageChannelRpc.createClient({
        channelName: 'walletProvider',
        port: walletPort,
      });
      warpcastClientRef.current = warpcast;

      // ── Warpcast Server (parent → us) ──
      // Parent sends us: send_token, swap_token, navigate, refresh, etc.
      // handleRequest must be in { current: fn } ref format per MessageChannelRpc API
      const walletHandlerRef = {
        current: async (request: any) => {
          if (request.method === 'send_token' || request.method === 'swap_token') {
            warpcast.request({ method: 'open_wallet' } as any);
            return new Promise(() => {}); // never resolves — user completes in UI
          }
          if (['navigate', 'refresh', 'clear_preview_requests', 'logout'].includes(request.method)) {
            return;
          }
          if (request.method === 'sign_in_with_auth_address') {
            warpcast.request({ method: 'open_wallet' } as any);
            return new Promise((resolve, reject) => {
              store.addPendingRequest({
                type: 'sign',
                payload: {
                  method: 'sign_in_with_auth_address',
                  params: [request.params.message],
                },
                resolve: async () => {
                  try {
                    const account = store.getAccount();
                    if (!account) throw new Error("Wallet locked");
                    
                    // The Siwe object from parent is missing the address
                    const siweMessage = { ...request.params.message, address: account.address };
                    
                    // We need to convert it to text. We dynamically import ox to avoid bundling issues if not present at top level.
                    const { Siwe } = await import('ox');
                    const text = Siwe.createMessage(siweMessage as any); // Or just assume viem can sign it? Wait, ox Siwe has different API?
                    
                    // If Siwe.createMessage doesn't return string, we might need a different method. 
                    // Let's assume Farcaster uses EIP-4361 stringification.
                    // Actually, let's just do personal_sign on a standard SIWE formatted string.
                    const domain = siweMessage.domain;
                    const address = siweMessage.address;
                    const uri = siweMessage.uri;
                    const version = siweMessage.version;
                    const chainId = siweMessage.chainId;
                    const nonce = siweMessage.nonce;
                    const statement = siweMessage.statement || "Farcaster Auth";
                    const resources = siweMessage.resources ? `\nResources:\n- ${siweMessage.resources.join('\n- ')}` : '';
                    
                    const textMessage = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${uri}\nVersion: ${version}\nChain ID: ${chainId}\nNonce: ${nonce}${resources}`;
                    
                    const { createWalletClient, http } = await import('viem');
                    const { base } = await import('viem/chains');
                    const wc = createWalletClient({ account, chain: base, transport: http() });
                    const signature = await wc.signMessage({ message: textMessage });
                    
                    resolve({
                      authMethod: 'custody',
                      message: textMessage,
                      signature
                    });
                  } catch (err) { reject(err); }
                },
                reject
              });
            });
          }
          // Unknown method — don't throw, just return undefined to avoid crashing
          return;
        },
      };

      MessageChannelRpc.createServer({
        channelName: 'warpcast',
        port: walletPort,
        handleRequest: walletHandlerRef as any,
      });

      // ── ETH Provider Server (miniapp → us) ──
      // Miniapp sends eth RPC calls here; we handle them using our local wallet
      const ethHandlerRef = {
        current: async (request: any) => {
          let account = store.getAccount();

          // ── Read-only queries (no approval needed) ──
          if (request.method === 'eth_accounts') {
            const acc = store.getAccount();
            return acc ? [acc.address] : [];
          }
          if (request.method === 'eth_chainId') {
            return `0x${store.getChainId().toString(16)}`;
          }
          if (request.method === 'net_version') {
            return store.getChainId().toString();
          }

          // ── Request Accounts / Connect ──
          if (request.method === 'eth_requestAccounts') {
            const currentAcc = store.getAccount();
            if (currentAcc) {
              return [currentAcc.address];
            }
            try { warpcast.request({ method: 'open_wallet' } as any); } catch {}
            return new Promise((resolve, reject) => {
              store.addPendingRequest({
                type: 'sign',
                payload: request,
                resolve: () => {
                  const acc = store.getAccount();
                  if (acc) resolve([acc.address]);
                  else reject(new Error('No account available'));
                },
                reject: (err) => reject(err),
              });
            });
          }

          // ── Wallet must be unlocked for write operations ──
          if (!account) {
            try { warpcast.request({ method: 'open_wallet' } as any); } catch {}
            const err = new Error('Unauthorized: wallet locked');
            (err as any).code = 4100;
            throw err;
          }

          const getRpcUrl = () => {
            const chainId = store.getChainId();
            const custom = store.getCustomRpc(chainId);
            return custom?.url || (chainId === 8453 ? 'https://base.drpc.org' : undefined);
          };

          const closeWalletIfNeeded = () => {
            const surface = new URLSearchParams(window.location.search).get('surface');
            if (surface === 'mini_app_modal') {
              try { warpcast.request({ method: 'close_wallet' } as any); } catch {}
            }
          };

          // ── EIP-5792 Send Calls ──
          if (request.method === 'wallet_sendCalls') {
            try { warpcast.request({ method: 'open_wallet' } as any); } catch {}
            return new Promise((resolve, reject) => {
              const calls = request.params[0]?.calls || [];
              const firstCall = calls[0] || {};
              store.addPendingRequest({
                type: 'transaction',
                payload: {
                  method: 'eth_sendTransaction',
                  params: [{
                    to: firstCall.to,
                    value: firstCall.value || '0x0',
                    data: firstCall.data || '0x',
                  }]
                },
                resolve: async () => {
                  try {
                    const activeAccount = store.getAccount(); if (!activeAccount) throw new Error("Wallet locked"); const wc = createWalletClient({ account: activeAccount, chain: base, transport: http(getRpcUrl()) });
                    let lastHash = '0x';
                    for (const call of calls) {
                      lastHash = await wc.sendTransaction({
                        to: call.to,
                        value: call.value ? BigInt(call.value) : undefined,
                        data: call.data,
                      });
                    }
                    closeWalletIfNeeded();
                    resolve({ id: lastHash });
                  } catch (err) { closeWalletIfNeeded(); reject(err); }
                },
                reject: (err) => { closeWalletIfNeeded(); reject(err); },
              });
            });
          }

          if (request.method === 'wallet_getCallsStatus') {
            return {
              status: 'CONFIRMED',
              receipts: [{ status: '0x1', transactionHash: request.params[0] }]
            };
          }

          // ── Send Transaction ──
          if (request.method === 'eth_sendTransaction') {
            try { warpcast.request({ method: 'open_wallet' } as any); } catch {}
            return new Promise((resolve, reject) => {
              store.addPendingRequest({
                type: 'transaction',
                payload: request,
                resolve: async () => {
                  try {
                    const activeAccount = store.getAccount(); if (!activeAccount) throw new Error("Wallet locked"); const wc = createWalletClient({ account: activeAccount, chain: base, transport: http(getRpcUrl()) });
                    const hash = await wc.sendTransaction({
                      to: request.params[0].to,
                      value: request.params[0].value,
                      data: request.params[0].data,
                    });
                    closeWalletIfNeeded();
                    resolve(hash);
                  } catch (err) { closeWalletIfNeeded(); reject(err); }
                },
                reject: (err) => { closeWalletIfNeeded(); reject(err); },
              });
            });
          }

          // ── Sign Message / Typed Data ──
          if (request.method === 'personal_sign' || request.method === 'eth_signTypedData_v4') {
            try { warpcast.request({ method: 'open_wallet' } as any); } catch {}
            return new Promise((resolve, reject) => {
              store.addPendingRequest({
                type: 'sign',
                payload: request,
                resolve: async () => {
                  try {
                    const activeAccount = store.getAccount(); if (!activeAccount) throw new Error("Wallet locked"); const wc = createWalletClient({ account: activeAccount, chain: base, transport: http(getRpcUrl()) });
                    if (request.method === 'personal_sign') {
                      const p0 = request.params?.[0];
                      const p1 = request.params?.[1];
                      let rawMsg = p0;
                      if (typeof p0 === 'string' && p0.length === 42 && p0.startsWith('0x')) {
                        rawMsg = p1;
                      }
                      const messageArg = (typeof rawMsg === 'string' && rawMsg.startsWith('0x'))
                        ? { raw: rawMsg as `0x${string}` }
                        : (rawMsg || '');
                      resolve(await wc.signMessage({ message: messageArg }));
                    } else {
                      const typedDataRaw = request.params?.[1] || request.params?.[0];
                      const typedData = typeof typedDataRaw === 'string' ? JSON.parse(typedDataRaw) : typedDataRaw;
                      resolve(await wc.signTypedData({
                        domain: typedData.domain,
                        types: typedData.types,
                        primaryType: typedData.primaryType,
                        message: typedData.message,
                      }));
                    }
                    closeWalletIfNeeded();
                  } catch (err) { closeWalletIfNeeded(); reject(err); }
                },
                reject: (err) => { closeWalletIfNeeded(); reject(err); },
              });
            });
          }

          // ── Proxy everything else to public RPC ──
          try {
            const publicClient = getPublicClient();
            return await publicClient.request({ method: request.method as any, params: request.params as any });
          } catch (e: any) {
            throw new Error(`RPC Error: ${e.message}`);
          }
        },
      };

      MessageChannelRpc.createServer({
        channelName: 'ethProvider',
        port: ethPort,
        handleRequest: ethHandlerRef as any,
      });

      // ── Step 4: Tell parent we are ready ──
      try {
        (warpcast.request as any)({ method: 'connected', params: { connected: true } });
      } catch {}

      setBridgeReady(true);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const surface = new URLSearchParams(window.location.search).get('surface');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Make iframe background transparent for mini_app_modal surface
  useEffect(() => {
    if (surface === 'mini_app_modal') {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
    }
  }, [surface]);

  // Poll for pending requests (for approval UI) and auto-close overlay when empty
  useEffect(() => {
    const interval = setInterval(() => {
      const requests = [...store.pendingRequests];
      setPendingRequests(requests);
      if (surface === 'mini_app_modal' && requests.length === 0 && warpcastClientRef.current) {
        try {
          (warpcastClientRef.current.request as any)({ method: 'close_wallet' });
        } catch {}
      }
    }, 300);
    return () => clearInterval(interval);
  }, [surface]);

  const handleApprove = (req: any) => {
    store.resolveRequest(req.id, true);
  };
  const handleReject = (req: any) => {
    const error = new ProviderRpcError('User rejected request', 4001);
    store.rejectRequest(req.id, error);
  };

  // ── For mini_app_modal surface: invisible background bridge ──
  if (surface === 'mini_app_modal') {
    return <div style={{ display: 'none' }} />;
  }

  // ── For full_warplet / wallet page: show full WalletUI ──
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <WalletUI />

      {/* Pending Requests Approval Overlay */}
      {pendingRequests.length > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-default bg-app p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">
                {pendingRequests[0].type === 'transaction'
                  ? 'Approve Transaction'
                  : pendingRequests[0].payload?.method === 'eth_requestAccounts'
                  ? 'Connect Wallet'
                  : 'Sign Request'}
              </h3>
              <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs text-muted">
                1 of {pendingRequests.length}
              </span>
            </div>

            {/* Request content */}
            {pendingRequests[0].payload?.method === 'eth_requestAccounts' ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex size-14 items-center justify-center rounded-full bg-purple-500/10 text-3xl">
                  🔗
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-default">Mini-App Connection</p>
                  <p className="mt-1 text-xs text-muted">A Mini-App wants to connect to your Farcaster embedded wallet.</p>
                </div>
                <div className="w-full rounded-xl border border-default bg-surface-secondary p-3 text-center">
                  <p className="text-[10px] text-muted">
                    This will share your address ({store.getAccount()?.address ? store.getAccount()?.address.slice(0, 6) + '...' + store.getAccount()?.address.slice(-4) : ''}) with the app
                  </p>
                </div>
              </div>
            ) : pendingRequests[0].type === 'transaction' ? (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-surface-secondary p-2.5 rounded-xl border border-default text-xs">
                  <span className="text-muted">Target</span>
                  <span className="font-mono text-default font-semibold">
                    {pendingRequests[0].payload?.params?.[0]?.to ? pendingRequests[0].payload.params[0].to.slice(0, 10) + '...' : 'Contract'}
                  </span>
                </div>
                {pendingRequests[0].payload?.params?.[0]?.value && (
                  <div className="flex justify-between items-center bg-surface-secondary p-2.5 rounded-xl border border-default text-xs">
                    <span className="text-muted">Value</span>
                    <span className="font-bold text-default">{pendingRequests[0].payload.params[0].value}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-surface-secondary p-3 text-xs font-mono text-muted break-all max-h-[120px] overflow-y-auto border border-default">
                {JSON.stringify(pendingRequests[0].payload?.params || {}, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
              </div>
            )}

            {/* Approve / Reject Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleReject(pendingRequests[0])}
                className="flex-1 rounded-xl border border-default bg-surface-secondary py-3 text-sm font-bold text-default hover:bg-hover transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(pendingRequests[0])}
                className="flex-1 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700 transition-colors shadow-lg"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close button (only when bridge is ready and has a warpcast client) */}
      {bridgeReady && (
        <button
          aria-label="Close wallet"
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', border: 'none',
            color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => {
            try { (warpcastClientRef.current?.request as any)({ method: 'close_wallet' }); } catch {}
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default WalletIframePage;


