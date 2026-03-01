"use client";

import { UnlinkProvider } from "@unlink-xyz/react";
import { ReactNode } from "react";
import {
  MONAD_CHAIN_ID,
  MONAD_FINALITY_MS,
  UNLINK_ARTIFACT_BASE_URL,
  UNLINK_ARTIFACT_VERSION,
  UNLINK_GATEWAY_URL,
  UNLINK_POOL_ADDRESS,
} from "@/lib/constants";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UnlinkProvider
      chainId={MONAD_CHAIN_ID}
      gatewayUrl={UNLINK_GATEWAY_URL}
      poolAddress={UNLINK_POOL_ADDRESS}
      syncInterval={MONAD_FINALITY_MS}
      prover={{
        artifactSource: {
          baseUrl: UNLINK_ARTIFACT_BASE_URL,
          version: UNLINK_ARTIFACT_VERSION,
        },
      }}
    >
      {children}
    </UnlinkProvider>
  );
}
