import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import type { TransactionHash } from "../domain";

export interface ReadClient {
  readContract(args: { address: `0x${string}`; functionName: string; args?: unknown[] }): Promise<unknown>;
}
export interface TransactionReadClient extends ReadClient {
  getTransaction(args: { hash: TransactionHash }): Promise<unknown>;
}

export function createReadClient(endpoint?: string): TransactionReadClient {
  return createClient({ chain: studionet, endpoint }) as TransactionReadClient;
}
