# Isolated signer handoff — single key, multi-address

**Historical stub proposal.** Paper execution only. The multi-address custody model below is unresolved; one ordinary EOA key controls one EOA address, so a supported derivation/smart-account design is required. The latest product supports manual or policy-controlled automatic entry, plus preapproved exits. See [PRODUCT_ALIGNMENT.md](PRODUCT_ALIGNMENT.md) and [BUY_WALLETS.md](BUY_WALLETS.md).

## Goals

- Research stack (API / TG / Desk / LLM) never holds Nick’s private key.
- **One controlling key** in a future isolated signer service controls **many** buy-wallet addresses.
- After Nick Approves a purchase proposal, API emits a **handoff payload** the signer can consume later — still a stub today (no network call, no sign, no tx).

## Trust boundaries

| Zone | May hold | Must not hold |
|------|----------|---------------|
| Research VPS (api, collector, telegram) | Public buy addresses, proposals, scores | Private key, seed, mnemonic |
| Grok Bot / chat / LLM | Proposal JSON, addresses | Key material |
| Isolated signer (future) | The one controlling key + address list | Desk secrets / LLM prompts |

## Approve → handoff sequence

```
pending_nick
  → Nick Approve (Grok | TG)
  → revalidateRequired=true (checklist in PURCHASE_PROPOSALS.md)
  → next: signer_handoff_stub
  → response.signerHandoff = { …payload… }   # stub only
  → if ENABLE_TRADING=false: stop (paper fill receipt only)
  → if live later: POST payload to signer; never load key into API
```

## Handoff payload shape (stub)

Returned on `POST /purchase-proposals/:id/approve` as `signerHandoff` (no secrets):

```json
{
  "version": 1,
  "mode": "paper_stub",
  "keyModel": "single_controlling_key_multi_address",
  "proposalId": "uuid",
  "chainId": 4663,
  "tokenCA": "0x…",
  "size": "eth:0.05",
  "sizeEth": "0.05",
  "slippageBps": 100,
  "exits": { "tpPct": 60, "slPct": 35 },
  "buyAddress": null,
  "buyAddressCandidates": [
    { "address": "0x…", "label": "main", "kind": "buy" }
  ],
  "buyAddressSelection": "unspecified_or_first_buy",
  "signed": false,
  "txSubmitted": false,
  "enableTrading": false,
  "note": "Stub — isolated signer not called. No key material."
}
```

### Address selection rules (stub)

1. Prefer explicit `buyAddress` on the approve body if it is a registered buy wallet.
2. Else first registered `kind=buy` address (if any).
3. Else `buyAddress=null` and `buyAddressCandidates=[]` — Nick still needs to `POST /buy-wallets` with public addresses.

## What is NOT implemented

- No signer process / container
- No key storage, KMS, or HSM
- No eth_sendRawTransaction
- No auto-pick beyond first buy address

## Safety

- `ENABLE_TRADING=false` → handoff is informational only (paper).
- Approve handlers must never accept `privateKey` / `key` / `mnemonic` fields.
- Watched alphas (`/watched-wallets`) are never buy candidates.
