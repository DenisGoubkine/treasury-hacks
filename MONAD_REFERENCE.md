# Monad Developer Reference

> Ultra-compressed implementation reference. Everything needed to build on Monad. Last updated: Feb 2026 (v0.12.7 / MONAD_EIGHT).

---

## 1. Network Configuration

### Mainnet
| Field | Value |
|---|---|
| Chain ID | `143` |
| Network Name | `Monad Mainnet` |
| Currency | `MON` |
| Version | v0.12.7 / MONAD_EIGHT |

**Public RPC Endpoints (Mainnet)**
| URL | Provider | Rate Limit | Batch | Notes |
|---|---|---|---|---|
| `https://rpc.monad.xyz` / `wss://rpc.monad.xyz` | QuickNode | 25 rps | 100 | |
| `https://rpc1.monad.xyz` / `wss://rpc1.monad.xyz` | Alchemy | 15 rps | 100 | no `debug_`/`trace_` |
| `https://rpc2.monad.xyz` / `wss://rpc2.monad.xyz` | Goldsky Edge | 300/10s | 10 | archive state supported |
| `https://rpc3.monad.xyz` / `wss://rpc3.monad.xyz` | Ankr | 300/10s | 10 | no `debug_` |
| `https://rpc-mainnet.monadinfra.com` / `wss://rpc-mainnet.monadinfra.com` | Monad Foundation | 20 rps | 1 | archive state supported |

**Block Explorers (Mainnet)**
- MonadVision: https://monadvision.com
- Monadscan: https://monadscan.com
- SocialScan: https://monad.socialscan.io
- Traces: Phalcon (https://blocksec.com/explorer), Tenderly
- UserOps: Jiffyscan

---

### Testnet
| Field | Value |
|---|---|
| Chain ID | `10143` |
| Network Name | `Monad Testnet` |
| Currency | `MON` |
| Faucet | https://faucet.monad.xyz |
| App Hub | https://testnet.monad.xyz |

**Public RPC Endpoints (Testnet)**
| URL | Provider | Rate Limit | Batch | Archive |
|---|---|---|---|---|
| `https://testnet-rpc.monad.xyz` / `wss://testnet-rpc.monad.xyz` | QuickNode | 50 rps | 100 | ✅ (25 rps for eth_call) |
| `https://rpc.ankr.com/monad_testnet` | Ankr | 300/10s | 100 | ❌ |
| `https://rpc-testnet.monadinfra.com` / `wss://rpc-testnet.monadinfra.com` | Monad Foundation | 20 rps | ❌ | ✅ |

**Block Explorers (Testnet)**
- MonadVision: https://testnet.monadvision.com
- Monadscan: https://testnet.monadscan.com

### Tempnet
| Field | Value |
|---|---|
| Chain ID | `20143` |
| Version | v0.12.3 / MONAD_EIGHT |
| RPC | Submit form at https://tally.so/r/wLlvlj (requires Discord) |

---

## 2. Canonical Contract Addresses

### Mainnet
| Contract | Address |
|---|---|
| Wrapped MON (WMON) | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| Staking Precompile | `0x0000000000000000000000000000000000001000` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| Create2Deployer | `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2` |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| Foundry Deterministic Deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` |
| ERC-2470 Singleton Factory | `0xce0042b868300000d44a59004da54a005ffdcf9f` |
| ERC-4337 EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| ERC-4337 SenderCreator v0.6 | `0x7fc98430eAEdbb6070B35B39D798725049088348` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| ERC-4337 SenderCreator v0.7 | `0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C` |
| ERC-6492 UniversalSigValidator | `0xdAcD51A54883eb67D95FAEb2BBfdC4a9a6BD2a3B` |
| MultiSend | `0x998739BFdAAdde7C933B942a68053933098f9EDa` |
| MultiSendCallOnly | `0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B` |
| Safe (v1.3.0) | `0x69f4D1788e39c87893C980c06EdF4b7f686e2938` |
| SafeL2 (v1.3.0) | `0xfb1bffC9d739B8D520DaF37dF666da4C687191EA` |
| SafeSingletonFactory | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` |
| SimpleAccount | `0x68641DE71cfEa5a5d0D29712449Ee254bb1400C2` |
| Simple7702Account | `0xe6Cae83BdE06E4c305530e199D7217f42808555B` |
| ERC-4337 Zoltu Proxy | `0x7A0D94F55792C434d74a40883C6ed8545E406D12` |
| Sub Zero VanityMarket | `0x000000000000b361194cfe6312EE3210d53C15AA` |

> Ecosystem contract addresses: https://github.com/monad-crypto/protocols
> Token list: https://github.com/monad-crypto/token-list

### Testnet
| Contract | Address |
|---|---|
| Wrapped MON (WMON) | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Staking Precompile | `0x0000000000000000000000000000000000001000` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| Foundry Deterministic Deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` |
| ERC-6492 UniversalSigValidator | `0xdAcD51A54883eb67D95FAEb2BBfdC4a9a6BD2a3B` |
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| SafeSingletonFactory | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` |
| Safe v1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| SafeL2 v1.4.1 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` |
| SafeProxyFactory v1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| MultiSend v1.4.1 | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` |
| MultiSendCallOnly v1.4.1 | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| CompatibilityFallbackHandler | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |
| SignMessageLib | `0xd53cd0aB83D845Ac265BE939c57F53AD838012c9` |
| CreateCall | `0x9b35Af71d77eaf8d7e40252370304687390A1A52` |
| SimulateTxAccessor | `0x3d4BA2E0884aa488718476ca2FB8Efc291A46199` |

---

## 3. Key Differences from Ethereum

### EVM / Smart Contracts
- Max contract size: **128 KB** (up from 24 KB). Max init code: **256 KB** (up from 48 KB).
- Fully EVM-compatible (Pectra fork). All opcodes supported.
- Additional precompile `0x0100`: secp256r1/P256 signature verification (EIP-7951).
- Cold access costs repriced (see §5 Opcode Pricing).

### Transactions
- **Gas charged on gas limit, not gas used**: `total_deducted = value + gas_price * gas_limit`. Critical DoS-prevention for async execution.
- No EIP-4844 (blob transactions / type 3). Types 0, 1, 2, 4 are supported.
- No global mempool (local per-validator). Transactions forwarded to next 3 leaders.
- Reserve Balance mechanism (see §7). Transactions may revert if balance would drop below 10 MON.
- Pre-EIP-155 transactions allowed at protocol level.
- `TIMESTAMP` opcode: second-granularity. Multiple blocks (2-3) may share the same timestamp.
- Block frequency: **400 ms**. Finality: **800 ms** (speculative at 400 ms).

### RPC
- `eth_getTransactionByHash` returns `null` for pending txs (mempool not exposed).
- `eth_sendRawTransaction` may not immediately reject nonce-gap or insufficient-balance txs.
- `eth_getLogs` has a max block range (provider-dependent, typically 100-1000).
- No `eth_subscribe` for `syncing` or `newPendingTransactions`.
- Monad-specific: `monadNewHeads`, `monadLogs` subscriptions (fire on speculative execution).
- `debug_traceCall` etc. require trace options object (even if empty `{}`). Default tracer is `callTracer` (not struct logs).
- `eth_maxPriorityFeePerGas` returns hardcoded 2 gwei (temporary).

### Historical Data
- Full nodes do NOT store arbitrary historic state (high throughput = prohibitive storage).
- Only `rpc2.monad.xyz` (Goldsky), `rpc-mainnet.monadinfra.com`, `testnet-rpc.monad.xyz` (QN), `rpc-testnet.monadinfra.com` support archive queries.

---

## 4. Transactions

- **Address space**: 20-byte ECDSA (same as Ethereum)
- **Supported types**: 0 (legacy), 1 (EIP-2930), 2 (EIP-1559), 4 (EIP-7702)
- **Not supported**: Type 3 (EIP-4844 blobs)
- **Encoding**: EIP-2718 typed envelope, RLP-encoded
- **EIP-1559**: Fully compatible. base_fee + priority_fee.
- **Min base fee**: 100 MON-gwei (100 × 10⁻⁹ MON)
- **Base fee controller**: Similar to Ethereum but stays elevated for less time (slower increase, faster decrease).

### Gas Limits
| Metric | Value |
|---|---|
| Per-transaction gas limit | 30M gas |
| Block gas limit | 200M gas |
| Block gas target | 160M gas (80%) |
| Gas throughput | 500M gas/sec |

---

## 5. Opcode Pricing

Same as Ethereum **except**:

### Cold Access Cost
| Type | Ethereum | Monad | Affected Opcodes |
|---|---|---|---|
| Account (cold) | 2,600 | **10,100** | `BALANCE`, `EXTCODESIZE`, `EXTCODECOPY`, `EXTCODEHASH`, `CALL`, `CALLCODE`, `DELEGATECALL`, `STATICCALL`, `SELFDESTRUCT` |
| Storage (cold) | 2,100 | **8,100** | `SLOAD`, `SSTORE` |

Warm access costs unchanged: account = 100, storage = 100.

### Repriced Precompiles
| Precompile | Address | Ethereum | Monad | Multiplier |
|---|---|---|---|---|
| `ecRecover` | `0x01` | 3,000 | **6,000** | 2× |
| `ecAdd` | `0x06` | 150 | **300** | 2× |
| `ecMul` | `0x07` | 6,000 | **30,000** | 5× |
| `ecPairing` | `0x08` | 45,000 | **225,000** | 5× |
| `blake2f` | `0x09` | rounds×1 | **rounds×2** | 2× |
| `point_eval` | `0x0a` | 50,000 | **200,000** | 4× |

---

## 6. Precompiles

All Ethereum precompiles (Pectra fork `0x01`–`0x11`) plus Monad additions:

| Address | Name | Gas | Notes |
|---|---|---|---|
| `0x01` | `ecRecover` | 6,000 | ECDSA recovery (repriced) |
| `0x02` | `sha256` | 60 + 12×words | |
| `0x03` | `ripemd160` | 600 + 120×words | |
| `0x04` | `identity` | 15 + 3×words | |
| `0x05` | `modexp` | see EIP-198 | |
| `0x06` | `ecAdd` | 300 | alt_bn128 (repriced) |
| `0x07` | `ecMul` | 30,000 | alt_bn128 (repriced) |
| `0x08` | `ecPairing` | 225,000 | alt_bn128 (repriced) |
| `0x09` | `blake2f` | rounds×2 | (repriced) |
| `0x0a` | `point_eval` | 200,000 | KZG (repriced) |
| `0x0b` | `bls12_g1_add` | 375 | EIP-2537 |
| `0x0c` | `bls12_g1_msm` | see EIP-2537 | |
| `0x0d` | `bls12_g2_add` | 600 | EIP-2537 |
| `0x0e` | `bls12_g2_msm` | see EIP-2537 | |
| `0x0f` | `bls12_pairing_check` | see EIP-2537 | |
| `0x10` | `bls12_map_fp_to_g1` | 5,500 | EIP-2537 |
| `0x11` | `bls12_map_fp2_to_g2` | 23,800 | EIP-2537 |
| `0x0100` | `p256_verify` | 6,900 | secp256r1/P256, EIP-7951 |
| `0x1000` | `staking` | varies | Staking precompile |

---

## 7. Reserve Balance

**The most important Monad-specific mechanism.**

Monad uses asynchronous execution (consensus happens k=3 blocks before execution). To prevent DoS, it reserves a balance per EOA.

### Parameters
| Parameter | Value |
|---|---|
| `user_reserve_balance` | **10 MON** |
| Delay factor `k` | 3 blocks |

### Rules Summary
- **Gas charged on gas limit** (not usage): `deducted = value + gas_price * gas_limit`
- **Execution-time revert**: Tx reverts if EOA balance would dip below 10 MON by more than the max gas fee, UNLESS the account is undelegated AND has no other inflight txs.
- **Inflight tx**: A tx included in the last k=3 blocks.

### Consensus-time checks
1. **No delegation, no inflight txs**: `gas_fees(tx) ≤ balance`
2. **No delegation, one emptying inflight tx**:
   - `adjusted_balance = balance - (first_tx.value + gas_fees(first_tx))`
   - `reserve = min(10 MON, adjusted_balance)`
   - `Σ gas_fees(inflight[1:]) ≤ reserve`
3. **All other cases**:
   - `reserve = min(10 MON, balance)`
   - `Σ gas_fees(inflight) ≤ reserve`

### EIP-7702 Delegated Accounts
- Delegated EOAs **cannot** reduce balance below 10 MON unconditionally (exception for undelegated accounts does NOT apply).
- Undelegating first allows emptying the account.
- A delegated EOA with 5 MON can still receive calls from a gas sponsor — as long as balance stays ≥ 5 MON after execution.

---

## 8. EIP-7702

Fully supported. Transaction type `0x04`.

### How It Works
- EOA signs authorization designating a contract address as code source.
- After submission, EOA can be called as a smart contract.
- Enables: batching, gas sponsorship, multisig, social recovery, session keys on existing EOAs.

### Monad-Specific Constraints
1. **Balance floor**: If EOA is delegated, any tx that would reduce balance below 10 MON will unconditionally revert. Exception: if balance is unchanged or increased, tx succeeds even if balance < 10 MON.
2. **No CREATE/CREATE2**: When delegated contract code executes in the context of an EIP-7702 EOA, `CREATE` and `CREATE2` revert. The caller sees the call as failed (returns 0).

### Undelegating
- Remove delegation to allow dipping below 10 MON.
- Undelegation is immediate (same tx).

---

## 9. Staking

### Staking Behavior

| Feature | Value |
|---|---|
| Mechanism | Proof-of-Stake, in-protocol delegation |
| Block reward | 25 MON fixed + priority fees |
| Commission | 0–100% (validator-set) |
| Active validator set size | 200 |
| Min self-delegation for active set | 100,000 MON |
| Min total delegation for active set | 10,000,000 MON |
| Epoch timing | Every 50,000 blocks (boundary block); ~5.5 hrs |
| Epoch delay | 5,000 rounds after boundary block |
| Withdrawal delay | 1 epoch |
| Block reward per block | 25 MON |

### Timing
- Staking operations (delegate, undelegate) take effect at the next epoch start.
- `claimRewards()` and `externalReward()` take immediate effect.
- Boundary block snapshots happen at block start; user txs in that block miss the snapshot.
- Use `getEpoch()` — NOT modulo on block number — to determine current epoch.
- `getEpoch()` returns `(epoch, inEpochDelayPeriod)`. If `(1000, false)`, changes go into next epoch.

### Staking Constants
| Constant | Value |
|---|---|
| `BOUNDARY_BLOCK_PERIOD` | 50,000 blocks |
| `EPOCH_DELAY_ROUNDS` | 5,000 rounds |
| `WITHDRAWAL_DELAY` | 1 epoch |
| `MIN_AUTH_ADDRESS_STAKE` | 100,000 MON |
| `ACTIVE_VALIDATOR_STAKE` | 10,000,000 MON |
| `ACTIVE_VALSET_SIZE` | 200 |
| `REWARD` | 25 MON/block |

---

## 10. Staking Precompile

**Address**: `0x0000000000000000000000000000000000001000`

### Function Selectors

**State-modifying:**
| Function | Selector |
|---|---|
| `addValidator(bytes,bytes,bytes)` | `0xf145204c` |
| `delegate(uint64)` | `0x84994fec` |
| `undelegate(uint64,uint256,uint8)` | `0x5cf41514` |
| `withdraw(uint64,uint8)` | `0xaed2ee73` |
| `compound(uint64)` | `0xb34fea67` |
| `claimRewards(uint64)` | `0xa76e2ca5` |
| `changeCommission(uint64,uint256)` | `0x9bdcc3c8` |
| `externalReward(uint64)` | `0xe4b3303b` |

**View:**
| Function | Selector |
|---|---|
| `getValidator(uint64)` | `0x2b6d639a` |
| `getDelegator(uint64,address)` | `0x573c1ce0` |
| `getWithdrawalRequest(uint64,address,uint8)` | `0x56fa2045` |
| `getConsensusValidatorSet(uint32)` | `0xfb29b729` |
| `getSnapshotValidatorSet(uint32)` | `0xde66a368` |
| `getExecutionValidatorSet(uint32)` | `0x7cb074df` |
| `getDelegations(address,uint64)` | `0x4fd66050` |
| `getDelegators(uint64,address)` | `0xa0843a26` |
| `getEpoch()` | `0x757991a8` |
| `getProposerValId()` | (view) |

**Syscalls (protocol-internal):**
| Function | Selector |
|---|---|
| `syscallOnEpochChange(uint64)` | `0x1d4e9f02` |
| `syscallReward(address)` | `0x791bdcf3` |
| `syscallSnapshot()` | `0x157eeb21` |

### Solidity Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface IMonadStaking {
    function addValidator(
        bytes calldata payload,
        bytes calldata signedSecpMessage,
        bytes calldata signedBlsMessage
    ) external payable returns (uint64 validatorId);

    function delegate(uint64 validatorId) external payable returns (bool success);

    function undelegate(
        uint64 validatorId,
        uint256 amount,
        uint8 withdrawId
    ) external returns (bool success);

    function compound(uint64 validatorId) external returns (bool success);
    function withdraw(uint64 validatorId, uint8 withdrawId) external returns (bool success);
    function claimRewards(uint64 validatorId) external returns (bool success);
    function changeCommission(uint64 validatorId, uint256 commission) external returns (bool success);
    function externalReward(uint64 validatorId) external payable returns (bool success);

    function getValidator(uint64 validatorId) external returns (
        address authAddress,
        uint64 flags,
        uint256 stake,
        uint256 accRewardPerToken,
        uint256 commission,
        uint256 unclaimedRewards,
        uint256 consensusStake,
        uint256 consensusCommission,
        uint256 snapshotStake,
        uint256 snapshotCommission,
        bytes memory secpPubkey,
        bytes memory blsPubkey
    );

    function getDelegator(uint64 validatorId, address delegator) external returns (
        uint256 stake,
        uint256 accRewardPerToken,
        uint256 unclaimedRewards,
        uint256 deltaStake,
        uint256 nextDeltaStake,
        uint64 deltaEpoch,
        uint64 nextDeltaEpoch
    );

    function getWithdrawalRequest(
        uint64 validatorId,
        address delegator,
        uint8 withdrawId
    ) external returns (
        uint256 withdrawalAmount,
        uint256 accRewardPerToken,
        uint64 withdrawEpoch
    );

    function getConsensusValidatorSet(uint32 startIndex) external returns (bool isDone, uint32 nextIndex, uint64[] memory valIds);
    function getSnapshotValidatorSet(uint32 startIndex) external returns (bool isDone, uint32 nextIndex, uint64[] memory valIds);
    function getExecutionValidatorSet(uint32 startIndex) external returns (bool isDone, uint32 nextIndex, uint64[] memory valIds);
    function getDelegations(address delegator, uint64 startValId) external returns (bool isDone, uint64 nextValId, uint64[] memory valIds);
    function getDelegators(uint64 validatorId, address startDelegator) external returns (bool isDone, address nextDelegator, address[] memory delegators);
    function getEpoch() external returns (uint64 epoch, bool inEpochDelayPeriod);
    function getProposerValId() external returns (uint64 val_id);

    event ValidatorRewarded(uint64 indexed validatorId, address indexed from, uint256 amount, uint64 epoch);
    event ValidatorCreated(uint64 indexed validatorId, address indexed authAddress, uint256 commission);
    event ValidatorStatusChanged(uint64 indexed validatorId, uint64 flags);
    event Delegate(uint64 indexed validatorId, address indexed delegator, uint256 amount, uint64 activationEpoch);
    event Undelegate(uint64 indexed validatorId, address indexed delegator, uint8 withdrawId, uint256 amount, uint64 activationEpoch);
    event Withdraw(uint64 indexed validatorId, address indexed delegator, uint8 withdrawId, uint256 amount, uint64 withdrawEpoch);
    event ClaimRewards(uint64 indexed validatorId, address indexed delegator, uint256 amount, uint64 epoch);
    event CommissionChanged(uint64 indexed validatorId, uint256 oldCommission, uint256 newCommission);
    event EpochChanged(uint64 oldEpoch, uint64 newEpoch);
}
```

---

## 11. RPC Reference

### Supported Methods

**debug:**
- `debug_getRawBlock`, `debug_getRawHeader`, `debug_getRawReceipts`, `debug_getRawTransaction`
- `debug_traceBlockByHash`, `debug_traceBlockByNumber`, `debug_traceCall`, `debug_traceTransaction`
  - **Note**: trace options object is required (even `{}`). Default tracer: `callTracer`.

**eth:**
- `eth_blockNumber`, `eth_call`, `eth_chainId`, `eth_createAccessList`
- `eth_estimateGas`, `eth_feeHistory`, `eth_gasPrice`
- `eth_getBalance`, `eth_getBlockByHash`, `eth_getBlockByNumber`
- `eth_getBlockReceipts`, `eth_getBlockTransactionCountByHash`, `eth_getBlockTransactionCountByNumber`
- `eth_getCode`, `eth_getLogs`, `eth_getStorageAt`
- `eth_getTransactionByBlockHashAndIndex`, `eth_getTransactionByBlockNumberAndIndex`
- `eth_getTransactionByHash` *(pending returns null)*
- `eth_getTransactionCount`, `eth_getTransactionReceipt`
- `eth_maxPriorityFeePerGas` *(hardcoded 2 gwei, temporary)*
- `eth_sendRawTransaction`
- `eth_sendRawTransactionSync` *(EIP-7966, waits for inclusion; v0.12.3+)*
- `eth_syncing`

**other:**
- `net_version` (always returns chain ID)
- `txpool_statusByAddress`, `txpool_statusByHash`
- `web3_clientVersion`
- `admin_ethCallStatistics` (internal only)

### RPC Limits

**eth_call / eth_estimateGas gas limits:**
| Provider | RPC | Gas Limit |
|---|---|---|
| QuickNode | `rpc.monad.xyz` | 200M |
| Alchemy | `rpc1.monad.xyz` | 200M |
| Ankr | `rpc3.monad.xyz` | 1B |
| Monad Foundation | `rpc-mainnet.monadinfra.com` | 200M |

**Dual-pool execution:**
- Low-gas pool: gas limit ≤ 8,100,000
- High-gas pool: gas limit > 8,100,000
- No gas limit specified: starts in low-gas pool, auto-retries in high-gas pool.

**eth_getLogs block range limits:**
| Provider | Block Range Limit |
|---|---|
| QuickNode | 100 blocks |
| Alchemy | 1000 blocks OR 10,000 logs |
| Ankr | 1000 blocks |
| Monad Foundation | 100 blocks |

> Recommended indexing strategy: 100-block range with 100 concurrent workers.

### RPC Differences vs Ethereum
- `eth_getLogs`: max block range enforced. Use small ranges (1-10 blocks) for performance.
- `eth_sendRawTransaction`: nonce-gap/insufficient-balance NOT immediately rejected.
- `eth_call` with old block number may fail (no arbitrary historic state on most nodes).
- `eth_feeHistory` with `newest_block=latest`: returns latest `baseFeePerGas` twice (cannot project next block fee).
- `eth_subscribe` `syncing` and `newPendingTransactions` NOT supported.
- `newHeads`/`logs` subscriptions: no reorgs (finalized blocks only).

### Error Codes
Standard JSON-RPC error codes apply. Common ones:
- `-32602`: Invalid params (e.g., missing trace options on debug methods)
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32700`: Parse error

---

## 12. WebSocket Subscriptions

Connect: `wss://rpc.monad.xyz` (mainnet) or `wss://testnet-rpc.monad.xyz` (testnet)

| Subscription | Fires | Notes |
|---|---|---|
| `newHeads` | Block `Finalized` (~800ms) | No reorgs |
| `logs` | Block `Finalized` | No reorgs |
| `monadNewHeads` | Block `Proposed` (~400ms) | Speculative execution |
| `monadLogs` | Block `Proposed` | Speculative execution |

**Subscribe example:**
```json
{"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["newHeads"]}
{"jsonrpc":"2.0","id":2,"method":"eth_subscribe","params":["logs",{"address":"0x...","topics":[...]}]}
{"jsonrpc":"2.0","id":3,"method":"eth_subscribe","params":["monadNewHeads"]}
```

**Unsubscribe:**
```json
{"jsonrpc":"2.0","id":4,"method":"eth_unsubscribe","params":["0x<subscription_id>"]}
```

**JavaScript (ethers.js):**
```javascript
const wsUrl = "wss://testnet-rpc.monad.xyz";
const provider = new WebSocketProvider(wsUrl);
provider.on("block", (blockNumber) => {
  console.log("New block:", blockNumber);
});
```

**Python (web3.py):**
```python
from web3 import Web3
w3 = Web3(Web3.WebsocketProvider("wss://testnet-rpc.monad.xyz"))
def handle_block(block):
    print("New block:", block)
w3.eth.subscribe('newHeads', handle_block)
```

---

## 13. Best Practices

### Gas Optimization
- **Use hardcoded gas** for static operations: native transfer = 21,000. Avoid `eth_estimateGas` for known-constant operations.
- **Never set gas limit** unnecessarily high — you're charged for the full limit.

### Reading Data
- **Batch eth_calls** concurrently instead of serially:
  ```javascript
  // viem: Promise.all triggers batch submission
  const results = await Promise.all(
    calls.map(call => client.readContract({ address, abi, functionName, args }))
  );
  ```
- **Multicall3** (`0xcA11bde05977b3631167028862bE2a173976CA11`) for aggregating reads into one call. Note: Multicall executes serially on-chain; batched RPC calls execute in parallel.
- **Use indexers** for read-heavy / event-heavy loads instead of `eth_getLogs` polling.
  - Envio HyperIndex: network ID `143` (mainnet) or `10143` (testnet) in `config.yaml`
  - The Graph, Goldsky, Allium, QuickNode Streams, GhostGraph also supported.

### Sending Transactions
- **Manage nonces locally** when submitting multiple txs in quick succession (`eth_getTransactionCount` updates only after finality).
- **Submit multiple txs concurrently**:
  ```javascript
  const hashes = await Promise.all(
    Array(BATCH_SIZE).fill(null).map((_, i) =>
      walletClient.sendTransaction({
        to, value, gasLimit: BigInt(21000),
        nonce: nonce + i, chain
      })
    )
  );
  ```

### Indexing
- Use 100-block ranges with high concurrency (100 workers) for `eth_getLogs`.
- For event-driven apps, prefer WebSocket `newHeads`/`logs` subscriptions over polling.
- `monadNewHeads`/`monadLogs` for lowest latency (~400ms vs 800ms).

### Hosting
- For high-traffic apps: AWS S3 + CloudFront (static), Lambda (serverless), ECS/EKS (containers), RDS (DB).
- Watch for loss-leader pricing tiers — data transfer overages can be expensive.

---

## 14. Tooling

### Required for Local Dev
- **Monad Foundry** (fork of Foundry): https://github.com/category-labs/monad-foundry
  - Supports Monad EVM execution, staking precompile, trace decoding, Anvil fork.
  - Install: see repo. Replace standard Foundry with this fork.
- **Hardhat**: standard, works out-of-the-box
- **Remix**: standard, works out-of-the-box
- **Viem**: `>= 2.40.0` required

### Deployment / Verification
- Foundry: `forge create --rpc-url <rpc> --private-key <pk>`
- Hardhat: standard with `hardhat.config.js` pointing to Monad RPC
- Verify: `forge verify-contract` or Hardhat verify plugin
- Also: MonadVision verification portal

### Supported Infrastructure Summary
| Category | Providers |
|---|---|
| AA / ERC-4337 | Alchemy, Biconomy, FastLane, Gelato, Openfort, Pimlico, Sequence, thirdweb, Zerodev |
| Block Explorers | Monadscan, MonadVision, SocialScan, Tenderly, Phalcon |
| Cross-chain | Axelar, Chainlink CCIP, Circle CCTP, deBridge, Hyperlane, LayerZero, Stargate, Wormhole, Li.fi |
| Embedded Wallets | Alchemy, Coinbase, Dynamic, MetaMask, Privy, Reown, Sequence, thirdweb, Turnkey, Para |
| Indexers | Allium, Envio, Goldsky, Ghost, The Graph, Moralis, Quicknode, thirdweb, Dune |
| Oracles | Chainlink, Pyth, Redstone, Stork, Chronicle, eOracle, Supra, Switchboard |
| RPC Providers | Alchemy, Ankr, Blockdaemon, BlockPI, Chainstack, dRPC, Dwellir, GetBlock, QuickNode, Tatum, thirdweb, Triton One |
| Wallets | MetaMask, Phantom, Rabby, Trust, Backpack, OKX, Ledger, Safe |

---

## 15. Architecture (Essential Context)

### Parallel Execution
- Transactions are **linearly ordered** in each block. Execution produces the same result as serial execution.
- Monad runs many executors in parallel. Each produces a result (inputs + outputs as SLOAD/SSTORE tuples).
- Results committed in original tx order. If inputs changed by another tx, tx is rescheduled (cheap re-execution due to caching).
- **No contract changes needed** — fully transparent to developers.

### JIT Compilation
- EVM bytecode is JIT-compiled to native machine code on first execution, cached thereafter.
- Up to 7× speedup per opcode vs interpreter.
- Fully transparent to developers.

### Asynchronous Execution
- Consensus and execution are **pipelined**: consensus on block N happens while executing block N-3.
- State merkle root in block proposals is delayed by k=3 blocks.
- This is why gas is charged on gas limit and Reserve Balance exists.

### MonadDb
- Custom storage backend optimized for SSD + Ethereum merkle trie data.
- In-memory caching, async I/O via asio.
- Recommended: 32 GB RAM for nodes.

### Block Timing
- Block time: **400 ms**
- Speculative finality: **400 ms** (Voted state, very rarely revertible)
- Full finality: **800 ms** (2 blocks)
- Throughput: ~10,000 TPS, 500M gas/sec

---

## 16. Community & Support

- Discord: https://discord.gg/monaddev
- Telegram: https://t.me/+06Kv7meSPn80C2U8
- Protocols repo: https://github.com/monad-crypto/protocols
- Token list: https://github.com/monad-crypto/token-list
- Source (GPL-3.0): https://github.com/category-labs/monad
