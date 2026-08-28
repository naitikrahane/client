import { store } from './store';
import { getPublicClient, getWalletClient } from './actions';
import { createWalletClient, http, type Address } from 'viem';
import { base } from 'viem/chains';

export interface RpcRequest {
  method: string;
  params?: any[];
}

export class FarcasterWeb3Provider {
  public isFarcaster = true;
  public isMetaMask = false;
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  constructor() {
    // EventEmitter init
  }

  public on(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(listener);
  }

  public removeListener(event: string, listener: (...args: any[]) => void) {
    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(event, list.filter(l => l !== listener));
    }
  }

  public emit(event: string, ...args: any[]) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(l => l(...args));
    }
  }

  public async request(req: RpcRequest): Promise<any> {
    const { method, params = [] } = req;
    let account = store.getAccount();



    // ── Read-only RPC methods ──
    if (method === 'eth_accounts') {
      return account ? [account.address] : [];
    }

    if (method === 'eth_chainId') {
      return `0x${store.getChainId().toString(16)}`;
    }

    if (method === 'net_version') {
      return store.getChainId().toString();
    }
    // ── Chain Switching ──
    if (method === 'wallet_switchEthereumChain') {
      const chainIdHex = params[0]?.chainId;
      if (chainIdHex) {
        const chainId = parseInt(chainIdHex, 16);
        store.setChainId(chainId);
        this.emit('chainChanged', chainIdHex);
        return null;
      }
      throw new Error('Invalid chainId');
    }

    // ── Connect Request (eth_requestAccounts) ──
    if (method === 'eth_requestAccounts') {
      const acc = store.getAccount();
      if (acc) {
        return [acc.address];
      }
      return new Promise((resolve, reject) => {
        store.addPendingRequest({
          type: 'sign',
          payload: req,
          resolve: () => resolve([store.getAccount()?.address]),
          reject: (err) => reject(err),
        });
      });
    }

    // Account check removed so pending requests open NativeWalletRequestModal for setup/unlock

    // ── EIP-5792 Send Calls ──
    if (method === 'wallet_sendCalls') {
      return new Promise((resolve, reject) => {
        store.addPendingRequest({
          type: 'transaction',
          payload: req,
          resolve: (result) => resolve(result),
          reject: (err) => reject(err),
        });
      });
    }

    if (method === 'wallet_getCallsStatus') {
      return {
        status: 'CONFIRMED',
        receipts: [{ status: '0x1', transactionHash: params[0] }]
      };
    }

    // ── Send Transaction ──
    if (method === 'eth_sendTransaction') {
      return new Promise((resolve, reject) => {
        store.addPendingRequest({
          type: 'transaction',
          payload: req,
          resolve: (result) => resolve(result),
          reject: (err) => reject(err),
        });
      });
    }

    // ── Sign Message / Typed Data ──
    if (method === 'personal_sign' || method === 'eth_signTypedData_v4') {
      return new Promise((resolve, reject) => {
        store.addPendingRequest({
          type: 'sign',
          payload: req,
          resolve: async () => {
            try {
              const currentAcc = store.getAccount();
              if (!currentAcc) throw new Error('Account locked');
              const wc = createWalletClient({ account: currentAcc, chain: base, transport: http('https://base.drpc.org') });
              if (method === 'personal_sign') {
                const p0 = params[0];
                const p1 = params[1];
                let rawMsg = p0;
                if (typeof p0 === 'string' && p0.length === 42 && p0.startsWith('0x')) {
                  rawMsg = p1;
                }
                const messageArg = (typeof rawMsg === 'string' && rawMsg.startsWith('0x'))
                  ? { raw: rawMsg as `0x${string}` }
                  : (rawMsg || '');
                resolve(await wc.signMessage({ message: messageArg }));
              } else {
                const typedDataRaw = params[1] || params[0];
                const typedData = typeof typedDataRaw === 'string' ? JSON.parse(typedDataRaw) : typedDataRaw;
                resolve(await wc.signTypedData({
                  domain: typedData.domain,
                  types: typedData.types,
                  primaryType: typedData.primaryType,
                  message: typedData.message,
                }));
              }
            } catch (err) { reject(err); }
          },
          reject: (err) => reject(err),
        });
      });
    }

    // Fallback to public client for read RPC calls
    const publicClient = getPublicClient();
    return await publicClient.request({ method: method as any, params: params as any });
  }
}

export const farcasterWeb3Provider = new FarcasterWeb3Provider();
