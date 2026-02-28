import "server-only";

type WalletSecret = {
  address: string;
  privateKey: string;
};

function decodeSlot(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing vault slot: ${name}`);
  }

  const decoded = Buffer.from(value, "base64").toString("utf8").trim();
  if (!decoded) {
    throw new Error(`Empty decoded value for slot: ${name}`);
  }
  return decoded;
}

function assertHexAddress(value: string, label: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label}: expected 0x + 40 hex chars`);
  }
}

function assertHexPrivateKey(value: string, label: string): void {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`Invalid ${label}: expected 0x + 64 hex chars`);
  }
}

export function getBetaWalletSecrets(): WalletSecret[] {
  const wallet1 = {
    address: decodeSlot("VAULT_SLOT_A7"),
    privateKey: decodeSlot("VAULT_SLOT_A8"),
  };
  const wallet2 = {
    address: decodeSlot("VAULT_SLOT_B7"),
    privateKey: decodeSlot("VAULT_SLOT_B8"),
  };

  assertHexAddress(wallet1.address, "wallet1 address");
  assertHexPrivateKey(wallet1.privateKey, "wallet1 private key");
  assertHexAddress(wallet2.address, "wallet2 address");
  assertHexPrivateKey(wallet2.privateKey, "wallet2 private key");

  return [wallet1, wallet2];
}
