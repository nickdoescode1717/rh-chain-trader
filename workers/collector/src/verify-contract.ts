import type { RpcClient } from "./rpc.js";

/** Bytecode existence is not source-code verification, an audit, or proof of safety. */
export async function verifyContractPresence(
  rpc: Pick<RpcClient, "configured" | "getChainId" | "getCode">,
  address: string, expectedChainId: number,
): Promise<{ present: boolean; reason: string }> {
  if (!rpc.configured) return { present: false, reason: "rpc_unconfigured" };
  if (!/^0x[0-9a-f]{40}$/i.test(address)) return { present: false, reason: "invalid_address" };
  try {
    if (await rpc.getChainId() !== expectedChainId) return { present: false, reason: "chain_mismatch" };
    const code = await rpc.getCode(address);
    if (typeof code !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(code)) {
      return { present: false, reason: "bytecode_absent_or_invalid" };
    }
    return { present: true, reason: "bytecode_present_not_security_verified" };
  } catch { return { present: false, reason: "rpc_verification_failed" }; }
}
