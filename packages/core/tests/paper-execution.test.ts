import assert from "node:assert/strict";
import { test } from "node:test";
import { decimal, simulateBuy, simulateSell, units } from "../src/paper-execution.js";
test("partial then full exit conserves exact cash, cost and quantity including entry/exit fees", () => {
  for (const budget of ["0.1", "0.000000001", "1234.567890123456789012"]) {
    const buy = simulateBuy(budget, "0.0000123456789");
    const first = simulateSell(buy.quantity, buy.cost, 25, "0.000023456789");
    const last = simulateSell(first.remainingQuantity, first.remainingCost, 100, "0.000007654321");
    assert.equal(units(first.quantity) + units(last.quantity), units(buy.quantity));
    assert.equal(units(first.cost) + units(last.cost), units(buy.cost));
    assert.equal(units(first.realizedPnl) + units(last.realizedPnl), units(buy.cashDelta) + units(first.cashDelta) + units(last.cashDelta));
    assert.equal(last.remainingCost, "0"); assert.equal(last.remainingQuantity, "0");
    assert.ok(units(buy.fee) > 0n && units(first.fee) > 0n);
  }
});
test("unchanged reference price produces a loss from explicit modeled costs", () => {
  const buy = simulateBuy("1", "0.001"), sell = simulateSell(buy.quantity, buy.cost, 100, "0.001");
  assert.ok(units(sell.realizedPnl) < 0n);
  assert.equal(buy.fee, "0.003"); assert.equal(buy.executionPrice, "0.001005");
  assert.equal(sell.executionPrice, "0.000995");
});
test("fixed point preserves 18 digits and rejects non-finite, dust and oversell inputs", () => {
  assert.equal(decimal(units("1234.123456789012345678")), "1234.123456789012345678");
  assert.equal(units("1e-18"), 1n);
  for (const bad of ["NaN", "Infinity", "0x10", "1e100", "1;DROP"]) assert.throws(() => units(bad));
  for (const bad of ["0", "-1", "0.000000000000000001"]) assert.throws(() => simulateBuy(bad, "1"));
  for (const percent of [0, 101, -25, 25.5]) assert.throws(() => simulateSell("1", "1", percent, "1"));
  assert.throws(() => simulateSell("0", "1", 100, "1"));
});
