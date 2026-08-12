"use client";

import { type ReactNode } from "react";

import { TransactionProvider } from "../components/providers/transaction-provider";
import { WalletProvider } from "../components/providers/wallet-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <WalletProvider><TransactionProvider>{children}</TransactionProvider></WalletProvider>;
}
