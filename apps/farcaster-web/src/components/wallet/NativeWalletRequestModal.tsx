import React, { useEffect, useState } from 'react';
import { subscribeToWeb3Requests, approveWeb3Request, rejectWeb3Request, store, getChainById, POPULAR_TOKENS } from 'farcaster-wallet';
import type { PendingRequest } from 'farcaster-wallet';
import { cn } from '~/lib/utils';
import { fromHex, formatEther, parseUnits } from 'viem';

const NetworkLogo = ({ chainId, className }: { chainId: number, className?: string }) => {
  const [error, setError] = useState(false);
  const logos: Record<number, string> = {
    1: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=029',
    8453: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg',
    10: 'https://cryptologos.cc/logos/optimism-op-logo.svg?v=029',
    42161: 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=029',
    56: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=029',
    7777777: 'https://zora.co/favicon.ico',
  };
  
  if (error) return <span className={className || "w-4 h-4 inline-flex items-center justify-center mr-1.5 align-text-bottom text-xs bg-gray-500/20 rounded-full"}>🌐</span>;
  const src = logos[chainId] || 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=029';
  return <img src={src} alt="" onError={() => setError(true)} className={className || "w-4 h-4 inline-block mr-1.5 align-text-bottom"} />;
};

export const NativeWalletRequestModal: React.FC = () => {
  const [requests, setRequests] = useState<PendingRequest[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editedAmount, setEditedAmount] = useState('');
  const [forceRender, setForceRender] = useState(0);

  useEffect(() => {
    return subscribeToWeb3Requests((newRequests) => {
      setRequests(newRequests);
    });
  }, []);

  const currentRequestId = requests.length > 0 ? requests[0].id : null;
  useEffect(() => {
    if (currentRequestId) {
      setIsSubmitting(false);
      setErrorMsg(null);
    }
  }, [currentRequestId]);

  if (requests.length === 0) return null;

  const currentRequest = requests[0];
  const isSign = currentRequest.type === 'sign';

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transaction failed or timed out. Please check your gas.")), 60000)
      );
      await Promise.race([
        approveWeb3Request(currentRequest.id),
        timeoutPromise
      ]);
    } catch (e: any) {
      let msg = e?.shortMessage || e?.message || String(e);
      if (msg.includes('reverted') || msg.includes('HTTP request failed')) {
        msg = "Transaction Failed: The network rejected this action (e.g., you do not have enough tokens for this transfer).";
      } else if (msg.length > 150) {
        msg = msg.substring(0, 150) + "...";
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => rejectWeb3Request(currentRequest.id);

  const chainId = store.getChainId();
  const chain = getChainById(chainId);
  const networkName = chain?.name || 'Unknown Network';
  const currencySymbol = chain?.nativeCurrency?.symbol || 'ETH';

  let decodedContent = null;
  
  const ReceiptRow = ({ label, value, isCode }: { label: React.ReactNode, value: React.ReactNode, isCode?: boolean }) => (
    <div className="flex justify-between items-start border-b border-border/30 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <div className="text-secondary-text text-sm font-medium shrink-0 mr-4">{label}</div>
      <div className={cn("text-primary-text text-sm text-right break-all", isCode && "font-mono text-xs bg-background p-1.5 rounded border border-border/50")}>
        {value}
      </div>
    </div>
  );
  
  if (isSign) {
    const method = currentRequest.payload.method;
    if (method === 'personal_sign') {
      const hexMsg = currentRequest.payload.message || currentRequest.payload.params?.[0];
      try {
        const decoded = typeof hexMsg === 'string' && hexMsg.startsWith('0x') ? fromHex(hexMsg as any, 'string') : hexMsg;
        decodedContent = (
          <div className="flex flex-col">
             <ReceiptRow label="Action" value={<span className="bg-purple-500/10 text-purple-500 px-2 py-1 rounded font-medium">Sign Message</span>} />
             <ReceiptRow label="Network" value={<span className="bg-muted px-2 py-1 rounded flex items-center w-fit ml-auto"><NetworkLogo chainId={chainId} />{networkName}</span>} />
             <div className="mt-2">
               <div className="text-secondary-text text-sm font-medium mb-2">Message</div>
               <div className="bg-background rounded-lg p-3 text-primary-text border border-border/50 text-sm whitespace-pre-wrap">{decoded}</div>
             </div>
          </div>
        );
      } catch (e) {
        decodedContent = <div className="text-sm break-all">{hexMsg}</div>;
      }
    } else if (method === 'eth_signTypedData_v4') {
      const typedData = currentRequest.payload.typedData || JSON.parse(currentRequest.payload.params?.[1] || '{}');
      decodedContent = (
        <div className="flex flex-col">
           <ReceiptRow label="Action" value={<span className="bg-purple-500/10 text-purple-500 px-2 py-1 rounded font-medium">Sign Typed Data</span>} />
           <ReceiptRow label="Network" value={<span className="bg-muted px-2 py-1 rounded flex items-center w-fit ml-auto"><NetworkLogo chainId={chainId} />{networkName}</span>} />
           <ReceiptRow label="Domain" value={typedData.domain?.name || 'Unknown'} />
           <div className="mt-2">
             <div className="text-secondary-text text-sm font-medium mb-2">Data</div>
             <pre className="bg-background rounded-lg p-3 text-primary-text border border-border/50 text-xs overflow-x-auto">
               {JSON.stringify(typedData.message, null, 2)}
             </pre>
           </div>
        </div>
      );
    } else {
      decodedContent = <pre className="text-xs">{JSON.stringify(currentRequest.payload, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}</pre>;
    }
  } else {
    // Transaction
    const method = currentRequest.payload.method;
    let tx;
    let isBatch = false;
    let batchCount = 1;
    let allCalls: any[] = [];
    
    if (method === 'wallet_sendCalls') {
      allCalls = currentRequest.payload.params?.[0]?.calls || [];
      batchCount = allCalls.length;
      if (batchCount > 1) isBatch = true;
      tx = allCalls[0] || {};
    } else {
      tx = currentRequest.payload.params?.[0] || currentRequest.payload;
      allCalls = [tx];
    }
    
    let valueEth = '0';
    try {
      if (tx.value && tx.value !== '0x') {
        valueEth = formatEther(BigInt(tx.value));
      }
    } catch (e) {

    }
    
    let actionLabel = "Send Transaction";
    const nativeSymbol = chainId === 56 ? 'BNB' : chainId === 2020 ? 'RON' : 'ETH';
    
    let isErc20Approve = false;
    let isErc20Transfer = false;
    let isSmartContractCall = false;
    let decodedErc20Amount = '';
    let erc20Spender = '';
    let erc20Symbol = '';
    let tokenDecimals = 18;
    let approveCallIndex = -1;

    for (let i = 0; i < allCalls.length; i++) {
      const call = allCalls[i];
      if (call.data && call.data.startsWith('0x095ea7b3')) {
        isErc20Approve = true;
        approveCallIndex = i;
        if (!isBatch) actionLabel = "Approve Token Spend Limit";
      } else if (call.data && call.data.startsWith('0xa9059cbb')) {
        isErc20Transfer = true;
        if (!isBatch) actionLabel = "Transfer Token";
      } else if (call.data && call.data !== '0x') {
        isSmartContractCall = true;
        if (!isBatch) actionLabel = "Smart Contract Execution";
      }
    }

    if (isBatch) {
      actionLabel = `Batch Transaction (${batchCount} Actions)`;
    }

    if (isErc20Approve || isErc20Transfer) {
      try {
        erc20Spender = '0x' + tx.data.slice(34, 74).replace(/^0+/, '');
        if (erc20Spender === '0x') erc20Spender = '0x0000000000000000000000000000000000000000';
        const rawAmountStr = tx.data.slice(74);
        const rawAmount = rawAmountStr ? BigInt('0x' + rawAmountStr).toString() : '0';
        
        const allTokens = [...(POPULAR_TOKENS[chainId] || []), ...store.getCustomTokens(chainId)];
        const token = allTokens.find(t => t.address.toLowerCase() === tx.to?.toLowerCase());
        if (token) {
          erc20Symbol = token.symbol;
          tokenDecimals = token.decimals;
          if (rawAmountStr.toLowerCase() === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') {
            decodedErc20Amount = 'Unlimited';
          } else {
            decodedErc20Amount = (Number(rawAmount) / (10 ** token.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });
          }
        } else {
          erc20Symbol = "Unknown Token";
          decodedErc20Amount = "Raw: " + rawAmount;
        }
      } catch (e) {

      }
    }
    
    decodedContent = (
      <div className="flex flex-col">
         <ReceiptRow label="Action" value={<span className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded font-medium">{actionLabel}</span>} />
         <ReceiptRow label="Network" value={<span className="bg-muted px-2 py-1 rounded flex items-center w-fit ml-auto"><NetworkLogo chainId={chainId} />{networkName}</span>} />
         
         {isErc20Approve ? (
           <ReceiptRow label="Contract" value={tx?.to || 'Unknown'} isCode={true} />
         ) : isErc20Transfer ? (
           <ReceiptRow label="To" value={erc20Spender || 'Unknown'} isCode={true} />
         ) : (
           <ReceiptRow label="To" value={tx?.to || 'Contract Creation'} isCode={true} />
         )}

         {(isErc20Approve || isErc20Transfer) ? (
           <ReceiptRow label="Token Amount" value={
              <div className="flex flex-col items-end gap-1">
                {isEditingAmount ? (
                  <div className="flex gap-2 items-center">
                    <input 
                      type="number" 
                      value={editedAmount} 
                      onChange={e => setEditedAmount(e.target.value)} 
                      className="w-24 bg-background border border-border/50 rounded px-2 py-1 text-sm outline-none text-right text-primary-text"
                      placeholder="Amount"
                    />
                    <button 
                      onClick={() => {
                        if (approveCallIndex >= 0 && editedAmount) {
                          try {
                            const newAmountBig = parseUnits(editedAmount, tokenDecimals);
                            const newHexAmount = newAmountBig.toString(16).padStart(64, '0');
                            const oldData = allCalls[approveCallIndex].data;
                            allCalls[approveCallIndex].data = oldData.slice(0, 74) + newHexAmount;
                            setForceRender(f => f + 1);
                            setIsEditingAmount(false);
                          } catch (e) {
                            alert("Invalid amount");
                          }
                        }
                      }}
                      className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                    >Save</button>
                    <button onClick={() => setIsEditingAmount(false)} className="text-secondary-text text-xs hover:text-primary-text">Cancel</button>
                  </div>
                ) : (
                  <span className="font-bold flex items-center justify-end text-blue-500">
                    {decodedErc20Amount} {erc20Symbol}
                    {isErc20Approve && (
                       <button 
                         onClick={() => {
                           setIsEditingAmount(true);
                           setEditedAmount(decodedErc20Amount === 'Unlimited' ? '' : decodedErc20Amount.replace(/,/g, ''));
                         }}
                         className="ml-2 text-xs text-blue-600 hover:underline cursor-pointer"
                       >
                         (Edit)
                       </button>
                    )}
                  </span>
                )}
              </div>
           } />
         ) : (
           <ReceiptRow label="Amount" value={<span className="font-bold flex items-center justify-end">{valueEth} <span className="ml-1 text-[10px] text-muted uppercase bg-surface-secondary px-1.5 py-0.5 rounded font-bold">{nativeSymbol}</span></span>} />
         )}
         
         {isErc20Approve && decodedErc20Amount === 'Unlimited' && (
           <div className="mt-4 bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-start gap-3">
             <span className="text-red-500 text-xl leading-none">⚠️</span>
             <p className="text-red-500 text-xs font-medium m-0 leading-tight">You are granting <span className="font-bold">UNLIMITED</span> access to your <span className="font-bold">{erc20Symbol}</span>. Consider editing the amount for security.</p>
           </div>
         )}
         
         {isErc20Approve && decodedErc20Amount !== 'Unlimited' && (
           <div className="mt-4 bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg flex items-start gap-3">
             <span className="text-blue-500 text-xl leading-none">ℹ️</span>
             <p className="text-blue-500 text-xs font-medium m-0 leading-tight">You are approving a contract to spend <span className="font-bold">{decodedErc20Amount} {erc20Symbol}</span>. Only approve if you trust this miniapp.</p>
           </div>
         )}
         
         {isSmartContractCall && (
            <div className="mt-4 bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg flex items-start gap-3">
              <span className="text-orange-500 text-xl leading-none">⚠️</span>
              <p className="text-orange-500 text-xs font-medium m-0 leading-tight">You are interacting with a smart contract. This action may claim tokens or spend assets you have previously approved.</p>
            </div>
         )}

         {tx?.data && tx.data !== '0x' && !isErc20Approve && !isErc20Transfer && (
           <div className="mt-2 flex flex-col gap-2">
              <div className="text-secondary-text text-sm font-medium">Raw Data (Hex)</div>
              <div className="bg-background p-2 rounded-lg border border-border/50 max-h-32 overflow-y-auto">
                <div className="font-mono text-xs text-secondary-text break-all">
                  {tx.data}
                </div>
              </div>
           </div>
         )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
       <div className="bg-app shadow-2xl rounded-2xl w-full max-w-md p-6 border border-muted/20 zoom-in-95 animate-in duration-300">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-500">
              {isSign ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6"/><path d="M15.2 3.2a2.82 2.82 0 1 1 4 4L7.5 19 3 20l1-4.5z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
              )}
            </div>
            <h2 className="text-xl font-bold text-primary-text text-center">
              {isSign ? 'Signature Request' : 'Transaction Request'}
            </h2>
            <p className="text-secondary-text text-center text-sm mt-2">
              A Farcaster Mini-App is requesting to {isSign ? 'sign a message' : 'send a transaction'} using your wallet.
            </p>
          </div>
          
          <div className="bg-muted p-4 rounded-xl mb-6 border border-muted/30">
            {decodedContent}
          </div>
          
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg mb-6 max-h-32 overflow-y-auto">
               <p className="text-red-500 text-xs font-mono font-medium">{errorMsg}</p>
            </div>
          )}
          
          <div className="flex gap-3 w-full">
             <button 
                onClick={handleReject} 
                className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 font-semibold hover:bg-red-500/20 active:scale-95 transition-all"
             >
                Reject
             </button>
             <button 
                onClick={handleApprove} 
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
             >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </>
                ) : 'Approve'}
             </button>
          </div>
       </div>
    </div>
  );
};
