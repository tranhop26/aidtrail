import { isAddress } from "viem";

import type { Address } from "../domain";

export const missingContractAddressMessage = "AidTrail contract address is not configured";

export function configuredAidTrailAddress(value = process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS): Address | undefined {
  return value !== undefined && isAddress(value) ? value : undefined;
}

export function requireAidTrailAddress(value?: string): Address {
  const address = configuredAidTrailAddress(value);
  if (!address) throw new Error(missingContractAddressMessage);
  return address;
}
