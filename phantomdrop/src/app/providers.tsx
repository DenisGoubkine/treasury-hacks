"use client";

import { UnlinkProvider } from "@unlink-xyz/react";
import { ReactNode } from "react";
import { CHAIN } from "@/lib/constants";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UnlinkProvider chain={CHAIN} syncInterval={4000}>
      {children}
    </UnlinkProvider>
  );
}
