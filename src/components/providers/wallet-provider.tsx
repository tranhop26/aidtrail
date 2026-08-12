"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import type { Address } from "../../lib/domain";
import type { InjectedProvider } from "../../lib/genlayer/write-client";

export type WalletStatus = "disconnected" | "connecting" | "connected" | "wrong_network" | "rejected" | "unavailable";
export interface WalletState { status: WalletStatus; account?: Address; chainId?: string; error?: string; provider?: InjectedProvider; }
interface WalletContextValue extends WalletState { connect(): Promise<void>; disconnect(): void; }

const WalletContext = createContext<WalletContextValue | null>(null);
const unavailable: WalletState = { status: "unavailable", error: "No injected wallet was found in this browser." };

function injectedProvider(): InjectedProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: InjectedProvider }).ethereum;
}
function isExpectedNetwork(chainId: string, expectedChainId?: string) {
  if (!expectedChainId) return true;
  try { return BigInt(chainId) === BigInt(expectedChainId); }
  catch { return chainId.toLowerCase() === expectedChainId.toLowerCase(); }
}

export function WalletProvider({ children, expectedChainId = process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID }: { children: ReactNode; expectedChainId?: string }) {
  const [state, setState] = useState<WalletState>({ status: "disconnected" });
  const update = useCallback((account: unknown, chainId: unknown, provider = injectedProvider()) => {
    const selected = Array.isArray(account) ? account[0] : account;
    if (typeof selected !== "string" || !selected.startsWith("0x")) return setState({ status: "disconnected", provider });
    if (typeof chainId !== "string") return setState({ status: "wrong_network", account: selected as Address, provider, error: "The wallet did not return a network id." });
    return setState(isExpectedNetwork(chainId, expectedChainId) ? { status: "connected", account: selected as Address, chainId, provider } : { status: "wrong_network", account: selected as Address, chainId, provider, error: "Switch your wallet to the configured Studionet network." });
  }, [expectedChainId]);

  useEffect(() => {
    const provider = injectedProvider();
    if (!provider) { queueMicrotask(() => setState(unavailable)); return; }
    void Promise.all([provider.request({ method: "eth_accounts" }), provider.request({ method: "eth_chainId" })]).then(([accounts, chainId]) => update(accounts, chainId, provider)).catch(() => setState({ status: "disconnected", provider }));
    const evented = provider as InjectedProvider & { on?: (event: string, callback: (value: unknown) => void) => void; removeListener?: (event: string, callback: (value: unknown) => void) => void };
    const accountsChanged = (accounts: unknown) => { void provider.request({ method: "eth_chainId" }).then((chainId) => update(accounts, chainId, provider)); };
    const chainChanged = (chainId: unknown) => { void provider.request({ method: "eth_accounts" }).then((accounts) => update(accounts, chainId, provider)); };
    evented.on?.("accountsChanged", accountsChanged); evented.on?.("chainChanged", chainChanged);
    return () => { evented.removeListener?.("accountsChanged", accountsChanged); evented.removeListener?.("chainChanged", chainChanged); };
  }, [update]);

  const connect = useCallback(async () => {
    const provider = injectedProvider();
    if (!provider) { setState(unavailable); return; }
    setState({ status: "connecting", provider });
    try { const [accounts, chainId] = await Promise.all([provider.request({ method: "eth_requestAccounts" }), provider.request({ method: "eth_chainId" })]); update(accounts, chainId, provider); }
    catch (error) { setState({ status: "rejected", provider, error: error instanceof Error ? error.message : "Wallet connection was rejected." }); }
  }, [update]);
  const disconnect = useCallback(() => setState((current) => ({ status: "disconnected", provider: current.provider })), []);
  const value: WalletContextValue = { ...state, connect, disconnect };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used within WalletProvider");
  return value;
}
