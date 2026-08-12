import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

import { WalletButton } from "../wallet/wallet-button";

export function AppShell({ children }: { children: ReactNode }) {
  return <>
    <a className="skip-link" href="#main-content">Skip to grants</a>
    <header className="site-header">
      <Link className="brand" href="/grants" aria-label="AidTrail Explore"><Image src="/aidtrail-mark.svg" alt="" width={38} height={38} /><span>Aid<span>Trail</span></span></Link>
      <nav aria-label="Main navigation"><Link href="/grants" aria-current="page">Explore</Link><a href="#how-it-works">How it works</a><a href="#trust">Trust trail</a></nav>
      <WalletButton />
    </header>
    <div id="main-content">{children}</div>
    <footer className="site-footer" id="trust"><div><span className="brand-word">Aid<span>Trail</span></span><p>Follow community funding from pledge to proof.</p></div><p>GEN values are simulated Studionet testnet value, not money.</p></footer>
  </>;
}
