import { useCallback } from "react"

import { useQueryClient } from "@tanstack/react-query"
import { useWatchContractEvent } from "wagmi"

import { blockchainGameContract } from "@/lib/web3/contract"

type LiveEventName =
  | "BetPlaced"
  | "RoundOpened"
  | "RoundSettled"
  | "RoundCanceled"
  | "PayoutClaimed"
  | "RefundClaimed"

type UseLiveSyncOptions = {
  onEvent?: (eventName: LiveEventName) => void
}

export function useLiveSync(options?: UseLiveSyncOptions) {
  const queryClient = useQueryClient()

  const handleEvent = useCallback(
    (eventName: LiveEventName) => {
      options?.onEvent?.(eventName)
      void queryClient.invalidateQueries()
    },
    [options, queryClient]
  )

  useWatchContractEvent({
    ...blockchainGameContract,
    eventName: "BetPlaced",
    onLogs(logs) {
      if (logs.length > 0) {
        handleEvent("BetPlaced")
      }
    },
  })

  useWatchContractEvent({
    ...blockchainGameContract,
    eventName: "RoundOpened",
    onLogs(logs) {
      if (logs.length > 0) {
        handleEvent("RoundOpened")
      }
    },
  })

  useWatchContractEvent({
    ...blockchainGameContract,
    eventName: "RoundSettled",
    onLogs(logs) {
      if (logs.length > 0) {
        handleEvent("RoundSettled")
      }
    },
  })

  useWatchContractEvent({
    ...blockchainGameContract,
    eventName: "RoundCanceled",
    onLogs(logs) {
      if (logs.length > 0) {
        handleEvent("RoundCanceled")
      }
    },
  })

  useWatchContractEvent({
    ...blockchainGameContract,
    eventName: "PayoutClaimed",
    onLogs(logs) {
      if (logs.length > 0) {
        handleEvent("PayoutClaimed")
      }
    },
  })

  useWatchContractEvent({
    ...blockchainGameContract,
    eventName: "RefundClaimed",
    onLogs(logs) {
      if (logs.length > 0) {
        handleEvent("RefundClaimed")
      }
    },
  })
}
