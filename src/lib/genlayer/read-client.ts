import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export interface ReadClient { readContract(args: { address: `0x${string}`; functionName: string; args?: unknown[] }): Promise<unknown>; }

export function createReadClient(endpoint?: string): ReadClient {
  return createClient({ chain: studionet, endpoint });
}
