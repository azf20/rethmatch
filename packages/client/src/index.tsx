import { createRoot } from "react-dom/client";

import { ChakraProvider } from "@chakra-ui/react";

import { App } from "./App";

import "./styles.css";

import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";

import { createSyncAdapter } from "@latticexyz/store-sync/internal";
import { SyncProvider } from "@latticexyz/store-sync/react";
import {
  CHAIN_ID,
  QUERY_CLIENT,
  START_BLOCK,
  WAGMI_CONFIG,
  WORLD_ADDRESS,
} from "./common";
import { stash } from "./mud/stash";

createRoot(document.getElementById("react-root")!).render(
  <ChakraProvider>
    <WagmiProvider config={WAGMI_CONFIG}>
      <QueryClientProvider client={QUERY_CLIENT}>
        <SyncProvider
          chainId={CHAIN_ID}
          address={WORLD_ADDRESS}
          startBlock={START_BLOCK}
          adapter={createSyncAdapter({ stash })}
        >
          <App />
        </SyncProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ChakraProvider>
);
