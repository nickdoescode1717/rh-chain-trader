import { decimal, units } from "./paper-execution.js";
import { identityAddress, identitySourceUrl } from "./identity.js";
import { PONS_V2_LAUNCH_FACTORY } from "./addresses.js";
export type SnipeTerms = { version: 1; mode: "paper"; chainId: 4663; projectHandle: string; domain: string;
  deployerAddress: string; spendEth: string; maxUnitPriceEth: string; minLiquidityUsd: 1000; hours: number;
  maxLaunchAgeSeconds: 600; feeBps: 30; slippageBps: 50 };
/** Never accept a scout's testnet CA or an implicit mainnet mapping as an execution target. */
export function snipeTerms(raw: Record<string, unknown>, domain: string): SnipeTerms {
  const allowed = ["projectHandle", "deployerAddress", "spendEth", "maxUnitPriceEth", "hours", "mode", "chainId", "actor"];
  if (Object.keys(raw).some(k => !allowed.includes(k)) || raw.mode !== "paper" || raw.chainId !== 4663) throw new Error("paper_mainnet_plan_required");
  if (typeof raw.projectHandle !== "string" || !/^[a-z0-9_]{1,15}$/.test(raw.projectHandle)) throw new Error("invalid_project_handle");
  const value = (v: unknown) => {
    if (typeof v !== "string" || !/^\d{1,18}(?:\.\d{1,18})?$/.test(v) || units(v) <= 0n) throw new Error("positive_decimal_required");
    return decimal(units(v));
  };
  const hours = raw.hours ?? 24;
  if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 24) throw new Error("expiry_must_be_1_to_24_hours");
  identitySourceUrl(`https://${domain}/`, domain);
  const deployerAddress = identityAddress(raw.deployerAddress);
  if (["0x4e59b44847b379578588920ca78fbf26c0b4956c", PONS_V2_LAUNCH_FACTORY.toLowerCase()].includes(deployerAddress)) throw new Error("shared_factory_is_not_team_deployer");
  return { version: 1, mode: "paper", chainId: 4663, projectHandle: raw.projectHandle, domain,
    deployerAddress, spendEth: value(raw.spendEth), maxUnitPriceEth: value(raw.maxUnitPriceEth),
    minLiquidityUsd: 1000, hours, maxLaunchAgeSeconds: 600, feeBps: 30, slippageBps: 50 };
}
