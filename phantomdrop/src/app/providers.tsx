"use client";

import { UnlinkProvider } from "@unlink-xyz/react";
import { ReactNode } from "react";
import { CHAIN, MONAD_FINALITY_MS } from "@/lib/constants";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UnlinkProvider chain={CHAIN} syncInterval={MONAD_FINALITY_MS}>
      {children}
    </UnlinkProvider>
  );
}
