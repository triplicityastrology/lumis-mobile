import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { OperatorStop, STOP } from "./s2-t259-dice-authorization-operator.mjs";

export const CLAIM_INTERFACE_VERSION = "lumis_dice_deployment_claim_store_v1";
export const CLAIM_DURABILITY = "atomic_persistent";

const DEPLOYMENT_ID = /^dice-deploy-[a-z0-9]{16,40}$/;

async function removeIfPresent(path) {
  try { await unlink(path); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
}

export function createFileDeploymentClaimAuthority({ ledgerPath }) {
  if (typeof ledgerPath !== "string" || !ledgerPath) throw new OperatorStop(STOP.claimUnavailable);

  const claim = async (request) => {
    if (!request || Object.keys(request).length !== 2 || request.interface_version !== CLAIM_INTERFACE_VERSION || !DEPLOYMENT_ID.test(request.deployment_id)) throw new OperatorStop(STOP.claimUnavailable);
    await mkdir(dirname(ledgerPath), { recursive: true, mode: 0o700 });
    const lockPath = `${ledgerPath}.lock`;
    const temporaryPath = `${ledgerPath}.${process.pid}.tmp`;
    let lock;
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error?.code === "EEXIST") throw new OperatorStop(STOP.claimUnavailable);
      throw new OperatorStop(STOP.claimUnavailable);
    }

    try {
      let used = [];
      try {
        const value = JSON.parse(await readFile(ledgerPath, "utf8"));
        if (!value || Object.keys(value).length !== 2 || value.schema !== "s2_t259_dice_deployment_replay_ledger_v1" || !Array.isArray(value.used_deployment_ids) || value.used_deployment_ids.some((id) => !DEPLOYMENT_ID.test(id)) || new Set(value.used_deployment_ids).size !== value.used_deployment_ids.length) throw new OperatorStop(STOP.claimUnavailable);
        used = value.used_deployment_ids;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error instanceof OperatorStop ? error : new OperatorStop(STOP.claimUnavailable);
      }
      if (used.includes(request.deployment_id)) throw new OperatorStop(STOP.replay);

      const body = `${JSON.stringify({ schema: "s2_t259_dice_deployment_replay_ledger_v1", used_deployment_ids: [...used, request.deployment_id] }, null, 2)}\n`;
      let temporary;
      try {
        temporary = await open(temporaryPath, "wx", 0o600);
        await temporary.writeFile(body, "utf8");
        await temporary.sync();
      } finally {
        await temporary?.close();
      }
      await rename(temporaryPath, ledgerPath);
      const directory = await open(dirname(ledgerPath), "r");
      try { await directory.sync(); }
      finally { await directory.close(); }
      return Object.freeze({ interface_version: CLAIM_INTERFACE_VERSION, status: "CLAIMED", deployment_id: request.deployment_id, durable: true });
    } catch (error) {
      await removeIfPresent(temporaryPath);
      if (error instanceof OperatorStop) throw error;
      throw new OperatorStop(STOP.claimUnavailable);
    } finally {
      await lock.close();
      await removeIfPresent(lockPath);
    }
  };

  Object.defineProperties(claim, {
    interfaceVersion: { value: CLAIM_INTERFACE_VERSION },
    durability: { value: CLAIM_DURABILITY },
  });
  return claim;
}
