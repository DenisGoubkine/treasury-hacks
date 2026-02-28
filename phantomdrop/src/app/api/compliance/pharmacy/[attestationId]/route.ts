import { NextRequest, NextResponse } from "next/server";

import { PharmacyHandoffEnvelope } from "@/lib/compliance/types";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { encryptJson, signPayload, verifySignature } from "@/lib/server/compliance/crypto";
import { consumeNonce } from "@/lib/server/compliance/nonce";
import { buildPharmacyHandoff } from "@/lib/server/compliance/service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attestationId: string }> }
) {
  const { attestationId } = await context.params;
  const config = getComplianceConfig();
  const provided = request.headers.get("x-pharmacy-api-key") || "";
  const requestTs = request.headers.get("x-request-ts") || "";
  const requestNonce = request.headers.get("x-request-nonce") || "";
  const requestSignature = request.headers.get("x-request-signature") || "";
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  if (!provided || provided !== config.pharmacyApiKey) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "pharmacy_handoff_denied",
      actor: "pharmacy",
      attestationId,
      requestIpHash: ipHash,
      details: {
        reason: "bad_api_key",
      },
    });

    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsedTs = Number(requestTs);
  const now = Date.now();
  const isTsValid = Number.isFinite(parsedTs);
  const isFresh = isTsValid && Math.abs(now - parsedTs) <= config.handoffRequestWindowMs;
  const nonceOk = requestNonce.length >= 12 && consumeNonce(requestNonce, now, config.handoffRequestWindowMs);
  const signatureOk = verifySignature(
    { attestationId, requestTs, requestNonce },
    requestSignature,
    config.transportSecret
  );

  if (!isFresh || !nonceOk || !signatureOk) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "pharmacy_handoff_denied",
      actor: "pharmacy",
      attestationId,
      requestIpHash: ipHash,
      details: {
        reason: !isFresh ? "expired_or_invalid_timestamp" : !nonceOk ? "replay_or_bad_nonce" : "bad_signature",
      },
    });

    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = buildPharmacyHandoff(attestationId);
    const sealedPayload = encryptJson(response, config.transportSecret);
    const envelope: PharmacyHandoffEnvelope = {
      ok: true,
      transport: "sealed-v1",
      keyId: "platform-transport-v1",
      attestationId,
      sealedPayload,
      signature: signPayload({ attestationId, sealedPayload }, config.attestationSecret),
    };

    writeAuditEvent({
      at: new Date().toISOString(),
      type: "pharmacy_handoff_served",
      actor: "platform",
      attestationId,
      requestIpHash: ipHash,
      details: {
        attestationStatus: response.attestationStatus,
      },
    });

    return NextResponse.json(envelope, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve attestation";

    writeAuditEvent({
      at: new Date().toISOString(),
      type: "pharmacy_handoff_error",
      actor: "platform",
      attestationId,
      requestIpHash: ipHash,
      details: {
        error: message,
      },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
