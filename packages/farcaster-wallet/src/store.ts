import { generateMnemonic, mnemonicToAccount, privateKeyToAccount, english, type HDAccount, type PrivateKeyAccount } from 'viem/accounts';
import { encryptData, decryptData, type EncryptedData } from './crypto';

const WALLET_STORAGE_KEY = 'fc_wallet_state';

export type CustomToken = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
};

export type CustomRpc = {
  chainId: number;
  url: string;
  name: string;
};

export type TransactionRecord = {
  hash: string;
  type: 'send' | 'receive' | 'swap' | 'sign' | 'contract_call';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  amount?: string;
  symbol?: string;
  to?: string;
  from?: string;
  chainId: number;
  description?: string;
};

export type WalletState = {
  encryptedKey: EncryptedData | null;
  address: string | null;
  isMnemonic: boolean;
  chainId: number;
  customTokens: CustomToken[];
  customRpcs: CustomRpc[];
  transactions: TransactionRecord[];
};

export type PendingRequest = {
  id: string;
  type: 'sign' | 'transaction';
  payload: any;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

export class WalletStore {
  private static instance: WalletStore;
  private state: WalletState;
  public pendingRequests: PendingRequest[] = [];
  
  private unlockedKey: string | null = null; // Memory-only plaintext key
  private listeners: Array<() => void> = [];

  private constructor() {
    this.state = this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === WALLET_STORAGE_KEY) {
          this.state = this.loadFromStorage();
          this.emitChange();
        }
      });

      window.addEventListener('message', (e) => {
        const targetOrigin = (e.origin && e.origin !== 'null') ? e.origin : window.location.origin;
        if (e.origin && e.origin !== 'null' && e.origin !== window.location.origin && !e.origin.startsWith('http://localhost') && !e.origin.startsWith('https://localhost')) {
          return;
        }

        if (e.data?.type === 'FC_WALLET_PENDING_REQUEST_ADD') {
          const { id, payload, requestType } = e.data;
          if (!this.pendingRequests.find(r => r.id === id)) {
            this.pendingRequests.push({
              id,
              type: requestType,
              payload,
              resolve: (result: any) => {
                if (e.source && 'postMessage' in e.source) {
                  (e.source as Window).postMessage({ type: 'FC_WALLET_PENDING_REQUEST_RESOLVE', id, result }, targetOrigin);
                }
                this.resolveRequest(id, result);
              },
              reject: (reason: any) => {
                if (e.source && 'postMessage' in e.source) {
                  (e.source as Window).postMessage({ type: 'FC_WALLET_PENDING_REQUEST_REJECT', id, error: reason?.message || 'Rejected' }, targetOrigin);
                }
                this.rejectRequest(id, reason);
              },
            });
            this.emitChange();
          }
        } else if (e.data?.type === 'FC_WALLET_PENDING_REQUEST_RESOLVE') {
          this.resolveRequest(e.data.id, e.data.result);
        } else if (e.data?.type === 'FC_WALLET_PENDING_REQUEST_REJECT') {
          const err = new Error(e.data.error || 'User rejected request') as any;
          err.code = 4001;
          this.rejectRequest(e.data.id, err);
        }
      });
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emitChange(): void {
    this.listeners.forEach(l => l());
  }

  public static getInstance(): WalletStore {
    if (!WalletStore.instance) {
      WalletStore.instance = new WalletStore();
    }
    return WalletStore.instance;
  }

  private loadFromStorage(): WalletState {
    try {
      const raw = localStorage.getItem(WALLET_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Clean up old insecure states if they exist
        if (parsed.mnemonic !== undefined || parsed.privateKey !== undefined) {

           return this.getDefaultState();
        }
        
        // Merge with default state to ensure no properties (like arrays, chainId, etc) are missing
        const defaultState = this.getDefaultState();
        return { ...defaultState, ...parsed, 
                 transactions: parsed.transactions || defaultState.transactions,
                 customTokens: parsed.customTokens || defaultState.customTokens,
                 customRpcs: parsed.customRpcs || defaultState.customRpcs 
               };
      }
    } catch {

      // Ignore parse errors
    }
    return this.getDefaultState();
  }
  
  private getDefaultState(): WalletState {
    return {
      encryptedKey: null,
      address: null,
      isMnemonic: true,
      chainId: 8453, // Base
      customTokens: [],
      customRpcs: [],
      transactions: [],
    };
  }

  private persist(): void {
    try {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage errors
    }
  }
  
  public isSetup(): boolean {
    return this.state.encryptedKey !== null;
  }

  public getUnlockedKey(): string | null {
    return this.unlockedKey;
  }

  private updateActivity() {
    try {
      sessionStorage.setItem('fc_wallet_last_active', Date.now().toString());
      if (typeof window !== 'undefined' && window !== window.parent) {
        try { window.parent.sessionStorage.setItem('fc_wallet_last_active', Date.now().toString()); } catch {}
      }
    } catch {}
  }

  public isLocked(): boolean {
    return this.isSetup() && this.getUnlockedKey() === null;
  }

  public lock(): void {
    this.unlockedKey = null;
  }

  public async unlock(password: string): Promise<boolean> {
    if (!this.state.encryptedKey) return false;
    try {
      this.unlockedKey = await decryptData(password, this.state.encryptedKey);
      try {
        sessionStorage.setItem('fc_wallet_key', this.unlockedKey);
        this.updateActivity();
      } catch {}
      return true;
    } catch (e) {
      return false; // Wrong password
    }
  }
  
  public async exportKey(password: string): Promise<string | null> {
    if (!this.state.encryptedKey) return null;
    try {
      return await decryptData(password, this.state.encryptedKey);
    } catch (e) {
      return null;
    }
  }
  
  public async setupWallet(password: string, importKey?: string): Promise<void> {
    const key = importKey || generateMnemonic(english);
    const isMnemonic = key.split(' ').length >= 12;
    
    if (isMnemonic) {
      mnemonicToAccount(key);
    } else {
      let pk = key;
      if (!pk.startsWith('0x')) pk = `0x${pk}`;
      privateKeyToAccount(pk as `0x${string}`);
      importKey = pk;
    }

    const finalKey = importKey || key;
    this.state.encryptedKey = await encryptData(password, finalKey);
    this.state.isMnemonic = isMnemonic;
    this.unlockedKey = finalKey;
    try {
      sessionStorage.setItem('fc_wallet_key', finalKey);
      this.updateActivity();
    } catch {}
    this.state.address = this.getAccount()?.address || null;
    this.persist();
  }

  public getAccount(): HDAccount | PrivateKeyAccount | null {
    const key = this.getUnlockedKey();
    if (!key) return null;
    if (this.state.isMnemonic) return mnemonicToAccount(key);
    return privateKeyToAccount(key as `0x${string}`);
  }

  public getAddress(): string | null {
    if (this.getUnlockedKey()) {
      return this.getAccount()?.address || null;
    }
    return this.state.address;
  }


  public addCustomToken(token: CustomToken): void {
    if (!this.state.customTokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
      this.state.customTokens.push(token);
      this.persist();
    }
  }

  public getCustomTokens(chainId: number): CustomToken[] {
    return this.state.customTokens.filter(t => t.chainId === chainId);
  }

  public addCustomRpc(rpc: CustomRpc): void {
    const existingIndex = this.state.customRpcs.findIndex(r => r.chainId === rpc.chainId);
    if (existingIndex >= 0) {
      this.state.customRpcs[existingIndex] = rpc;
    } else {
      this.state.customRpcs.push(rpc);
    }
    this.persist();
  }

  public getCustomRpc(chainId: number): CustomRpc | undefined {
    return this.state.customRpcs.find(r => r.chainId === chainId);
  }

  public getChainId(): number {
    return this.state.chainId;
  }

  public setChainId(chainId: number): void {
    this.state.chainId = chainId;
    this.persist();
  }

  public getState(): WalletState {
    return { ...this.state };
  }

  public clear(): void {
    this.state = {
      encryptedKey: null,
      address: null,
      isMnemonic: false,
      chainId: 8453,
      customTokens: [],
      customRpcs: [],
      transactions: [],
    };
    this.unlockedKey = null;
    this.persist();
  }

  // --- Transaction Management ---
  public addTransaction(tx: TransactionRecord): void {
    this.state.transactions.unshift(tx);
    this.persist();
  }

  public updateTransaction(hash: string, status: 'confirmed' | 'failed'): void {
    const tx = this.state.transactions.find(t => t.hash === hash);
    if (tx) {
      tx.status = status;
      this.persist();
    }
  }

  public getTransactions(): TransactionRecord[] {
    return this.state.transactions;
  }

  // --- Pending Requests Management ---
  public addPendingRequest(request: Omit<PendingRequest, 'id'>): string {
    const id = crypto.randomUUID();
    this.pendingRequests.push({ ...request, id });
    this.emitChange();

    if (typeof window !== 'undefined' && window !== window.parent) {
      try {
        window.parent.postMessage(
          {
            type: 'FC_WALLET_PENDING_REQUEST_ADD',
            id,
            payload: request.payload,
            requestType: request.type,
          },
          window.location.origin,
        );
      } catch {}
    }
    return id;
  }

  public resolveRequest(id: string, result: any) {
    const reqIndex = this.pendingRequests.findIndex((r) => r.id === id);
    if (reqIndex !== -1) {
      const [req] = this.pendingRequests.splice(reqIndex, 1);
      req.resolve(result);
      this.emitChange();
    }
  }

  public rejectRequest(id: string, reason: Error) {
    const reqIndex = this.pendingRequests.findIndex((r) => r.id === id);
    if (reqIndex !== -1) {
      const [req] = this.pendingRequests.splice(reqIndex, 1);
      req.reject(reason);
      this.emitChange();
    }
  }
}

export const store = WalletStore.getInstance();
