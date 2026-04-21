import { useCallback, useMemo, useState } from "react"

import { useQueryClient } from "@tanstack/react-query"
import type { Address, Hash } from "viem"
import { usePublicClient, useWriteContract } from "wagmi"
import { toast } from "sonner"

import { blockchainGameWrites } from "@/lib/web3/contract"
import {
  SEPOLIA_EXPLORER_BASE_URL,
  TRANSACTION_RETENTION,
} from "@/lib/web3/constants"
import { decodeContractError } from "@/lib/web3/errors"
import { type RecentTransaction, type RoundSide } from "@/lib/web3/types"

function withExplorerLink(hash: Hash): string {
  return `${SEPOLIA_EXPLORER_BASE_URL}/tx/${hash}`
}

export function useBettingActions() {
  const queryClient = useQueryClient()
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending } = useWriteContract()
  const [recentTransactions, setRecentTransactions] = useState<
    RecentTransaction[]
  >([])

  const updateTransaction = useCallback(
    (
      hash: Hash,
      status: RecentTransaction["status"],
      errorMessage?: string
    ) => {
      setRecentTransactions((previous) =>
        previous.map((item) =>
          item.hash === hash
            ? {
                ...item,
                status,
                errorMessage,
              }
            : item
        )
      )
    },
    []
  )

  const runTransaction = useCallback(
    async (
      label: string,
      request: Parameters<typeof writeContractAsync>[0]
    ): Promise<Hash> => {
      let submittedHash: Hash | null = null

      try {
        submittedHash = await writeContractAsync(request)

        const pendingItem: RecentTransaction = {
          hash: submittedHash,
          label,
          status: "pending",
          submittedAt: Date.now(),
          explorerUrl: withExplorerLink(submittedHash),
        }

        setRecentTransactions((previous) => {
          const deduped = previous.filter((item) => item.hash !== submittedHash)
          return [pendingItem, ...deduped].slice(0, TRANSACTION_RETENTION)
        })

        toast.loading(`${label} submitted`, {
          id: submittedHash,
          description: submittedHash,
        })

        if (!publicClient) {
          throw new Error("Public client is unavailable.")
        }

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: submittedHash,
        })

        if (receipt.status !== "success") {
          throw new Error("Transaction reverted by EVM.")
        }

        updateTransaction(submittedHash, "success")
        toast.success(`${label} confirmed`, {
          id: submittedHash,
          description: submittedHash,
        })

        await queryClient.invalidateQueries()
        return submittedHash
      } catch (error) {
        const message = decodeContractError(error)

        if (submittedHash) {
          updateTransaction(submittedHash, "error", message)
          toast.error(`${label} failed`, {
            id: submittedHash,
            description: message,
          })
        } else {
          toast.error(message)
        }

        throw error
      }
    },
    [publicClient, queryClient, updateTransaction, writeContractAsync]
  )

  const actions = useMemo(
    () => ({
      placeBet: (roundId: bigint, side: RoundSide, amount: bigint) =>
        runTransaction(
          "Place bet",
          blockchainGameWrites.placeBet(roundId, side, amount)
        ),
      claimPayout: (roundId: bigint) =>
        runTransaction(
          "Claim payout",
          blockchainGameWrites.claimPayout(roundId)
        ),
      claimRefund: (roundId: bigint) =>
        runTransaction(
          "Claim refund",
          blockchainGameWrites.claimRefund(roundId)
        ),
      createRound: (title: string, metadataURI: string) =>
        runTransaction(
          "Create round",
          blockchainGameWrites.createRound(title, metadataURI)
        ),
      updateRound: (roundId: bigint, title: string, metadataURI: string) =>
        runTransaction(
          "Update round",
          blockchainGameWrites.updateRound(roundId, title, metadataURI)
        ),
      deleteRound: (roundId: bigint) =>
        runTransaction(
          "Delete round",
          blockchainGameWrites.deleteRound(roundId)
        ),
      openRound: (roundId: bigint) =>
        runTransaction("Open round", blockchainGameWrites.openRound(roundId)),
      closeRound: (roundId: bigint) =>
        runTransaction("Close round", blockchainGameWrites.closeRound(roundId)),
      settleRound: (roundId: bigint) =>
        runTransaction(
          "Settle round",
          blockchainGameWrites.settleRound(roundId)
        ),
      cancelRound: (roundId: bigint) =>
        runTransaction(
          "Cancel round",
          blockchainGameWrites.cancelRound(roundId)
        ),
      mint: (recipient: Address, amount: bigint) =>
        runTransaction(
          "Mint GAME",
          blockchainGameWrites.mint(recipient, amount)
        ),
      setMinBetAmount: (amount: bigint) =>
        runTransaction(
          "Set minimum bet",
          blockchainGameWrites.setMinBetAmount(amount)
        ),
      withdrawFees: (recipient: Address, amount: bigint) =>
        runTransaction(
          "Withdraw fees",
          blockchainGameWrites.withdrawFees(recipient, amount)
        ),
    }),
    [runTransaction]
  )

  return {
    ...actions,
    recentTransactions,
    isPending,
  }
}
