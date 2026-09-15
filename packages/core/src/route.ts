/** Read-only EVM assessment, never a signed order or settlement authorization. */
export type RouteReport = {
  version:1; venue:"pons-v2-native-curve"; status:"passed"|"blocked"|"unsupported"|"failed";
  reason:string; observedAt:string; chainId:4663; tokenAddress:string; deployerAddress:string;
  budgetEth:string; maxUnitPriceEth:string; simulationWallet:string;
  curveAddress?:string; blockNumber?:number; blockHash?:string; blockTimestamp?:number;
  expiresAt?:string; quantity?:string; spendEth?:string; buyFeeEth?:string; creatorTaxEth?:string;
  sellReturnEth?:string; roundTripLossEth?:string; gasUnits?:string; executionGasEstimateEth?:string;
  buy?:{to:string;data:string;value:string}; approve?:{to:string;data:string;value:string}; sell?:{to:string;data:string;value:string};
  limitations:string[];
};
