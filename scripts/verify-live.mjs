import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const address = process.argv[2] ?? process.env.AIDTRAIL_CONTRACT_ADDRESS;
const endpoint = process.env.AIDTRAIL_STUDIONET_RPC_URL;
const outputPath = resolve(process.env.AIDTRAIL_EVIDENCE_FILE ?? "docs/live-verification.json");
const localSource = await readFile(new URL("../contracts/AidTrail.py", import.meta.url), "utf8");
const officialEndpoint = studionet.rpcUrls.default.http[0];

function normalizedUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function sha256(value) {
  return `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function json(value) {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2);
}

if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  throw new Error("provide a real contract address as the first argument or AIDTRAIL_CONTRACT_ADDRESS");
}
if (!endpoint || normalizedUrl(endpoint) !== normalizedUrl(officialEndpoint)) {
  throw new Error("AIDTRAIL_STUDIONET_RPC_URL must match the official SDK Studionet endpoint");
}

const client = createClient({ chain: studionet, endpoint });
const remoteChainId = await client.getChainId();
if (remoteChainId !== studionet.id) {
  throw new Error(`Studionet chain identity mismatch: expected ${studionet.id}, received ${remoteChainId}`);
}

// Studionet exposes gen_getContractCode. Verification fails closed if the node
// cannot return the deployed source; there is no fallback that trusts a local hash.
const deployedSource = await client.getContractCode(address);
const localSourceHash = sha256(localSource);
const deployedSourceHash = sha256(deployedSource);
if (deployedSourceHash !== localSourceHash) {
  throw new Error(`deployed source mismatch: expected ${localSourceHash}, received ${deployedSourceHash}`);
}

const [deployedSchema, expectedSchema] = await Promise.all([
  client.getContractSchema(address),
  client.getContractSchemaForCode(localSource),
]);
if (JSON.stringify(canonical(deployedSchema)) !== JSON.stringify(canonical(expectedSchema))) {
  throw new Error("deployed ABI signatures do not match the reviewed source schema");
}

const [storageVersion, accounting, deployerCredit, evidenceDomain, grants] = await Promise.all([
  client.readContract({ address, functionName: "storage_version", args: [] }),
  client.readContract({ address, functionName: "get_summary", args: [] }),
  client.readContract({ address, functionName: "get_credit", args: [address] }),
  client.readContract({ address, functionName: "get_evidence_domain", args: [] }),
  client.readContract({ address, functionName: "list_grants", args: [0, 1] }),
]);

let firstGrant = null;
let firstMilestone = null;
if (Array.isArray(grants) && grants.length > 0) {
  firstGrant = await client.readContract({ address, functionName: "get_grant", args: [grants[0].grant_id] });
  firstMilestone = await client.readContract({
    address,
    functionName: "get_milestone",
    args: [grants[0].grant_id, 0],
  });
}

const evidence = {
  address,
  network: "studionet",
  chainId: remoteChainId,
  endpoint: officialEndpoint,
  sourceVerification: "gen_getContractCode exact SHA-256 match",
  sourceHash: localSourceHash,
  schema: deployedSchema,
  readback: { storageVersion, accounting, deployerCredit, evidenceDomain, firstGrant, firstMilestone },
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${json(evidence)}\n`, { mode: 0o600 });
console.log(json(evidence));
