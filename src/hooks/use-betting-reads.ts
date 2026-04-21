import { useMemo } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"

import { blockchainGameReads } from "@/lib/web3/contract"
import { mapGlobalStats, mapPlayerBet, mapRoundView } from "@/lib/web3/mappers"
import {
  type GlobalStats,
  type PlayerBet,
  type RoundView,
} from "@/lib/web3/types"

type SettledReadResult<T> =
  | T
  | {
      status: "success"
      result: T
    }
  | {
      status: "failure"
      error: Error
    }

function unwrapReadResult<T>(value: SettledReadResult<T>): T | null {
  if (value && typeof value === "object" && "status" in value) {
    if (value.status === "success") {
      return value.result
    }

    return null
  }

  return value as T
}

export function useBettingReads() {
  const { address } = useAccount()

  const globalStatsQuery = useReadContract({
    ...blockchainGameReads.getGlobalStats(),
    query: { refetchInterval: 15_000 },
  })

  const minBetAmountQuery = useReadContract({
    ...blockchainGameReads.minBetAmount(),
    query: { refetchInterval: 15_000 },
  })

  const accruedFeesQuery = useReadContract({
    ...blockchainGameReads.accruedFees(),
    query: { refetchInterval: 15_000 },
  })

  const roundIdsQuery = useReadContract({
    ...blockchainGameReads.getRoundIds(),
    query: { refetchInterval: 8_000 },
  })

  const balanceQuery = useReadContract({
    ...blockchainGameReads.balanceOf(
      address ?? "0x0000000000000000000000000000000000000000"
    ),
    query: {
      enabled: Boolean(address),
      refetchInterval: 10_000,
    },
  })

  const roundIds = useMemo(() => {
    return ((roundIdsQuery.data as bigint[] | undefined) ?? []).slice()
  }, [roundIdsQuery.data])

  const roundViewsQuery = useReadContracts({
    contracts: roundIds.map((roundId) => blockchainGameReads.getRound(roundId)),
    allowFailure: true,
    query: {
      enabled: roundIds.length > 0,
      refetchInterval: 8_000,
    },
  })

  const playerBetsQuery = useReadContracts({
    contracts:
      address && roundIds.length > 0
        ? roundIds.map((roundId) =>
            blockchainGameReads.getPlayerBet(roundId, address)
          )
        : [],
    allowFailure: true,
    query: {
      enabled: Boolean(address) && roundIds.length > 0,
      refetchInterval: 8_000,
    },
  })

  const rounds: RoundView[] = useMemo(() => {
    const items = (roundViewsQuery.data ?? []) as SettledReadResult<
      readonly unknown[] | Record<string, unknown>
    >[]

    return items
      .map((item) => unwrapReadResult(item))
      .filter((item): item is readonly unknown[] | Record<string, unknown> =>
        Boolean(item)
      )
      .map((item) => mapRoundView(item))
      .sort((left, right) => Number(right.id - left.id))
  }, [roundViewsQuery.data])

  const playerBetsByRound = useMemo(() => {
    const map = new Map<bigint, PlayerBet>()

    const items = (playerBetsQuery.data ?? []) as SettledReadResult<
      readonly unknown[] | Record<string, unknown>
    >[]

    items.forEach((item, index) => {
      const resolved = unwrapReadResult(item)
      const roundId = roundIds[index]

      if (!resolved || !roundId) {
        return
      }

      map.set(roundId, mapPlayerBet(resolved))
    })

    return map
  }, [playerBetsQuery.data, roundIds])

  const globalStats = useMemo(() => {
    if (!globalStatsQuery.data) {
      return null
    }

    return mapGlobalStats(
      globalStatsQuery.data as readonly unknown[] | Record<string, unknown>
    )
  }, [globalStatsQuery.data])

  const isAnyLoading =
    globalStatsQuery.isLoading ||
    minBetAmountQuery.isLoading ||
    roundIdsQuery.isLoading ||
    roundViewsQuery.isLoading

  return {
    address,
    rounds,
    roundIds,
    playerBetsByRound,
    globalStats: globalStats as GlobalStats | null,
    minBetAmount: minBetAmountQuery.data ?? 0n,
    accruedFees: accruedFeesQuery.data ?? 0n,
    tokenBalance: balanceQuery.data ?? 0n,
    isAnyLoading,
    isRefreshing:
      globalStatsQuery.isRefetching ||
      roundIdsQuery.isRefetching ||
      roundViewsQuery.isRefetching,
  }
}
