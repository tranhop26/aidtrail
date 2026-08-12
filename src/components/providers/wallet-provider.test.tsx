import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { WalletButton } from "../wallet/wallet-button";
import { WalletProvider } from "./wallet-provider";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("WalletProvider hydration", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "ethereum");
  });

  it("renders a stable connect state before browser wallet detection", () => {
    const html = renderToString(<WalletProvider><WalletButton /></WalletProvider>);

    expect(html).toContain("Connect wallet");
    expect(html).not.toContain("Wallet unavailable");
  });

  it("accepts equivalent decimal and hexadecimal Studionet chain ids", async () => {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: {
        request: async ({ method }: { method: string }) => method === "eth_accounts"
          ? ["0x21b4000000000000000000000000000000002ec7"]
          : "0xf22f",
      },
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<WalletProvider expectedChainId="61999"><WalletButton /></WalletProvider>);
      await Promise.resolve();
    });

    expect(container.textContent).toBe("0x21b4…2ec7");
    await act(async () => root.unmount());
  });

  it("uses the GenLayer wallet flow to switch a connected wallet to Studionet", async () => {
    let chainId = "0x1";
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: {
        request: async ({ method, params }: { method: string; params?: Array<{ chainId?: string }> }) => {
          if (method === "eth_accounts" || method === "eth_requestAccounts") return ["0x21b4000000000000000000000000000000002ec7"];
          if (method === "eth_chainId") return chainId;
          if (method === "wallet_addEthereumChain") return null;
          if (method === "wallet_switchEthereumChain") { chainId = params?.[0]?.chainId ?? chainId; return null; }
          if (method === "wallet_getSnaps") return { "npm:genlayer-wallet-plugin": { id: "npm:genlayer-wallet-plugin" } };
          throw new Error(`unexpected provider method: ${method}`);
        },
      },
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<WalletProvider expectedChainId="61999"><WalletButton /></WalletProvider>); await Promise.resolve(); });

    expect(container.textContent).toBe("Wrong network");
    await act(async () => { container.querySelector("button")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(chainId).toBe("0xf22f");
    expect(container.textContent).toBe("0x21b4…2ec7");
    await act(async () => root.unmount());
  });
});
