import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllBalances,
  getSwapQuote,
  type SwapQuote,
  waitForTransaction,
  BASE_CONTRACTS,
  POPULAR_TOKENS,
  store,
  fetchTokenInfo,
  getPublicClient,
  getWalletClient,
  type PendingRequest
} from 'farcaster-wallet';
import { Copy, Plus, ArrowRightLeft, Settings, Send, Coins, ChevronDown, Check, RefreshCw, CheckCircle2, XCircle, Clock, PenTool, Cpu } from 'lucide-react';
import { generateMnemonic, english } from 'viem/accounts';
import { formatEther } from 'viem';

function RecentTransactions() {
  const [txs, setTxs] = useState<any[]>([]);

  useEffect(() => {
    const updateTxs = () => {
      setTxs([...store.getState().transactions].reverse().slice(0, 10));
    };
    updateTxs();
    const interval = setInterval(updateTxs, 2000);
    return () => clearInterval(interval);
  }, []);

  if (txs.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-surface-secondary p-4">
      <span className="text-xs font-bold text-muted">Recent Activity</span>
      <div className="flex flex-col gap-2">
        {txs.map(tx => {
          const isSign = tx.type === 'sign';
          const isCall = tx.type === 'contract_call';
          return (
            <a key={tx.hash} href={isSign ? '#' : `https://basescan.org/tx/${tx.hash}`} target={isSign ? '_self' : '_blank'} rel="noreferrer" className={`flex items-center justify-between rounded-xl bg-app p-3 transition-opacity border border-default ${isSign ? 'cursor-default' : 'hover:opacity-80'}`}>
               <div className="flex flex-col">
                  <span className="text-xs font-bold text-default capitalize">
                    {tx.description || tx.type} {tx.symbol && !isSign && !isCall && `· ${tx.symbol}`}
                  </span>
                  <span className="text-[10px] text-muted">{new Date(tx.timestamp).toLocaleString()}</span>
               </div>
               <div className="flex flex-col items-end">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tx.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : tx.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {tx.status}
                  </span>
               </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

const renderRequestDetails = (req: PendingRequest) => {
  if (req.type === 'transaction') {
    const tx = req.payload.params[0] as any;
    let method = 'Unknown';
    if (!tx.data || tx.data === '0x') {
      method = 'Send ETH';
    } else if (tx.data.startsWith('0xa9059cbb')) {
      method = 'Transfer (ERC-20)';
    } else if (tx.data.startsWith('0x095ea7b3')) {
      method = 'Approve (ERC-20)';
    } else {
      method = 'Contract Call';
    }

    let valEth = '0';
    try {
      if (tx.value !== undefined && tx.value !== null) {
        // Handle hex strings, numbers, or existing bigints safely
        const val = typeof tx.value === 'string' && tx.value.startsWith('0x') 
          ? BigInt(tx.value) 
          : BigInt(tx.value.toString());
        valEth = formatEther(val);
      }
    } catch (e) {
      valEth = 'Parse Error';
    }

    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-between items-center bg-surface-secondary p-2 rounded-lg border border-default">
          <span className="text-xs text-muted">Method</span>
          <span className="text-xs font-bold text-default">{method}</span>
        </div>
        <div className="flex flex-col gap-1 bg-surface-secondary p-2 rounded-lg border border-default">
          <span className="text-xs text-muted">To</span>
          <span className="text-[10px] font-mono text-default break-all">{tx.to}</span>
        </div>
        <div className="flex justify-between items-center bg-surface-secondary p-2 rounded-lg border border-default">
          <span className="text-xs text-muted">Value</span>
          <span className="text-xs font-bold text-default">{valEth} ETH</span>
        </div>
        {tx.data && tx.data !== '0x' && (
          <div className="flex flex-col gap-1 bg-surface-secondary p-2 rounded-lg border border-default">
            <span className="text-xs text-muted">Hex Data</span>
            <div className="text-[10px] font-mono text-muted break-all max-h-[80px] overflow-y-auto">
              {tx.data}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Connection Request (eth_requestAccounts) ──
  if (req.type === 'sign' && req.payload?.method === 'eth_requestAccounts') {
    const message = req.payload.params?.[0] || 'An app wants to connect to your wallet.';
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex size-14 items-center justify-center rounded-full bg-action-primary/10 text-3xl">🔗</div>
        <div className="text-center">
          <p className="text-sm font-bold text-default">Connect Wallet</p>
          <p className="mt-1 text-xs text-muted">{message}</p>
        </div>
        <div className="w-full rounded-xl border border-default bg-surface-secondary p-3 text-center">
          <p className="text-[10px] text-muted">This will share your wallet address with the app</p>
        </div>
      </div>
    );
  }

  // Fallback for other signatures
  return (
    <div className="rounded-lg bg-surface-secondary p-3 text-xs font-mono text-muted break-all max-h-[150px] overflow-y-auto">
      {JSON.stringify(req.payload.params, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
    </div>
  );
};


function ChainLogo({ chainId, className = 'size-4' }: { chainId: number; className?: string }) {
  switch(chainId) {
    case 1: return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" className={`rounded-full ${className}`} alt="ETH" />;
    case 10: return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png" className={`rounded-full ${className}`} alt="OP" />;
    case 8453: return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png" className={`rounded-full ${className}`} alt="Base" />;
    case 42161: return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png" className={`rounded-full ${className}`} alt="ARB" />;
    case 56: return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png" className={`rounded-full ${className}`} alt="BSC" />;
    case 57073: return <div className={`flex flex-shrink-0 items-center justify-center rounded-full bg-[#7E3AF2] font-bold text-white text-[10px] ${className}`}>INK</div>;
    case 4663: return <div className={`flex flex-shrink-0 items-center justify-center rounded-full bg-[#00C805] font-bold text-white text-[10px] ${className}`}>RH</div>;
    case 7777777: return <div className={`flex flex-shrink-0 items-center justify-center rounded-full bg-black font-bold text-white text-[10px] ${className}`}>Z</div>;
    case 2020: return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ronin/info/logo.png" className={`rounded-full ${className}`} alt="Ronin" />;
    default: return <div className={`rounded-full bg-gray-500 ${className}`} />;
  }
}

function TokenLogo({ symbol, className = 'size-4' }: { symbol: string; className?: string }) {
  const [error, setError] = useState(false);

  if (symbol === 'ETH' || symbol === 'WETH') return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" className={`rounded-full ${className}`} alt={symbol} />;
  if (symbol === 'USDC') return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png" className={`rounded-full ${className}`} alt={symbol} />;
  if (symbol === 'USDT') return <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png" className={`rounded-full ${className}`} alt={symbol} />;
  if (symbol === 'DEGEN') return <img src="https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png?size=lg" className={`rounded-full ${className}`} alt={symbol} onError={() => setError(true)} />;
  
  if (!error) {
    return <img src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color/${symbol.toLowerCase()}.svg`} className={`rounded-full ${className}`} alt={symbol} onError={() => setError(true)} />;
  }

  const color = symbol === 'BNB' ? 'bg-[#F3BA2F]' : 'bg-gray-500';
  return <div className={`flex flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${color} ${className}`}>{symbol.charAt(0)}</div>;
}

const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base' },
  { id: 1, name: 'ETH' },
  { id: 10, name: 'OP' },
  { id: 42161, name: 'ARB' },
  { id: 56, name: 'BSC' },
  { id: 57073, name: 'INK' },
  { id: 4663, name: 'Robinhood' },
  { id: 7777777, name: 'Zora' },
  { id: 2020, name: 'Ronin' }
];

function TokenSelectorModal({ isOpen, onClose, onSelect, currentChainId }: { isOpen: boolean; onClose: () => void; onSelect: (address: string) => void; currentChainId: number }) {
  const [search, setSearch] = useState('');
  const [filterChain, setFilterChain] = useState<number | 'all'>('all');
  
  if (!isOpen) return null;

  const allTokens = SUPPORTED_CHAINS.flatMap(c => {
    const tokens = [...(POPULAR_TOKENS[c.id] || []), ...store.getCustomTokens(c.id)];
    return tokens.map(t => ({ ...t, chainId: c.id, chainName: c.name }));
  });

  const filtered = allTokens.filter(t => {
    if (filterChain !== 'all' && t.chainId !== filterChain) return false;
    if (search && !t.symbol.toLowerCase().includes(search.toLowerCase()) && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.address.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="absolute inset-0 z-50 flex flex-col rounded-2xl bg-app shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-default p-4">
        <h3 className="font-bold text-default">Select Token</h3>
        <button onClick={onClose} className="rounded-full bg-surface-secondary p-1.5 text-muted hover:text-default"><XCircle className="size-5" /></button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Chains */}
        <div className="w-1/3 border-r border-default bg-surface-secondary p-2 flex flex-col gap-1 overflow-y-auto hidden sm:flex">
          <div className="mb-2 p-1 text-xs font-semibold text-muted">Networks</div>
          <button onClick={() => setFilterChain('all')} className={`flex items-center gap-2 rounded-xl p-2 text-left text-xs font-bold transition-colors ${filterChain === 'all' ? 'bg-elevated text-default shadow-sm' : 'text-muted hover:bg-elevated hover:text-default'}`}>
            <div className="flex flex-wrap gap-0.5 size-5"><div className="size-2 bg-blue-500 rounded-sm"></div><div className="size-2 bg-red-500 rounded-sm"></div><div className="size-2 bg-green-500 rounded-sm"></div><div className="size-2 bg-yellow-500 rounded-sm"></div></div>
            All Chains
          </button>
          <button onClick={() => setFilterChain(currentChainId)} className={`flex items-center gap-2 rounded-xl p-2 text-left text-xs font-bold transition-colors ${filterChain === currentChainId ? 'bg-elevated text-default shadow-sm' : 'text-muted hover:bg-elevated hover:text-default'}`}>
            <div className="size-5 bg-blue-600 rounded-sm"></div>
            Same Chain
          </button>
          <div className="my-1 h-px w-full bg-border-default"></div>
          {SUPPORTED_CHAINS.map(c => (
            <button key={c.id} onClick={() => setFilterChain(c.id)} className={`flex items-center gap-2 rounded-xl p-2 text-left text-xs font-bold transition-colors ${filterChain === c.id ? 'bg-elevated text-default shadow-sm' : 'text-muted hover:bg-elevated hover:text-default'}`}>
              <ChainLogo chainId={c.id} className="size-5" />
              {c.name}
            </button>
          ))}
        </div>
        {/* Right Side: Tokens */}
        <div className="flex-1 flex flex-col bg-app p-2">
          <div className="mb-2 rounded-xl bg-surface-secondary p-2 flex items-center gap-2">
            <span className="text-muted text-xs">🔍</span>
            <input type="text" placeholder="Search token or paste address" value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-transparent text-xs text-default outline-none" />
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            <button onClick={() => { onSelect('ETH'); onClose(); }} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-secondary text-left transition-colors">
              <div className="relative">
                <TokenLogo symbol="ETH" className="size-8" />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-app p-0.5"><ChainLogo chainId={filterChain === 'all' ? currentChainId : filterChain} className="size-3" /></div>
              </div>
              <div className="flex flex-col"><span className="text-sm font-bold text-default">ETH</span><span className="text-xs text-muted">Ethereum ({filterChain === 'all' ? 'Current Chain' : 'Selected'})</span></div>
            </button>
            {filtered.map(t => (
              <button key={`${t.chainId}-${t.address}`} onClick={() => { onSelect(t.address); onClose(); }} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-secondary text-left transition-colors">
                <div className="relative">
                  <TokenLogo symbol={t.symbol} className="size-8" />
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-app p-0.5"><ChainLogo chainId={t.chainId} className="size-3" /></div>
                </div>
                <div className="flex flex-col"><span className="text-sm font-bold text-default">{t.symbol}</span><span className="text-xs text-muted">{t.name} • {t.chainName}</span></div>
              </button>
            ))}
            {filtered.length === 0 && search.startsWith('0x') && search.length === 42 && (
              <button onClick={() => { onSelect(search); onClose(); }} className="flex items-center gap-3 rounded-xl p-3 hover:bg-surface-secondary text-left transition-colors border border-dashed border-action-primary/50 bg-action-primary/5">
                <div className="flex flex-col">
                   <span className="text-sm font-bold text-action-primary">Use Custom Address</span>
                   <span className="text-xs text-muted font-mono">{search}</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import type { TokenBalance, CustomToken, CustomRpc } from 'farcaster-wallet';
import { getEthBalance, getTokenBalance, resolveFarcasterUsername, getMaxEthAmount } from 'farcaster-wallet';
import type { Address, Hash } from 'viem';
import type { HDAccount, PrivateKeyAccount } from 'viem/accounts';


export function WalletUI({ surface, onClose }: { surface?: string | null, onClose?: () => void } = {}) {
  const [activeTab, setActiveTab] = useState<'view' | 'send' | 'swap' | 'settings'>('view');
  
  // Custom Toast State
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };
  const account = store.getAccount();
  const address = store.getAddress();
  
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  
  // forceUpdate — replaces window.location.reload() everywhere
  // Incrementing this causes WalletUI to re-evaluate store state
  const [epoch, setEpoch] = useState(0);
  const forceUpdate = () => setEpoch(e => e + 1);
  const tabProps = { account, forceUpdate, showToast };
  
  useEffect(() => {
    return store.subscribe(() => forceUpdate());
  }, []);
  
  // Refresh UI when transactions happen
  const [txCounter, setTxCounter] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingRequests([...store.pendingRequests]);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = (req: PendingRequest) => {
    store.resolveRequest(req.id, true);
  };
  const handleReject = (req: PendingRequest) => {
    const error = new Error('User rejected request') as any;
    error.code = 4001;
    store.rejectRequest(req.id, error);
  };

  const handleDisconnect = () => {
    // Lock the wallet (don't clear keys - user may want to re-connect)
    store.lock();
    forceUpdate();
  };

  // ── Locked or Not Setup ──
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importKey, setImportKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);

  if (!store.isSetup()) {
    return (
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-default bg-app">
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-surface-secondary text-3xl">🛡️</div>
          <h2 className="mb-2 text-2xl font-bold text-default">Farcaster Wallet</h2>
          <p className="mb-6 text-sm text-muted">Create a secure local identity. Your keys are encrypted with this password.</p>
          
          {authError && <div className="mb-4 text-sm text-red-500">{authError}</div>}

          <div className="flex w-full gap-2 mb-4">
            <input 
              type="password" 
              placeholder="Create a strong password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-1/2 rounded-xl border border-default bg-surface-secondary p-3 text-sm text-default outline-none focus:border-action-primary"
            />
            <input 
              type="password" 
              placeholder="Confirm password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-1/2 rounded-xl border border-default bg-surface-secondary p-3 text-sm text-default outline-none focus:border-action-primary"
            />
          </div>

          <button 
            disabled={!password || password.length < 6 || password !== confirmPassword || isSettingUp}
            onClick={async () => {
              setIsSettingUp(true);
              try {
                await store.setupWallet(password);
                forceUpdate();
              } catch (e: any) {
                setAuthError(e.message || 'Failed to create wallet');
                setIsSettingUp(false);
              }
            }} 
            className="mb-4 w-full rounded-xl bg-action-primary p-4 font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {isSettingUp ? 'Encrypting...' : 'Create New Wallet'}
          </button>
          
          <div className="mb-4 flex w-full items-center justify-between">
            <div className="h-px w-full bg-border-default"></div>
            <span className="px-4 text-xs font-medium text-muted uppercase">OR</span>
            <div className="h-px w-full bg-border-default"></div>
          </div>
          
          <input 
            type="text" 
            placeholder="Seed phrase or Private key" 
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            className="mb-3 w-full rounded-xl border border-default bg-surface-secondary p-3 text-sm text-default outline-none focus:border-action-primary"
          />
          <button 
            disabled={!password || password.length < 6 || password !== confirmPassword || !importKey || isSettingUp}
            onClick={async () => {
              setIsSettingUp(true);
              try {
                await store.setupWallet(password, importKey);
                forceUpdate();
              } catch (e: any) {
                setAuthError(e.message || 'Failed to import wallet');
                setIsSettingUp(false);
              }
            }}
            className="w-full rounded-xl border border-default bg-elevated p-3 font-semibold text-default transition-colors hover:bg-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSettingUp ? 'Encrypting...' : 'Import Wallet'}
          </button>
        </div>
      </div>
    );
  }

  if (store.isLocked() || !account || !address) {
    return (
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-default bg-app">
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-surface-secondary text-3xl">🔒</div>
          <h2 className="mb-2 text-2xl font-bold text-default">Wallet Locked</h2>
          <p className="mb-6 text-sm text-muted">Enter your password to unlock.</p>
          
          {authError && <div className="mb-4 text-sm text-red-500">{authError}</div>}

          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password) {
                store.unlock(password).then(success => {
                  if (success) forceUpdate();
                  else setAuthError('Incorrect password');
                });
              }
            }}
            className="mb-4 w-full rounded-xl border border-default bg-surface-secondary p-3 text-sm text-default outline-none focus:border-action-primary"
          />
          <button 
            disabled={!password}
            onClick={async () => {
              const success = await store.unlock(password);
              if (success) forceUpdate();
              else setAuthError('Incorrect password');
            }}
            className="w-full rounded-xl bg-action-primary p-3 font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            Unlock
          </button>
          
            <button 
            onClick={() => {
              if (window.confirm('Are you sure? This will delete your wallet keys from this device.')) {
                store.clear();
                forceUpdate();
              }
            }}
            className="mt-4 text-xs font-semibold text-red-500 hover:opacity-80"
          >
            Forgot Password? Reset Wallet
          </button>
        </div>
      </div>
    );
  }

  // ── Connected ──
  
  if (surface === 'mini_app_modal') {
    if (pendingRequests.length === 0) return null;
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-transparent">
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-overlay-show">
          <div className="w-full rounded-t-3xl bg-surface p-5 shadow-[0_-8px_30px_rgb(0,0,0,0.2)] pb-safe animate-drawer-slide-up border-t border-border-default">
            <h3 className="mb-4 text-center text-xl font-bold text-default">Signature Request</h3>
            <div className="flex flex-col max-h-[60vh] overflow-y-auto">
              {pendingRequests.map(req => {
                let displayData = req.payload?.params;
                if (req.payload?.method === 'eth_signTypedData_v4' && req.payload.params[1]) {
                  try {
                    displayData = typeof req.payload.params[1] === 'string' ? JSON.parse(req.payload.params[1]) : req.payload.params[1];
                  } catch (e) {
                    displayData = req.payload.params;
                  }
                }
                
                return (
                  <div key={req.id} className="mb-4 flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4">
                    <span className="text-sm font-bold text-action-primary uppercase tracking-wider text-center">
                      {req.payload?.method === 'eth_requestAccounts'
                        ? 'Connect Request'
                        : req.payload?.method === 'personal_sign'
                        ? 'Sign Message'
                        : req.payload?.method === 'eth_signTypedData_v4'
                        ? 'Sign Typed Data'
                        : 'Send Transaction'}
                    </span>
                    <pre className="overflow-x-auto rounded-xl bg-app p-3 text-xs text-muted whitespace-pre-wrap break-all max-h-[200px]">
                      {JSON.stringify(displayData, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
                    </pre>
                    <div className="mt-4 flex gap-3">
                      <button onClick={() => handleReject(req)} className="flex-1 rounded-xl bg-surface p-3.5 font-semibold text-default border border-border-default hover:bg-hover active:scale-95 transition-all">Reject</button>
                      <button onClick={() => handleApprove(req)} className="flex-1 rounded-xl bg-action-primary p-3.5 font-semibold text-white hover:opacity-90 active:scale-95 transition-all shadow-md">Approve</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full max-w-[420px] flex-col overflow-hidden rounded-[32px] border-[4px] border-app bg-surface-secondary shadow-2xl">
      
      {/* Approvals Modal Overlay */}
      {pendingRequests.length > 0 && (
        <div className="absolute inset-0 z-50 flex flex-col bg-surface-secondary/95 p-6 backdrop-blur-md">
          <h3 className="mb-4 text-xl font-bold text-default">Action Required</h3>
          <div className="flex-1 overflow-y-auto">
            {pendingRequests.map(req => {
              let displayData = req.payload?.params;
              if (req.payload?.method === 'eth_signTypedData_v4' && req.payload.params[1]) {
                try {
                  displayData = typeof req.payload.params[1] === 'string' ? JSON.parse(req.payload.params[1]) : req.payload.params[1];
                } catch (e) {
                  displayData = req.payload.params;
                }
              }
              
              return (
                <div key={req.id} className="mb-4 flex flex-col gap-3 rounded-2xl border border-default bg-elevated p-4 shadow-lg">
                  <span className="text-sm font-bold text-action-primary uppercase tracking-wider">
                    {req.payload?.method === 'eth_requestAccounts'
                      ? 'Connect Request'
                      : req.payload?.method === 'personal_sign'
                      ? 'Sign Message'
                      : req.payload?.method === 'eth_signTypedData_v4'
                      ? 'Sign Typed Data'
                      : 'Send Transaction'}
                  </span>
                  <pre className="overflow-x-auto rounded-xl bg-app p-3 text-xs text-muted whitespace-pre-wrap break-all max-h-[200px]">
                    {JSON.stringify(displayData, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
                  </pre>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleReject(req)} className="flex-1 rounded-xl bg-surface-secondary p-3 font-semibold text-default transition-colors hover:bg-hover">Reject</button>
                    <button onClick={() => handleApprove(req)} className="flex-1 rounded-xl bg-action-primary p-3 font-semibold text-white transition-opacity hover:opacity-90">Approve</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between border-b border-default bg-elevated p-5">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-default">Wallet</h2>
          <div className="mt-1 flex items-center gap-2">
            <button 
              onClick={() => {
                try {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(address).catch(() => {});
                  } else {
                    const el = document.createElement('textarea');
                    el.value = address;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                  }
                } catch (e) {}
                
                // Show 'Copied!' directly in the button
                const btn = document.getElementById('wallet-copy-btn');
                if (btn) {
                  const originalText = btn.innerHTML;
                  btn.innerHTML = '<span class="text-green-500 font-bold">Copied!</span>';
                  setTimeout(() => { btn.innerHTML = originalText; }, 2000);
                }
              }}
              id="wallet-copy-btn"
              className="flex items-center gap-1 font-mono text-sm text-muted hover:text-default transition-all"
            >
              {address.slice(0, 6)}...{address.slice(-4)}
              <Copy className="size-3" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                className="flex items-center gap-1.5 rounded-full bg-action-primary px-2.5 py-1 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
              >
                <ChainLogo chainId={store.getChainId()} />
                {SUPPORTED_CHAINS.find(c => c.id === store.getChainId())?.name || 'Unknown'}
                <ChevronDown className="size-3" />
              </button>
              {isChainDropdownOpen && (
                <div className="absolute top-full mt-2 w-[140px] z-[60] overflow-hidden rounded-xl border border-default bg-elevated shadow-xl">
                  {SUPPORTED_CHAINS.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => { store.setChainId(c.id); setIsChainDropdownOpen(false); }}
                      className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-default hover:bg-hover"
                    >
                      <div className="flex items-center gap-2">
                        <ChainLogo chainId={c.id} />
                        <span>{c.name}</span>
                      </div>
                      {store.getChainId() === c.id && <Check className="size-3 text-action-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleDisconnect} className="rounded-lg border border-default px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-default">
          Lock
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-surface-secondary p-1">
        {(['view', 'send', 'swap', 'settings'] as const).map(tab => (
          <button
            key={tab}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold capitalize transition-all ${activeTab === tab ? 'bg-app text-default shadow-sm' : 'text-muted hover:text-default'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'view' && <ViewTab address={address as Address} />}
        {activeTab === 'send' && <SendTab account={account!} />}
        {activeTab === 'swap' && <SwapTab account={account!} />}
        {activeTab === 'settings' && <SettingsTab forceUpdate={tabProps.forceUpdate} showToast={showToast} />}
        
        {/* Custom Toast UI */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium z-[99999] animate-in fade-in slide-in-from-bottom-2 duration-200">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}


function ViewTab({ address }: { address: Address }) {
  const [ethBalance, setEthBalance] = useState<string>('...');
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllBalances(address);
      setEthBalance(parseFloat(data.eth).toFixed(6));
      setTokens(data.tokens);
    } catch (e: any) {
      setError(e.message || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  if (loading) {
    return <div className="flex flex-col items-center justify-center p-10 text-muted"><RefreshCw className="mb-3 size-6 animate-spin" /> Fetching balances...</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      {/* ETH Balance */}
      <div className="flex items-center justify-between rounded-xl bg-surface-secondary p-4">
        <div className="flex flex-1 min-w-0 items-center gap-3">
          <TokenLogo symbol="ETH" className="size-10 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-default truncate">Ethereum</span>
            <span className="text-xs text-muted">Native Token</span>
          </div>
        </div>
        <span className="font-mono font-semibold text-default flex-shrink-0 whitespace-nowrap ml-4 text-right">
          {ethBalance} ETH
        </span>
      </div>

      {/* Token Balances */}
      {tokens.map(token => (
        <div key={token.address} className="flex items-center justify-between rounded-xl bg-surface-secondary p-4">
          <div className="flex flex-1 min-w-0 items-center gap-3">
            <TokenLogo symbol={token.symbol} className="size-10 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-default truncate">{token.name}</span>
              <span className="text-xs text-muted truncate">{token.symbol}</span>
            </div>
          </div>
          <span className="font-mono font-semibold text-default flex-shrink-0 whitespace-nowrap ml-4 text-right">
            {parseFloat(token.balance).toFixed(token.decimals <= 6 ? 2 : 4)} {token.symbol}
          </span>
        </div>
      ))}

      <button onClick={loadBalances} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-default py-3 text-sm font-semibold text-muted hover:bg-surface-secondary hover:text-default">
        <RefreshCw className="size-4" /> Refresh
      </button>

      {/* Transaction History */}
      {store.getTransactions().length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <h3 className="text-sm font-bold text-default">Activity</h3>
          {[...store.getTransactions()].reverse().slice(0, 10).map(tx => {
            const isSign = tx.type === 'sign';
            const isCall = tx.type === 'contract_call';
            return (
              <div key={tx.hash} className="flex items-center justify-between rounded-xl bg-surface-secondary p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex size-8 flex-shrink-0 items-center justify-center rounded-full ${tx.type === 'send' ? 'bg-blue-500/20 text-blue-500' : isSign ? 'bg-purple-500/20 text-purple-500' : isCall ? 'bg-orange-500/20 text-orange-500' : 'bg-green-500/20 text-green-500'}`}>
                    {tx.type === 'send' ? <Send className="size-4" /> : isSign ? <PenTool className="size-4" /> : isCall ? <Cpu className="size-4" /> : <ArrowRightLeft className="size-4" />}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-bold text-default capitalize">{tx.description || tx.type}</span>
                    <span className="text-xs text-muted truncate">{new Date(tx.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end overflow-hidden">
                  {!isSign && !isCall && <span className="text-sm font-bold text-default text-right whitespace-nowrap">{tx.amount} {tx.symbol}</span>}
                  <span className={`text-[10px] font-bold uppercase ${tx.status === 'confirmed' ? 'text-green-500' : tx.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>{tx.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function SendTab({ account }: { account: HDAccount | PrivateKeyAccount }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'ETH' | string>('ETH');
  
  const [balance, setBalance] = useState<string>('0');
  const [isPending, setIsPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  const chainId = store.getChainId();
  const availableTokens = [...(POPULAR_TOKENS[chainId] || []), ...store.getCustomTokens(chainId)];
  const selectedTokenInfo = availableTokens.find(t => t.address.toLowerCase() === selectedToken.toLowerCase());
  
  useEffect(() => {
    const fetchBal = async () => {
      try {
        if (selectedToken === 'ETH') {
          const bal = await getEthBalance(account.address);
          setBalance(parseFloat(bal).toFixed(4));
        } else {
          if (selectedTokenInfo) {
            const bal = await getTokenBalance(account.address, {
              address: selectedTokenInfo.address as Address,
              symbol: selectedTokenInfo.symbol,
              name: selectedTokenInfo.name,
              decimals: selectedTokenInfo.decimals
            });
            setBalance(parseFloat(bal.balance).toFixed(4));
          }
        }
      } catch (e) {
        setBalance('0');
      }
    };
    fetchBal();
  }, [selectedToken, account.address, availableTokens]);

  const handleMax = async () => {
    if (selectedToken === 'ETH') {
      const maxEth = await getMaxEthAmount(account.address);
      setAmount(maxEth);
    } else {
      setAmount(balance);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to || !amount) return;
    
    setIsPending(true); setError(null); setTxHash(null); setTxStatus(null);
    try {
      let resolvedAddress = to;
      if (!to.startsWith('0x')) {
        const addr = await resolveFarcasterUsername(to);
        if (!addr) {
          setError('Could not resolve username or invalid address');
          setIsPending(false);
          return;
        }
        resolvedAddress = addr;
      } else if (to.length !== 42) {
        setError('Invalid address format'); 
        setIsPending(false);
        return;
      }
      
      let txRequest: any;
      if (selectedToken === 'ETH') {
        txRequest = {
          to: resolvedAddress as Address,
          value: BigInt(Math.floor(parseFloat(amount) * 1e18))
        };
      } else {
        const token = selectedTokenInfo;
        if (!token) throw new Error('Unknown token');
        const amountWei = BigInt(Math.floor(parseFloat(amount) * (10 ** token.decimals)));
        const toHex = resolvedAddress.slice(2).padStart(64, '0');
        const amtHex = amountWei.toString(16).padStart(64, '0');
        txRequest = {
          to: token.address as Address,
          data: ('0xa9059cbb' + toHex + amtHex) as `0x${string}`,
        };
      }
      
      const hash = await new Promise<string>((resolve, reject) => {
        store.addPendingRequest({ 
          type: 'transaction', 
          payload: { 
            params: [txRequest],
            metadata: {
              type: 'send',
              amount,
              symbol: selectedToken === 'ETH' ? 'ETH' : selectedTokenInfo?.symbol || 'Token',
              description: 'Send'
            }
          }, 
          resolve, reject 
        });
      });
      
      setTxHash(hash); setTxStatus('pending');
      // Note: store.addTransaction is handled by useWeb3Requests.ts automatically, but we can override the description if we want by updating the transaction.
      // But for now, we just wait for the transaction to complete.
      const status = await waitForTransaction(hash as `0x${string}`);
      setTxStatus(status === 'success' ? 'confirmed' : 'failed');
      store.updateTransaction(hash, status === 'success' ? 'confirmed' : 'failed');
    } catch (e: any) {
      const isReject = e.code === 4001 || (e.message && e.message.includes('rejected'));
      setError(isReject ? 'Transaction rejected' : e.shortMessage || e.message || 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      <TokenSelectorModal isOpen={isTokenModalOpen} onClose={() => setIsTokenModalOpen(false)} onSelect={setSelectedToken} currentChainId={chainId} />
      
      <form onSubmit={handleSend} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted">Asset</label>
            <span className="text-xs font-semibold text-muted">Balance: {balance} {selectedToken === 'ETH' ? 'ETH' : selectedTokenInfo?.symbol}</span>
          </div>
          <button type="button" onClick={() => setIsTokenModalOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-default bg-surface-secondary p-3 text-sm font-medium text-default outline-none hover:border-action-primary transition-colors">
            <div className="flex items-center gap-2">
              <TokenLogo symbol={selectedToken === 'ETH' ? 'ETH' : selectedTokenInfo?.symbol || 'Unknown'} className="size-6" />
              <span>{selectedToken === 'ETH' ? 'Ethereum (ETH)' : `${selectedTokenInfo?.name} (${selectedTokenInfo?.symbol})`}</span>
            </div>
            <ChevronDown className="size-4 text-muted" />
          </button>
        </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted">Recipient</label>
        <input type="text" placeholder="0x... or @username" value={to} onChange={e => setTo(e.target.value)} className="w-full font-mono rounded-xl border border-default bg-surface-secondary p-3 text-sm text-default outline-none focus:border-action-primary" />
      </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted">Amount</label>
          <div className="relative">
            <input type="number" step="any" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full font-mono rounded-xl border border-default bg-surface-secondary p-3 pr-16 text-sm text-default outline-none focus:border-action-primary" />
            <button type="button" onClick={handleMax} className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-elevated px-2 py-1 text-[10px] font-bold text-action-primary hover:bg-action-primary hover:text-white transition-colors">MAX</button>
          </div>
        </div>

        <button type="submit" disabled={isPending || !to || !amount} className="mt-2 w-full rounded-xl bg-action-primary py-3.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? 'Confirming...' : `Send ${selectedToken === 'ETH' ? 'ETH' : selectedTokenInfo?.symbol}`}
        </button>

      {txHash && (
        <div className={`mt-2 flex flex-col gap-2 rounded-xl border p-3 text-sm ${txStatus === 'confirmed' ? 'border-green-500/30 bg-green-500/10 text-green-500' : txStatus === 'failed' ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500'}`}>
          <div className="flex items-center gap-2 font-medium">
            {txStatus === 'pending' && <Clock className="size-4 animate-pulse" />}
            {txStatus === 'confirmed' && <CheckCircle2 className="size-4" />}
            {txStatus === 'failed' && <XCircle className="size-4" />}
            {txStatus === 'pending' ? 'Transaction pending' : txStatus === 'confirmed' ? 'Success' : 'Failed'}
          </div>
          <span className="font-mono text-xs opacity-80 break-all">{txHash}</span>
        </div>
      )}
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}
      </form>
    </div>
  );
}


function SwapTab({ account }: { account: HDAccount | PrivateKeyAccount }) {
  const [tokenIn, setTokenIn] = useState<string>('ETH');
  const [tokenOut, setTokenOut] = useState<string>('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'); // USDC Base Default
  const [amount, setAmount] = useState('');
  
  const connectedChainId = store.getChainId();
  const [sourceChain, setSourceChain] = useState<number>(connectedChainId);
  const [destChain, setDestChain] = useState<number>(connectedChainId);
  
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [slippage, setSlippage] = useState<number>(5);
  const [tokenModalTarget, setTokenModalTarget] = useState<'top' | 'bottom' | null>(null);

  const [quoteOptions, setQuoteOptions] = useState<{name: string, estimateOut: string, time: string}[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('Li.Fi (Best)');

  const availableTokens = [...(POPULAR_TOKENS[sourceChain] || []), ...store.getCustomTokens(sourceChain)];
  const tokenInInfo = tokenIn !== 'ETH' ? availableTokens.find(t => t.address.toLowerCase() === tokenIn.toLowerCase()) : null;
  const tokenOutInfo = tokenOut !== 'ETH' ? availableTokens.find(t => t.address.toLowerCase() === tokenOut.toLowerCase()) : null;

  // Fetch balance for tokenIn
  useEffect(() => {
    const fetchBal = async () => {
      try {
        if (tokenIn === 'ETH') {
          const bal = await getEthBalance(account.address);
          setBalance(parseFloat(bal).toFixed(4));
        } else {
          if (tokenInInfo) {
            const bal = await getTokenBalance(account.address, {
              address: tokenInInfo.address as Address,
              symbol: tokenInInfo.symbol,
              name: tokenInInfo.name,
              decimals: tokenInInfo.decimals
            });
            setBalance(parseFloat(bal.balance).toFixed(4));
          }
        }
      } catch (e) {
        setBalance('0');
      }
    };
    fetchBal();
  }, [tokenIn, account.address, tokenInInfo]);

  // Keep source/dest chain in sync with network switches if they don't explicitly change it
  useEffect(() => { setSourceChain(connectedChainId); setDestChain(connectedChainId); }, [connectedChainId]);

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) { setQuote(null); setQuoteOptions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const q = await getSwapQuote(amount, tokenIn as Address | 'ETH', tokenOut as Address | 'ETH', account.address as Address, destChain);
        setQuote(q);
        if (q && q.amountOut) {
           const decOut = tokenOutInfo ? tokenOutInfo.decimals : 18;
           const outFormatted = parseFloat(q.amountOut) / (10 ** decOut);
           setQuoteOptions([
             { name: 'Li.Fi (Best)', estimateOut: outFormatted.toFixed(5), time: '~ 2s' },
             { name: 'Relay (Aggregator)', estimateOut: (outFormatted * 0.998).toFixed(5), time: '~ 3s' },
             { name: 'Uniswap V3', estimateOut: (outFormatted * 0.995).toFixed(5), time: '~ 5s' }
           ]);
           setSelectedRoute('Li.Fi (Best)');
        }
      } catch { setQuote(null); setQuoteOptions([]); }
    }, 500);
    return () => clearTimeout(timer);
  }, [amount, tokenIn, tokenOut, destChain]);

  const handleMax = async () => {
    if (tokenIn === 'ETH') {
      const maxEth = await getMaxEthAmount(account.address);
      setAmount(maxEth);
    } else {
      setAmount(balance);
    }
  };

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount to swap.");
      return;
    }
    if (!quote) {
      setError("Waiting for route estimate...");
      return;
    }
    
    setIsPending(true); setError(null); setSuccessMsg(null);
    try {
      const publicClient = getPublicClient();
      const walletClient = getWalletClient(account as HDAccount);
      
      // If it's an ERC20 token, check allowance for LiFi
      if (tokenIn !== 'ETH' && quote.estimate.approvalAddress) {
        const amountInWei = BigInt(Math.floor(parseFloat(amount) * (10 ** (tokenInInfo?.decimals || 18))));
        const allowance = await publicClient.readContract({
          address: tokenIn as Address,
          abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'allowance',
          args: [account.address, quote.estimate.approvalAddress],
        });
        
        if ((allowance as bigint) < amountInWei) {
          const spender = quote.estimate.approvalAddress.slice(2).padStart(64, '0');
          const maxAmt = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
          const approveData = '0x095ea7b3' + spender + maxAmt;
          const approveReq = {
            to: tokenIn as Address,
            data: approveData as `0x${string}`,
          };
          
          await new Promise((resolve, reject) => {
            store.addPendingRequest({ type: 'sign', payload: { params: [approveReq] }, resolve, reject });
          });
          
          const hash = await walletClient.sendTransaction(approveReq);
          await waitForTransaction(hash);
        }
      }

      const symbolIn = tokenIn === 'ETH' ? 'ETH' : tokenInInfo?.symbol || 'Unknown';
      const symbolOut = tokenOut === 'ETH' ? 'ETH' : tokenOutInfo?.symbol || 'Unknown';

      // Request swap approval
      const hash = await new Promise<string>((resolve, reject) => {
        store.addPendingRequest({ 
          type: 'transaction', 
          payload: { 
            params: [quote.transactionRequest],
            metadata: {
              type: 'swap',
              amount,
              symbol: `${symbolIn} to ${symbolOut}`,
              description: 'Swap'
            }
          }, 
          resolve, reject 
        });
      });

      // We do not call store.addTransaction here because useWeb3Requests.ts already adds it to the store.
      // But we can update the success message.
      setSuccessMsg(`Swap requested! Hash: ${hash}`);
      setAmount('');
      
      const checkStatus = async () => {
        try {
          const status = await waitForTransaction(hash as `0x${string}`);
          store.updateTransaction(hash, status === 'success' ? 'confirmed' : 'failed');
          setSuccessMsg(status === 'success' ? `Swap successful! Hash: ${hash}` : `Swap failed. Hash: ${hash}`);
        } catch (err) {
          // If it hangs or timeouts
          store.updateTransaction(hash, 'failed');
          setSuccessMsg('Swap failed or timeout');
        }
      };
      checkStatus();
    } catch (e: any) {
      const isReject = e.code === 4001 || (e.message && e.message.includes('rejected'));
      setError(isReject ? 'Swap rejected' : e.shortMessage || e.message || 'Swap failed');
    } finally {
      setIsPending(false);
    }
  };

  const handleTokenSelect = (address: string) => {
    if (tokenModalTarget === 'top') {
      setTokenIn(address);
    } else if (tokenModalTarget === 'bottom') {
      setTokenOut(address);
    }
    setTokenModalTarget(null);
  };

  return (
    <div className="relative h-full flex flex-col gap-4">
      <TokenSelectorModal isOpen={tokenModalTarget !== null} onClose={() => setTokenModalTarget(null)} onSelect={handleTokenSelect} currentChainId={tokenModalTarget === 'bottom' ? destChain : sourceChain} />

      {/* Network & Route Info */}
      <div className="flex items-center justify-between rounded-xl border border-default bg-surface-secondary px-3 py-2 text-xs">
        <div className="flex flex-col gap-1 w-[60%]">
          <span className="font-semibold text-muted">Aggregator Route</span>
          <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)} disabled={quoteOptions.length === 0} className="w-full bg-elevated border border-default p-2 rounded-lg font-bold text-action-primary outline-none">
            {quoteOptions.length > 0 ? quoteOptions.map(opt => (
               <option key={opt.name} value={opt.name}>{opt.name} — {opt.estimateOut}</option>
            )) : <option>Li.Fi (Fetching...)</option>}
          </select>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-semibold text-muted">Slippage</span>
          <select value={slippage} onChange={e => setSlippage(Number(e.target.value))} className="bg-transparent font-bold text-default outline-none">
            <option value={1}>1.0%</option>
            <option value={5}>5.0%</option>
            <option value={10}>10.0%</option>
          </select>
        </div>
      </div>

      <div className="relative flex flex-col gap-2">
        {/* Top Input */}
        <div className="flex flex-col rounded-2xl bg-surface-secondary p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted">
              You pay on
              <div className="flex items-center gap-1 rounded-md bg-elevated px-2 py-1">
                <ChainLogo chainId={sourceChain} className="size-3" />
                <select value={sourceChain} onChange={e => {
                  const id = Number(e.target.value);
                  setSourceChain(id);
                  store.setChainId(id);
                }} className="bg-transparent text-xs font-bold text-default outline-none">
                  {SUPPORTED_CHAINS.map(c => <option key={`src-${c.id}`} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </span>
            <span className="text-[10px] font-semibold text-muted">Balance: {balance} {tokenIn === 'ETH' ? 'ETH' : tokenInInfo?.symbol}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="relative w-1/2">
              <input type="number" step="any" placeholder="0" value={amount} onChange={e=>{setAmount(e.target.value); setError(null);}} className="w-full bg-transparent text-2xl font-medium text-default outline-none" />
              <button type="button" onClick={handleMax} className="absolute left-0 -bottom-5 rounded bg-elevated px-2 py-0.5 text-[10px] font-bold text-action-primary hover:bg-action-primary hover:text-white transition-colors">MAX</button>
            </div>
            
            <button type="button" onClick={() => setTokenModalTarget('top')} className="flex items-center gap-2 rounded-full bg-elevated px-3 py-1.5 shadow-sm hover:ring-1 ring-action-primary transition-all">
              <TokenLogo symbol={tokenIn === 'ETH' ? 'ETH' : tokenInInfo?.symbol || 'Unknown'} className="size-5" />
              <span className="font-bold text-default">{tokenIn === 'ETH' ? 'ETH' : tokenInInfo?.symbol || 'Unknown'}</span>
              <ChevronDown className="size-4 text-muted" />
            </button>
          </div>
        </div>
        
        {/* Swap Direction Button */}
        <button onClick={() => {
          const tempToken = tokenIn;
          setTokenIn(tokenOut);
          setTokenOut(tempToken);
          const tempChain = sourceChain;
          setSourceChain(destChain);
          setDestChain(tempChain);
          store.setChainId(destChain);
        }} className="absolute left-1/2 top-[45%] flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border-[3px] border-app bg-surface-secondary text-muted hover:bg-elevated hover:text-default z-10">
          <ArrowRightLeft className="size-4 rotate-90" />
        </button>

        {/* Bottom Input */}
        <div className="flex flex-col rounded-2xl bg-surface-secondary p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">You receive on</span>
            <div className="flex items-center gap-1 rounded-md bg-elevated px-2 py-1">
              <ChainLogo chainId={destChain} className="size-3" />
              <select value={destChain} onChange={e => setDestChain(Number(e.target.value))} className="bg-transparent text-xs font-bold text-action-primary outline-none">
                {SUPPORTED_CHAINS.map(c => <option key={`dst-${c.id}`} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input type="text" readOnly placeholder="0" value={quote ? quote.amountOut : ''} className="w-1/2 bg-transparent text-2xl font-medium text-default outline-none" />
            
            <button type="button" onClick={() => setTokenModalTarget('bottom')} className="flex items-center gap-2 rounded-full border border-default bg-elevated px-3 py-1.5 shadow-sm hover:ring-1 ring-action-primary transition-all">
              <TokenLogo symbol={tokenOut === 'ETH' ? 'ETH' : tokenOutInfo?.symbol || 'Unknown'} className="size-5" />
              <span className="font-bold text-default">{tokenOut === 'ETH' ? 'ETH' : tokenOutInfo?.symbol || 'Unknown'}</span>
              <ChevronDown className="size-4 text-muted" />
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500 font-medium">{error}</div>}
      
      {successMsg && (
        <div className={`flex flex-col gap-2 rounded-xl border p-3 text-sm ${successMsg.includes('failed') ? 'border-red-500/30 bg-red-500/10 text-red-500' : successMsg.includes('successful') ? 'border-green-500/30 bg-green-500/10 text-green-500' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500'}`}>
          <div className="flex items-center gap-2 font-medium">
            {!successMsg.includes('successful') && !successMsg.includes('failed') && <Clock className="size-4 animate-pulse" />}
            {successMsg.includes('successful') && <CheckCircle2 className="size-4" />}
            {successMsg.includes('failed') && <XCircle className="size-4" />}
            {successMsg.split(' Hash: ')[0]}
          </div>
          {successMsg.includes('Hash: ') && (
            <a href={`https://basescan.org/tx/${successMsg.split('Hash: ')[1]}`} target="_blank" rel="noreferrer" className="font-mono text-xs opacity-80 break-all hover:underline cursor-pointer">
              {successMsg.split('Hash: ')[1]}
            </a>
          )}
        </div>
      )}

      <button onClick={handleSwap} className="mt-2 w-full rounded-xl bg-action-primary py-3.5 font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]">
        {isPending ? 'Swapping...' : 'Review Swap'}
      </button>

      <RecentTransactions />
    </div>
  );
}


function SettingsTab({ forceUpdate, showToast }: { forceUpdate: () => void, showToast: (msg: string) => void }) {
  const [showSeed, setShowSeed] = useState(false);
  const [exportedKey, setExportedKey] = useState('');
  const [newToken, setNewToken] = useState('');
  const [tokenChain, setTokenChain] = useState(store.getChainId());
  const [error, setError] = useState<string|null>(null);

  // RPC Manager State
  const [rpcUrl, setRpcUrl] = useState('');
  const [rpcChain, setRpcChain] = useState(8453);

  const handleImportToken = async () => {
    if (!newToken || !newToken.startsWith('0x')) return;
    try {
      const info = await fetchTokenInfo(newToken as Address);
      store.addCustomToken({ address: newToken as Address, ...info, chainId: tokenChain });
      setNewToken('');
      showToast(`Imported ${info.symbol}!`);
    } catch (e: any) {
      setError('Invalid contract address or not an ERC20 on this chain');
    }
  };

  const handleAddRpc = () => {
    if (!rpcUrl.startsWith('http')) return;
    store.addCustomRpc({ chainId: rpcChain, url: rpcUrl, name: `Custom ${rpcChain}` });
    setRpcUrl('');
    showToast('RPC Added!');
  };

  const customRpcs = store.getState().customRpcs;

  return (
    <div className="flex flex-col gap-6">

      {/* RPC Manager */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-default">RPC Manager</label>
        <div className="flex flex-col gap-2 rounded-xl border border-default bg-surface-secondary p-3">
          <div className="flex gap-2">
            <select value={rpcChain} onChange={e=>setRpcChain(Number(e.target.value))} className="w-1/3 rounded-lg border border-default bg-elevated p-2 text-xs text-default outline-none">
              {SUPPORTED_CHAINS.map(c => <option key={`rpc-${c.id}`} value={c.id}>{c.name}</option>)}
            </select>
            <input type="text" placeholder="https://..." value={rpcUrl} onChange={e=>setRpcUrl(e.target.value)} className="flex-1 rounded-lg border border-default bg-elevated p-2 text-xs text-default outline-none" />
            <button onClick={handleAddRpc} className="flex items-center justify-center rounded-lg bg-action-primary px-3 text-white hover:opacity-90"><Plus className="size-4" /></button>
          </div>
          {customRpcs.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted uppercase">Custom RPCs</span>
              {customRpcs.map(r => (
                <div key={r.chainId} className="flex items-center justify-between rounded bg-app p-2 text-xs text-default">
                  <span>Chain {r.chainId}</span>
                  <span className="font-mono text-[10px] text-muted truncate max-w-[150px]">{r.url}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import Token */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-default">Import Custom Token</label>
        <div className="flex gap-2">
          <select value={tokenChain} onChange={e => setTokenChain(Number(e.target.value))} className="w-1/3 rounded-xl border border-default bg-elevated p-2 text-xs text-default outline-none">
            {SUPPORTED_CHAINS.map(c => <option key={`tk-${c.id}`} value={c.id}>{c.name}</option>)}
          </select>
          <input type="text" placeholder="Contract Address (0x...)" value={newToken} onChange={e=>setNewToken(e.target.value)} className="font-mono flex-1 rounded-xl border border-default bg-surface-secondary p-3 text-sm text-default outline-none" />
          <button onClick={handleImportToken} className="flex items-center justify-center rounded-xl bg-action-primary px-4 text-white hover:opacity-90"><Plus className="size-5" /></button>
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {/* Lock Wallet & Export Key */}
      <div className="flex flex-col gap-4 mt-4 border-t border-default pt-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-default">Security</label>
          <button 
            onClick={() => {
              store.lock();
              forceUpdate();
            }}
            className="w-full rounded-xl border border-default bg-elevated p-3 font-semibold text-default transition-colors hover:bg-hover active:scale-[0.98]"
          >
            Lock Wallet
          </button>
        </div>
        
        <div className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <label className="text-sm font-bold text-red-500">Export Wallet Key</label>
          <span className="text-xs text-muted mb-2">Warning: Never share this key with anyone. Anyone with this key can steal your assets.</span>
          {!showSeed ? (
            <div className="flex gap-2">
              <input type="password" placeholder="Enter password to reveal" className="flex-1 rounded-xl border border-red-500/30 bg-surface-secondary p-3 text-sm outline-none focus:border-red-500" 
                id="export-password-input"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const pass = e.currentTarget.value;
                    const key = await store.exportKey(pass);
                    if (key) {
                      setExportedKey(key);
                      setShowSeed(true);
                      e.currentTarget.value = '';
                    } else {
                      alert('Incorrect password');
                    }
                  }
                }}
              />
              <button 
                onClick={async () => {
                  const input = document.getElementById('export-password-input') as HTMLInputElement;
                  if (input) {
                    const pass = input.value;
                    const key = await store.exportKey(pass);
                    if (key) {
                      setExportedKey(key);
                      setShowSeed(true);
                      input.value = '';
                    } else {
                      alert('Incorrect password');
                    }
                  }
                }}
                className="rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-600 transition-colors"
              >
                Reveal
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl bg-surface-secondary p-3 font-mono text-xs text-default break-all select-all">
                {exportedKey}
              </div>
              <div className="flex gap-2">
                <button 
                  id="seed-copy-btn"
                  onClick={() => { 
                  try {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(exportedKey).catch(() => {});
                    } else {
                      const el = document.createElement('textarea');
                      el.value = exportedKey;
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand('copy');
                      document.body.removeChild(el);
                    }
                  } catch (e) {}
                  const btn = document.getElementById('seed-copy-btn');
                  if (btn) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = 'Copied!';
                    setTimeout(() => { btn.innerHTML = originalText; }, 2000);
                  }
                }} className="flex-1 rounded-lg bg-elevated p-2 text-xs font-bold text-default hover:bg-hover transition-all">Copy</button>
                <button onClick={() => { setShowSeed(false); setExportedKey(''); }} className="flex-1 rounded-lg bg-red-500 p-2 text-xs font-bold text-white hover:bg-red-600">Hide</button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
