"use client";

import { useWallet } from "../providers/wallet-provider";

function shortAddress(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }

export function WalletButton() {
  const wallet = useWallet();
  if (wallet.status === "connected" && wallet.account) return <button className="wallet-button" type="button" onClick={wallet.disconnect} title="Disconnect this site from the selected wallet">{shortAddress(wallet.account)}</button>;
  const label = wallet.status === "connecting" ? "Connecting wallet…" : wallet.status === "wrong_network" ? "Wrong network" : wallet.status === "unavailable" ? "Wallet unavailable" : "Connect wallet";
  return <button className="wallet-button" type="button" disabled={wallet.status === "connecting" || wallet.status === "unavailable"} title={wallet.error} onClick={() => void wallet.connect()}>{label}</button>;
}
