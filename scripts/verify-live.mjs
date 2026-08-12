import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const requiredMethods = ["get_grant", "get_milestone", "get_summary", "get_credit", "storage_version"];
const address = process.argv[2] ?? process.env.AIDTRAIL_CONTRACT_ADDRESS;
const endpoint = process.env.AIDTRAIL_STUDIONET_RPC_URL;
const outputPath = resolve(process.env.AIDTRAIL_EVIDENCE_FILE ?? "docs/live-verification.json");
const source = await readFile(new URL("../contracts/AidTrail.py", import.meta.url));
const sourceHash = `0x${createHash("sha256").update(source).digest("hex")}`;

if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  throw new Error("provide a real contract address as the first argument or AIDTRAIL_CONTRACT_ADDRESS");
}
if (!endpoint || !/^https:\/\//.test(endpoint)) {
  throw new Error("AIDTRAIL_STUDIONET_RPC_URL must be an HTTPS Studionet endpoint");
}

const client = createClient({ chain: studionet, endpoint });
const schema = await client.getContractSchema({ address });
const methodNames = new Set((schema.methods ?? []).map((method) => method.name));
const missingMethods = requiredMethods.filter((method) => !methodNames.has(method));
if (missingMethods.length) throw new Error(`contract schema is missing: ${missingMethods.join(", ")}`);

const [storageVersion, accounting] = await Promise.all([
  client.readContract({ address, functionName: "storage_version", args: [] }),
  client.readContract({ address, functionName: "get_summary", args: [] }),
]);
const evidence = {
  address,
  network: "studionet",
  sourceHash,
  methods: requiredMethods,
  storageVersion,
  accounting,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(evidence));
