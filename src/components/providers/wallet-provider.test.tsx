import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WalletButton } from "../wallet/wallet-button";
import { WalletProvider } from "./wallet-provider";

describe("WalletProvider hydration", () => {
  it("renders a stable connect state before browser wallet detection", () => {
    const html = renderToString(<WalletProvider><WalletButton /></WalletProvider>);

    expect(html).toContain("Connect wallet");
    expect(html).not.toContain("Wallet unavailable");
  });
});
