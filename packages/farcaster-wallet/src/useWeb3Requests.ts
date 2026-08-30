import { ProviderRpcError } from './store';
import { store, type PendingRequest } from './store';

export function subscribeToWeb3Requests(callback: (requests: PendingRequest[]) => void) {
  callback([...store.pendingRequests]);
  const interval = setInterval(() => {
    callback([...store.pendingRequests]);
  }, 300);
  return () => clearInterval(interval);
}

export async function approveWeb3Request(id: string) {
  const req = store.pendingRequests.find(r => r.id === id);
  if (!req) return;
  
  try {
    if (req.type === 'sign') {
      const account = store.getAccount();
      if (!account) throw new Error('Wallet not initialized or locked');
      
      let signature;
      if (req.payload.method === 'eth_requestAccounts') {
        signature = [account.address];
      } else if (req.payload.method === 'personal_sign') {
        const message = req.payload.message || req.payload.params?.[0];
        signature = await account.signMessage({ message: typeof message === 'string' && message.startsWith('0x') ? { raw: message as any } : message });
      } else if (req.payload.method === 'eth_signTypedData_v4') {
        const { domain, types, primaryType, message } = req.payload.typedData || JSON.parse(req.payload.params?.[1] || '{}');
        signature = await account.signTypedData({ domain, types, primaryType, message });
      } else {
        signature = '0x';
      }
      
      store.addTransaction({
        hash: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'sign',
        status: 'confirmed',
        timestamp: Date.now(),
        chainId: store.getChainId(),
        description: req.payload.method === 'personal_sign' ? 'Signed Message' : 'Signed Typed Data'
      });
      
      store.resolveRequest(id, signature);
    } else {
      const account = store.getAccount();
      if (!account) throw new Error('Wallet not initialized or locked');
      
      const tx = req.payload.params?.[0] || req.payload;
      
      const { getWalletClient } = await import('./actions');
      const walletClient = getWalletClient(account);
      
      let txHash = '0x';
      if (req.payload.method === 'wallet_sendCalls') {
        const { getPublicClient } = await import('./actions');
        const publicClient = getPublicClient();
        const balance = await publicClient.getBalance({ address: account.address });
        if (balance === 0n) {
           throw new Error("Insufficient funds for gas (0 ETH)");
        }

        const calls = req.payload.params?.[0]?.calls || [];
        for (const call of calls) {
          try {
            txHash = await walletClient.sendTransaction({
              to: call.to,
              value: call.value ? BigInt(call.value) : undefined,
              data: call.data && call.data !== '0x' ? call.data : undefined,
            });
          } catch (e: any) {
            if (e.message?.includes('reverted') || e.message?.includes('gas')) {

               txHash = await walletClient.sendTransaction({
                 to: call.to,
                 value: call.value ? BigInt(call.value) : undefined,
                 data: call.data && call.data !== '0x' ? call.data : undefined,
                 gas: 2000000n
               });
            } else {
               throw e;
            }
          }
          
          if (calls.length > 1) {
            try {
              await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            } catch (e) {

            }
          }
          
          store.addTransaction({
            hash: txHash,
            type: 'contract_call',
            status: 'pending',
            timestamp: Date.now(),
            chainId: store.getChainId(),
            to: call.to,
            description: 'Contract Call (Batch)'
          });
        }
      } else {
        const tx = req.payload.params?.[0] || req.payload;
        
        const { getPublicClient } = await import('./actions');
        const publicClient = getPublicClient();
        const balance = await publicClient.getBalance({ address: account.address });
        if (balance === 0n) {
           throw new Error("Insufficient funds for gas (0 ETH)");
        }

        try {
          txHash = await walletClient.sendTransaction({
            to: tx.to,
            value: tx.value ? BigInt(tx.value) : undefined,
            data: tx.data && tx.data !== '0x' ? tx.data : undefined,
          });
        } catch (e: any) {
          if (e.message?.includes('reverted') || e.message?.includes('gas')) {

             txHash = await walletClient.sendTransaction({
               to: tx.to,
               value: tx.value ? BigInt(tx.value) : undefined,
               data: tx.data && tx.data !== '0x' ? tx.data : undefined,
               gas: 2000000n
             });
          } else {
             throw e;
          }
        }
        
        store.addTransaction({
          hash: txHash,
          type: req.payload.metadata?.type || 'contract_call',
          status: 'pending',
          timestamp: Date.now(),
          chainId: store.getChainId(),
          to: tx.to,
          description: req.payload.metadata?.description || 'Contract Call',
          amount: req.payload.metadata?.amount,
          symbol: req.payload.metadata?.symbol,
        });

        const currentHash = txHash;
        publicClient.waitForTransactionReceipt({ hash: currentHash as `0x${string}` })
          .then((receipt) => {
            const status = receipt.status === 'success' ? 'confirmed' : 'failed';
            store.updateTransaction(currentHash, status);
          })
          .catch(() => {
            store.updateTransaction(currentHash, 'failed');
          });
      }
      
      store.resolveRequest(id, req.payload.method === 'wallet_sendCalls' ? txHash : txHash);
    }
  } catch (error: any) {
    throw error;
  }
}

export function rejectWeb3Request(id: string) {
  const error = new ProviderRpcError('User rejected request', 4001);
  store.rejectRequest(id, error);
}

