import "@rainbow-me/rainbowkit/styles.css"

import type { ReactNode } from "react"

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import { QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { queryClient, wagmiConfig } from "@/lib/web3/config"

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          showRecentTransactions
          theme={darkTheme({
            accentColor: "#16b38a",
            accentColorForeground: "#041311",
            overlayBlur: "small",
            borderRadius: "small",
          })}
        >
          <ThemeProvider defaultTheme="dark" forcedTheme="dark">
            {children}
            <Toaster richColors closeButton />
          </ThemeProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
