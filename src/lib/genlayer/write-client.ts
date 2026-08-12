import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { isAddress } from "viem";

import type { Address, TransactionHash } from "../domain";

export interface InjectedProvider { request(args: { method: string; params?: unknown[] }): Promise<unknown>; }
export interface WriteClient { connect(network?: "studionet"): Promise<void>; writeContract(args: { address: Address; functionName: string; args?: unknown[]; value: bigint }): Promise<TransactionHash>; }

export async function createWriteClient(provider: InjectedProvider, account: string, endpoint?: string): Promise<WriteClient> {
  if (!isAddress(account)) throw new Error("A selected wallet account is required");
  const client = createClient({ chain: studionet, endpoint, account: account as Address, provider: provider as never });
  await client.connect("studionet");
  return client as unknown as WriteClient;
}
