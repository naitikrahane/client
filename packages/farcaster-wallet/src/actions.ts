import { createPublicClient, createWalletClient, http, fallback, formatEther, parseEther, formatUnits, type Address, type Hash } from 'viem';
import type { HDAccount, Account } from 'viem/accounts';
import { base, mainnet, optimism, zora, arbitrum, bsc, ronin } from 'viem/chains';
import { store } from './store';
import { BASE_FALLBACK_RPCS } from './rpc';

// ── Custom Chains ──
const ink = {
  id: 57073,
  name: 'Ink',
  network: 'ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-gel.inkonchain.com'] }, public: { http: ['https://rpc-gel.inkonchain.com'] } }
};

const robinhood = {
  id: 4663,
  name: 'Robinhood',
  network: 'robinhood',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] }, public: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Robinhood Chain Blockscout', url: 'https://explorer.mainnet.chain.robinhood.com' } }
};

// ── Chains Mapping ──
const supportedChains = [base, mainnet, optimism, zora, arbitrum, bsc, ink, ronin, robinhood];
export function getChainById(id: number) {
  return supportedChains.find(c => c.id === id) || base;
}

export function getPublicClient() {
  const chainId = store.getChainId();
  const chain = getChainById(chainId);
  const customRpc = store.getCustomRpc(chainId);

  const transports = [];
  if (customRpc && customRpc.url) transports.push(http(customRpc.url));
  
  if (chainId === 8453) {
    BASE_FALLBACK_RPCS.forEach(url => transports.push(http(url)));
  } else {
    transports.push(http());
  }

  return createPublicClient({
    chain,
    transport: fallback(transports, { retryCount: 1 }),
  });
}

export function getWalletClient(account: HDAccount | Account) {
  const chainId = store.getChainId();
  const chain = getChainById(chainId);
  const customRpc = store.getCustomRpc(chainId);
  
  const transports = [];
  if (customRpc && customRpc.url) transports.push(http(customRpc.url));
  
  if (chainId === 8453) {
    BASE_FALLBACK_RPCS.forEach(url => transports.push(http(url)));
  } else {
    transports.push(http());
  }

  return createWalletClient({
    account,
    chain,
    transport: fallback(transports, { retryCount: 1 }),
  });
}

// ── ERC-20 ABI (minimal) ──
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ── Uniswap V2 Router ABI (minimal for swaps) ──
const UNISWAP_V2_ROUTER_ABI = [
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'WETH',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ── Contract addresses ──
export const BASE_CONTRACTS = {
  UNISWAP_V2_ROUTER: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' as Address,
  WETH: '0x4200000000000000000000000000000000000006' as Address,
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  DEGEN: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed' as Address,
};

export const POPULAR_TOKENS: Record<number, { address: Address; symbol: string; decimals: number; name: string }[]> = {
  1: [ // Mainnet
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  ],
  10: [ // Optimism
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  ],
  8453: [ // Base
    { address: BASE_CONTRACTS.WETH, symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: BASE_CONTRACTS.USDC, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', decimals: 8, name: 'Coinbase Wrapped BTC' },
    { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', symbol: 'cbETH', decimals: 18, name: 'Coinbase Wrapped Staked ETH' },
    { address: BASE_CONTRACTS.DEGEN, symbol: 'DEGEN', decimals: 18, name: 'Degen' },
    { address: '0xE3086852A4B125803C815a158249ae468A3254Ca', symbol: 'MFER', decimals: 18, name: 'mfercoin' },
  ],
  7777777: [ // Zora
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
  ],
  42161: [ // Arbitrum
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  ],
  56: [ // BSC
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB', decimals: 18, name: 'Wrapped BNB' },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18, name: 'USD Coin' },
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18, name: 'Tether USD' },
  ],
  57073: [ // Ink
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
  ]
};

// ── Types ──
export type TokenBalance = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  rawBalance: bigint;
};

// ══════════════════════════════════════════════
// VIEW — Read balances from chain
// ══════════════════════════════════════════════

export async function getEthBalance(address: Address): Promise<string> {
  const publicClient = getPublicClient();
  const balance = await publicClient.getBalance({ address });
  return formatEther(balance);
}

export async function resolveFarcasterUsername(username: string): Promise<Address | null> {
  try {
    const cleanName = username.startsWith('@') ? username.slice(1) : username;
    const res = await fetch(`https://client.warpcast.com/v2/user-by-username?username=${cleanName}`);
    if (!res.ok) return null;
    const data = await res.json();
    const extras = data?.result?.extras;
    if (!extras) return null;
    if (extras.ethWallets && extras.ethWallets.length > 0) {
      return extras.ethWallets[0] as Address;
    }
    return extras.custodyAddress as Address || null;
  } catch (e) {
    return null;
  }
}

export async function getTokenBalance(
  walletAddress: Address,
  token: { address: string; symbol: string; name: string; decimals: number }
): Promise<TokenBalance> {
  const publicClient = getPublicClient();
  let balance = 0n;
  try {
    balance = await publicClient.readContract({
      address: token.address as Address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    }) as bigint;
  } catch (e) {

  }

  return {
    address: token.address as Address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    balance: formatUnits(balance, token.decimals),
    rawBalance: balance,
  };
}

export async function getAllBalances(walletAddress: Address): Promise<{
  eth: string;
  tokens: TokenBalance[];
}> {
  const chainId = store.getChainId();
  const tokensToCheck = [...(POPULAR_TOKENS[chainId] || []), ...store.getCustomTokens(chainId)];

  const [eth, ...tokens] = await Promise.all([
    getEthBalance(walletAddress),
    ...tokensToCheck.map((t) => getTokenBalance(walletAddress, {
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals
    })),
  ]);

  return { eth, tokens };
}

export async function fetchTokenInfo(tokenAddress: Address): Promise<{ symbol: string; name: string; decimals: number }> {
  const publicClient = getPublicClient();
  const [decimals, symbol, name] = await Promise.all([
    publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' }),
    publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' }),
    publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'name' }),
  ]);
  return { decimals: decimals as number, symbol: symbol as string, name: name as string };
}

export async function getMaxEthAmount(accountAddress: Address): Promise<string> {
  const publicClient = getPublicClient();
  const balance = await publicClient.getBalance({ address: accountAddress });
  const gasPrice = await publicClient.getGasPrice();
  // Safe estimate for a standard ETH transfer is 21000
  // For a swap it can be ~150,000, but we use 30000 to be safe for standard send
  const estimatedGasCost = gasPrice * 30000n;
  if (balance <= estimatedGasCost) return '0';
  return formatEther(balance - estimatedGasCost);
}

// ══════════════════════════════════════════════
// SEND — Transfer ETH or ERC-20 tokens
// ══════════════════════════════════════════════

export async function sendETH(
  account: HDAccount,
  to: Address,
  amountEth: string,
): Promise<Hash> {
  const walletClient = getWalletClient(account);

  const value = parseEther(amountEth);
  
  try {
    const txHash = await walletClient.sendTransaction({
      to,
      value,
    });
    return txHash;
  } catch (e: any) {
    if (e.message.includes('insufficient funds')) {
      throw new Error(`Insufficient funds for gas + value. Try sending less ETH or use MAX.`);
    }
    throw e;
  }
}

export async function sendERC20(
  account: HDAccount,
  to: Address,
  tokenAddress: Address,
  amount: string,
  decimals: number,
): Promise<Hash> {
  const walletClient = getWalletClient(account);

  const amountWei = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));
  
  // Encode transfer(to, amount) call
  const transferData = encodeFunctionCall('transfer', [to, amountWei]) as `0x${string}`;
  
  try {
    const txHash = await walletClient.sendTransaction({
      to: tokenAddress,
      data: transferData,
    });
    return txHash;
  } catch (e: any) {
    if (e.message.includes('insufficient funds')) {
      throw new Error(`Insufficient ETH for gas fee. You need native ETH to send tokens.`);
    }
    throw e;
  }
}

// ══════════════════════════════════════════════
// SWAP — Buy/Sell tokens via Uniswap V2 on Base
// ══════════════════════════════════════════════

export type SwapQuote = {
  amountOut: string;
  estimate: any;
  transactionRequest: any;
  toolDetails?: any;
};

export async function getSwapQuote(
  amountIn: string,
  tokenIn: Address | 'ETH',
  tokenOut: Address | 'ETH',
  fromAddress?: Address,
  destChainId?: number
): Promise<SwapQuote | null> {
  const chainId = store.getChainId();
  const toChainId = destChainId || chainId;
  const fromToken = tokenIn === 'ETH' ? '0x0000000000000000000000000000000000000000' : tokenIn;
  const toToken = tokenOut === 'ETH' ? '0x0000000000000000000000000000000000000000' : tokenOut;
  
  // Need to get decimals of tokenIn
  let decimalsIn = 18;
  if (tokenIn !== 'ETH') {
    const allTokens = [...(POPULAR_TOKENS[chainId] || []), ...store.getCustomTokens(chainId)];
    const t = allTokens.find(t => t.address.toLowerCase() === tokenIn.toLowerCase());
    if (t) decimalsIn = t.decimals;
  }
  
  const fromAmountWei = BigInt(Math.floor(parseFloat(amountIn) * (10 ** decimalsIn))).toString();
  
  const url = `https://li.quest/v1/quote?fromChain=${chainId}&toChain=${toChainId}&fromToken=${fromToken}&toToken=${toToken}&fromAmount=${fromAmountWei}` + (fromAddress ? `&fromAddress=${fromAddress}` : '');
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.estimate || !data.transactionRequest) return null;
    
    // Get decimals of tokenOut
    let decimalsOut = 18;
    if (tokenOut !== 'ETH') {
      const allTokens = [...(POPULAR_TOKENS[toChainId] || []), ...store.getCustomTokens(toChainId)];
      const t = allTokens.find(t => t.address.toLowerCase() === (tokenOut as Address).toLowerCase());
      if (t) decimalsOut = t.decimals;
    }

    const amountOut = formatUnits(BigInt(data.estimate.toAmount), decimalsOut);
    
    return {
      amountOut,
      estimate: data.estimate,
      transactionRequest: data.transactionRequest,
      toolDetails: data.toolDetails,
    };
  } catch (e) {

    return null;
  }
}


// ══════════════════════════════════════════════
// TRANSACTION STATUS
// ══════════════════════════════════════════════

export async function waitForTransaction(hash: Hash): Promise<'success' | 'reverted'> {
  const publicClient = getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt.status;
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════



// Minimal ABI encoding helpers (avoid importing ethers just for encoding)
function encodeFunctionCall(name: string, args: any[]): string {
  if (name === 'transfer') {
    // transfer(address,uint256) selector: 0xa9059cbb
    const to = (args[0] as string).slice(2).padStart(64, '0');
    const amount = (args[1] as bigint).toString(16).padStart(64, '0');
    return '0xa9059cbb' + to + amount;
  }
  if (name === 'approve') {
    // approve(address,uint256) selector: 0x095ea7b3
    const spender = (args[0] as string).slice(2).padStart(64, '0');
    const amount = (args[1] as bigint).toString(16).padStart(64, '0');
    return '0x095ea7b3' + spender + amount;
  }
  throw new Error('Unknown function: ' + name);
}

function encodeSwapETHForTokens(amountOutMin: bigint, path: Address[], to: Address, deadline: bigint): string {
  // swapExactETHForTokens(uint256,address[],address,uint256) selector: 0x7ff36ab5
  const selector = '0x7ff36ab5';
  const amountOutMinHex = amountOutMin.toString(16).padStart(64, '0');
  // offset for path array (4 * 32 = 128 = 0x80)
  const pathOffset = '0000000000000000000000000000000000000000000000000000000000000080';
  const toHex = to.slice(2).padStart(64, '0');
  const deadlineHex = deadline.toString(16).padStart(64, '0');
  // path array length
  const pathLen = path.length.toString(16).padStart(64, '0');
  // path items
  const pathItems = path.map(p => p.slice(2).padStart(64, '0')).join('');
  
  return selector + amountOutMinHex + pathOffset + toHex + deadlineHex + pathLen + pathItems;
}

function encodeSwapTokensForETH(amountIn: bigint, amountOutMin: bigint, path: Address[], to: Address, deadline: bigint): string {
  // swapExactTokensForETH(uint256,uint256,address[],address,uint256) selector: 0x18cbafe5
  const selector = '0x18cbafe5';
  const amountInHex = amountIn.toString(16).padStart(64, '0');
  const amountOutMinHex = amountOutMin.toString(16).padStart(64, '0');
  // offset for path array (5 * 32 = 160 = 0xa0)
  const pathOffset = '00000000000000000000000000000000000000000000000000000000000000a0';
  const toHex = to.slice(2).padStart(64, '0');
  const deadlineHex = deadline.toString(16).padStart(64, '0');
  // path array
  const pathLen = path.length.toString(16).padStart(64, '0');
  const pathItems = path.map(p => p.slice(2).padStart(64, '0')).join('');
  
  return selector + amountInHex + amountOutMinHex + pathOffset + toHex + deadlineHex + pathLen + pathItems;
}

function encodeSwapTokensForTokens(amountIn: bigint, amountOutMin: bigint, path: Address[], to: Address, deadline: bigint): string {
  // swapExactTokensForTokens(uint256,uint256,address[],address,uint256) selector: 0x38ed1739
  const selector = '0x38ed1739';
  const amountInHex = amountIn.toString(16).padStart(64, '0');
  const amountOutMinHex = amountOutMin.toString(16).padStart(64, '0');
  // offset for path array (5 * 32 = 160 = 0xa0)
  const pathOffset = '00000000000000000000000000000000000000000000000000000000000000a0';
  const toHex = to.slice(2).padStart(64, '0');
  const deadlineHex = deadline.toString(16).padStart(64, '0');
  // path array
  const pathLen = path.length.toString(16).padStart(64, '0');
  const pathItems = path.map(p => p.slice(2).padStart(64, '0')).join('');
  
  return selector + amountInHex + amountOutMinHex + pathOffset + toHex + deadlineHex + pathLen + pathItems;
}
