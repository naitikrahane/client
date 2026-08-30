import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../store';
import { encryptData, decryptData } from '../crypto';
import { farcasterWeb3Provider } from '../web3Provider';

describe('Crypto Module', () => {
  it('should encrypt and decrypt data with password correctly', async () => {
    const password = 'securePassword123!';
    const secret = 'test-mnemonic-phrase-word-list-twelve-words-secret-key-phrase';
    const encrypted = await encryptData(password, secret);
    expect(encrypted).toHaveProperty('ciphertext');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('salt');

    const decrypted = await decryptData(password, encrypted);
    expect(decrypted).toBe(secret);
  });

  it('should throw error when decrypting with wrong password', async () => {
    const password = 'correctPassword';
    const secret = 'secret-data';
    const encrypted = await encryptData(password, secret);

    await expect(decryptData('wrongPassword', encrypted)).rejects.toThrow();
  });
});

describe('WalletStore', () => {
  beforeEach(() => {
    store.clear();
    store.lock();
  });

  it('should initialize unsetup wallet state', () => {
    expect(store.isSetup()).toBe(false);
    expect(store.isLocked()).toBe(false);
    expect(store.getAddress()).toBeNull();
  });

  it('should setup new mnemonic wallet and derive address', async () => {
    await store.setupWallet('pass123');
    expect(store.isSetup()).toBe(true);
    expect(store.isLocked()).toBe(false);

    const address = store.getAddress();
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(store.getAccount()).not.toBeNull();
  });

  it('should lock and unlock wallet securely using in-memory key', async () => {
    await store.setupWallet('pass123');
    const addressBefore = store.getAddress();

    store.lock();
    expect(store.isLocked()).toBe(true);
    expect(store.getUnlockedKey()).toBeNull();
    expect(store.getAccount()).toBeNull();

    const unlockSuccess = await store.unlock('pass123');
    expect(unlockSuccess).toBe(true);
    expect(store.isLocked()).toBe(false);
    expect(store.getAddress()).toBe(addressBefore);
  });

  it('should manage pending requests and handle resolution / rejection', async () => {
    const id = store.addPendingRequest({
      type: 'sign',
      payload: { method: 'personal_sign', params: ['0x123'] },
      resolve: () => {},
      reject: () => {},
    });

    expect(store.pendingRequests.length).toBe(1);
    expect(store.pendingRequests[0].id).toBe(id);

    store.resolveRequest(id, '0xsignature');
    expect(store.pendingRequests.length).toBe(0);
  });

  it('should store and update transaction records with receipts', () => {
    const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    store.addTransaction({
      hash,
      type: 'send',
      status: 'pending',
      timestamp: Date.now(),
      chainId: 8453,
      to: '0x0000000000000000000000000000000000000000',
      description: 'Send ETH',
    });

    expect(store.getTransactions().length).toBe(1);
    expect(store.getTransactions()[0].status).toBe('pending');

    store.updateTransaction(hash, 'confirmed');
    expect(store.getTransactions()[0].status).toBe('confirmed');
  });
});

describe('FarcasterWeb3Provider RPC', () => {
  beforeEach(() => {
    store.clear();
  });

  it('should return empty accounts when wallet is unsetup or locked', async () => {
    const accounts = await farcasterWeb3Provider.request({ method: 'eth_accounts' });
    expect(accounts).toEqual([]);
  });

  it('should return hex chainId and net_version', async () => {
    const chainIdHex = await farcasterWeb3Provider.request({ method: 'eth_chainId' });
    expect(chainIdHex).toBe('0x2105'); // 8453 in hex (0x2105)

    const netVersion = await farcasterWeb3Provider.request({ method: 'net_version' });
    expect(netVersion).toBe('8453');
  });

  it('should return account when setup and unlocked', async () => {
    await store.setupWallet('pass123');
    const accounts = await farcasterWeb3Provider.request({ method: 'eth_accounts' });
    expect(accounts.length).toBe(1);
    expect(accounts[0]).toBe(store.getAddress());
  });
});
