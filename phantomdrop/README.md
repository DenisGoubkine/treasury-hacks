# PhantomDrop

Customer-first private delivery app on Monad testnet.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000` (or the next free port).

## Fixing "Insufficient balance ... need X, have 0"

That error means your **Unlink private balance** is zero for the configured token.  
Having MON in MetaMask is not enough until you deposit into Unlink.

This app now includes a **Fund Unlink Private Balance** card on:
- `/order`
- `/doctor`

Flow:
1. Connect your Unlink wallet in app.
2. In funding card, enter amount (default `0.01`).
3. Approve MetaMask prompts (network switch to Monad Testnet + deposit tx).
4. Wait for relay confirmation.
5. Retry request/order action.

Default token config is native MON (`ETH_TOKEN` sentinel): `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`.

Wallet format note:
- Client identity wallet fields accept `unlink1...` (Unlink private wallet) or `0x...` (Monad EOA wallet).

## End-to-End Verification Model

1. Patient selects medication from catalog and sends a wallet-signed request to doctor wallet (`requestRelayId` proof id).
2. Doctor validates legal identity in verified patient registry.
3. Doctor files signed attestation for that specific request (wallet-linked eligibility).
4. Patient receives approval code (`DOC-...`) and completes checkout.
5. Pharmacy reads sealed handoff proving licensed doctor approval for a verified patient.

## APIs

### Patient -> Doctor Request

- `POST /api/compliance/doctor/request`
  - Requires patient wallet + legal identity fields + medication code + `requestRelayId` proof id.
  - Requires patient wallet proof signature (Monad EOA signer + nonce + timestamp).
  - Creates request id (`req_...`) with verification status.

### Doctor Registry + Approval

- `POST /api/compliance/doctor/register-patient`
  - Auth: doctor wallet signature headers (`x-doctor-monad-wallet`, `x-doctor-request-ts`, `x-doctor-request-nonce`, `x-doctor-request-signature`)
  - Requires signed registration proof id (`registryRelayId`) generated during doctor registration.
  - Registers legal patient identity hash against patient wallet.

- `POST /api/compliance/doctor/file`
  - Auth: doctor wallet signature headers (`x-doctor-monad-wallet`, `x-doctor-request-ts`, `x-doctor-request-nonce`, `x-doctor-request-signature`)
  - Requires `requestId` and only approves `registry_verified` requests with matching medication code.
  - Returns approval code + Monad anchor metadata.
  - Stores prescription authorization as hash (`prescriptionHash`) instead of raw prescription ID.

- `GET /api/compliance/doctor/records?doctorWallet=...`
  - Auth: doctor wallet signature headers (`x-doctor-monad-wallet`, `x-doctor-request-ts`, `x-doctor-request-nonce`, `x-doctor-request-signature`)
  - Returns filed attestations + incoming patient requests.

### Patient Checkout Confirmation

- `POST /api/compliance/doctor/confirm`
  - Verifies approval code is tied to connected patient wallet.
  - Requires patient wallet signature proof (nonce + timestamp).
  - Returns purchase policy used in order checkout.

### Pharmacy Handoff

- `GET /api/compliance/pharmacy/:attestationId`
  - Auth: `x-pharmacy-api-key`
  - Replay defense: `x-request-ts`, `x-request-nonce`, `x-request-signature`
  - Returns encrypted `sealed-v1` envelope.
  - Includes doctor/provider verification status and patient legal verification status.

### Audit

- `GET /api/compliance/audit?limit=100`
  - Auth: `x-compliance-admin-key`

## Env Vars

See [`.env.example`](./.env.example).

Important server-only keys:

- `COMPLIANCE_PHARMACY_API_KEY`
- `COMPLIANCE_TRANSPORT_SECRET`
- `COMPLIANCE_ATTESTATION_SECRET`
- `COMPLIANCE_ENCRYPTION_SECRET`

Never expose `COMPLIANCE_*` as `NEXT_PUBLIC_*`.

## Beta Limitation

Attestation storage, registry, request queues, audit, and nonce caches are in-memory in this prototype. Move to encrypted persistent storage + managed KMS before production deployment.
