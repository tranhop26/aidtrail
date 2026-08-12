import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Hash } from "genlayer-js/types";

const sourcePath = new URL("../contracts/AidTrail.py", import.meta.url);
const dependencyPin = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6";
const officialEndpoint = studionet.rpcUrls.default.http[0];

function normalizedUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const source = await readFile(sourcePath);
  const sourceHash = `0x${createHash("sha256").update(source).digest("hex")}`;
  const output = {
    address: null as string | null,
    transactionHash: null as string | null,
    deployerAddress: null as string | null,
    sourceHash,
    dependencyPin,
    network: "studionet",
  };

  if (!process.argv.includes("--execute")) {
    console.log(JSON.stringify(output));
    return;
  }

  if (required("AIDTRAIL_NETWORK") !== "studionet") {
    throw new Error("deployment is restricted to the confirmed studionet target");
  }
  const privateKey = required("AIDTRAIL_DEPLOYER_PRIVATE_KEY");
  const endpoint = required("AIDTRAIL_STUDIONET_RPC_URL");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("AIDTRAIL_DEPLOYER_PRIVATE_KEY must be a 32-byte authenticated wallet key");
  }
  if (normalizedUrl(endpoint) !== normalizedUrl(officialEndpoint)) {
    throw new Error("AIDTRAIL_STUDIONET_RPC_URL must match the official SDK Studionet endpoint");
  }

  const account = createAccount(privateKey as `0x${string}`);
  const client = createClient({ chain: studionet, endpoint, account });
  const remoteChainId = await client.getChainId();
  if (remoteChainId !== studionet.id) {
    throw new Error(`Studionet chain identity mismatch: expected ${studionet.id}, received ${remoteChainId}`);
  }
  const transactionHash = await client.deployContract({ account, code: source, args: [] });
  const receipt = await client.waitForTransactionReceipt({
    hash: transactionHash as unknown as Hash,
  });
  const address = (receipt as { contractAddress?: string }).contractAddress;
  if (!address) throw new Error("deployment receipt did not contain a contract address");
  console.log(JSON.stringify({ ...output, address, transactionHash, deployerAddress: account.address }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "deployment failed");
  process.exitCode = 1;
});
