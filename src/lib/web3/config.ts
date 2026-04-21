import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { QueryClient } from "@tanstack/react-query"
import { http } from "wagmi"
import { sepolia } from "wagmi/chains"

import { APP_NAME } from "@/lib/web3/constants"

const fallbackWalletConnectProjectId = "YOUR_WALLETCONNECT_PROJECT_ID"

export const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
  fallbackWalletConnectProjectId

export const isWalletConnectProjectIdPlaceholder =
  walletConnectProjectId === fallbackWalletConnectProjectId

const sepoliaRpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL

export const wagmiConfig = getDefaultConfig({
  appName: APP_NAME,
  projectId: walletConnectProjectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: sepoliaRpcUrl ? http(sepoliaRpcUrl) : http(),
  },
  ssr: false,
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
