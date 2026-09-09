import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyContractPresence } from "../src/verify-contract.js";
const address = `0x${"1".repeat(40)}`;
test("contract presence requires the expected chain and actual bytecode", async () => {
  for (const [chain, code, expected] of [[4663, "0x60006000", true], [1, "0x6000", false],
    [4663, "0x", false], [4663, null, false], [4663, "0x123", false]] as const) {
    const result = await verifyContractPresence({ configured: true,
      getChainId: async () => chain, getCode: async () => code }, address, 4663);
    assert.equal(result.present, expected);
  }
});
test("missing RPC and failed requests never verify a contract", async () => {
  for (const configured of [false, true]) {
    const result = await verifyContractPresence({ configured,
      getChainId: async () => { throw new Error("unavailable"); },
      getCode: async () => { throw new Error("must not reach"); } }, address, 4663);
    assert.equal(result.present, false);
  }
});
test("a wrong-chain provider cannot verify a same-address contract", async () => {
  let codeRead = false;
  const result = await verifyContractPresence({ configured: true,
    getChainId: async () => 1, getCode: async () => { codeRead = true; return "0x6000"; } }, address, 4663);
  assert.equal(codeRead, false);
  assert.equal(result.reason, "chain_mismatch");
});
