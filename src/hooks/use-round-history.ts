import { useCallback, useEffect, useMemo, useState } from "react"

import { toast } from "sonner"
import { parseAbiItem } from "viem"
import { usePublicClient } from "wagmi"

import {
  BLOCKCHAIN_GAME_CONTRACT_ADDRESS,
  HISTORY_BLOCK_WINDOW,
  HISTORY_RETENTION,
  SEPOLIA_EXPLORER_BASE_URL,
} from "@/lib/web3/constants"
import { type RoundHistoryItem, RoundSide } from "@/lib/web3/types"

const roundSettledEvent = parseAbiItem(
  "event RoundSettled(uint256 indexed roundId, uint8 winningSide, uint256 totalPool, uint256 feeAmount, uint256 netPayoutPool, uint256 randomness)"
)

const roundCanceledEvent = parseAbiItem(
  "event RoundCanceled(uint256 indexed roundId, uint64 canceledAt)"
)

function sortHistory(items: RoundHistoryItem[]): RoundHistoryItem[] {
  return items.sort((left, right) => {
    if (left.blockNumber === right.blockNumber) {
      return right.id.localeCompare(left.id)
    }

    return Number(right.blockNumber - left.blockNumber)
  })
}

export function useRoundHistory() {
  const publicClient = usePublicClient()

  const [items, setItems] = useState<RoundHistoryItem[]>([])
  const [cursorBlock, setCursorBlock] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [hasLoadError, setHasLoadError] = useState(false)

  const loadMore = useCallback(async () => {
    if (!publicClient || isLoading || !hasMore) {
      return
    }

    setIsLoading(true)

    try {
      const latest = cursorBlock ?? (await publicClient.getBlockNumber())
      const fromBlock =
        latest > HISTORY_BLOCK_WINDOW ? latest - HISTORY_BLOCK_WINDOW : 0n

      const [settledLogs, canceledLogs] = await Promise.all([
        publicClient.getLogs({
          address: BLOCKCHAIN_GAME_CONTRACT_ADDRESS,
          event: roundSettledEvent,
          fromBlock,
          toBlock: latest,
        }),
        publicClient.getLogs({
          address: BLOCKCHAIN_GAME_CONTRACT_ADDRESS,
          event: roundCanceledEvent,
          fromBlock,
          toBlock: latest,
        }),
      ])

      const settledItems: RoundHistoryItem[] = []
      for (const log of settledLogs) {
        const args = log.args
        if (
          !args ||
          args.roundId === undefined ||
          args.winningSide === undefined ||
          args.totalPool === undefined ||
          args.feeAmount === undefined ||
          args.netPayoutPool === undefined
        ) {
          continue
        }

        settledItems.push({
          id: `${log.transactionHash}-${log.logIndex}`,
          roundId: args.roundId,
          kind: "settled",
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          createdAt: Date.now(),
          winningSide: Number(args.winningSide) as RoundSide,
          totalPool: args.totalPool,
          feeAmount: args.feeAmount,
          netPayoutPool: args.netPayoutPool,
        })
      }

      const canceledItems: RoundHistoryItem[] = []
      for (const log of canceledLogs) {
        const args = log.args
        if (!args || args.roundId === undefined) {
          continue
        }

        canceledItems.push({
          id: `${log.transactionHash}-${log.logIndex}`,
          roundId: args.roundId,
          kind: "canceled",
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          createdAt: Date.now(),
        })
      }

      const incoming = sortHistory([...settledItems, ...canceledItems])

      setItems((previous) => {
        const dedupe = new Map<string, RoundHistoryItem>()

        for (const item of previous) {
          dedupe.set(item.id, item)
        }

        for (const item of incoming) {
          dedupe.set(item.id, item)
        }

        return sortHistory([...dedupe.values()]).slice(0, HISTORY_RETENTION)
      })

      if (fromBlock === 0n) {
        setHasMore(false)
        setCursorBlock(null)
      } else {
        setCursorBlock(fromBlock - 1n)
      }
    } catch {
      toast.error("Failed to load round history from events.")
      setHasLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [cursorBlock, hasMore, isLoading, publicClient])

  const refresh = useCallback(() => {
    setItems([])
    setCursorBlock(null)
    setHasMore(true)
    setHasLoadError(false)
  }, [])

  useEffect(() => {
    if (items.length === 0 && hasMore && !isLoading && !hasLoadError) {
      const timer = window.setTimeout(() => {
        void loadMore()
      }, 0)

      return () => {
        window.clearTimeout(timer)
      }
    }

    return undefined
  }, [hasLoadError, hasMore, isLoading, items.length, loadMore])

  const itemCountLabel = useMemo(() => {
    if (items.length === 0) {
      return "No history loaded yet"
    }

    return `${items.length} event entries cached in browser`
  }, [items.length])

  return {
    items,
    hasMore,
    isLoading,
    loadMore,
    refresh,
    itemCountLabel,
    explorerBaseUrl: SEPOLIA_EXPLORER_BASE_URL,
  }
}
