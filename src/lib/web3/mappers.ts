import {
  type GlobalStats,
  type PlayerBet,
  type RoundView,
  RoundSide,
  RoundStatus,
} from "@/lib/web3/types"

function fromStruct<T>(
  value: readonly unknown[] | Record<string, unknown>,
  key: string,
  fallbackIndex: number
): T {
  if (Array.isArray(value)) {
    return value[fallbackIndex] as T
  }

  const recordValue = value as Record<string, unknown>
  return recordValue[key] as T
}

export function mapRoundView(
  value: readonly unknown[] | Record<string, unknown>
): RoundView {
  return {
    id: fromStruct<bigint>(value, "id", 0),
    title: fromStruct<string>(value, "title", 1),
    metadataURI: fromStruct<string>(value, "metadataURI", 2),
    status: fromStruct<RoundStatus>(value, "status", 3),
    winningSide: fromStruct<RoundSide>(value, "winningSide", 4),
    createdAt: fromStruct<bigint>(value, "createdAt", 5),
    openedAt: fromStruct<bigint>(value, "openedAt", 6),
    closedAt: fromStruct<bigint>(value, "closedAt", 7),
    settledAt: fromStruct<bigint>(value, "settledAt", 8),
    canceledAt: fromStruct<bigint>(value, "canceledAt", 9),
    totalPool: fromStruct<bigint>(value, "totalPool", 10),
    feeAmount: fromStruct<bigint>(value, "feeAmount", 11),
    netPayoutPool: fromStruct<bigint>(value, "netPayoutPool", 12),
    sideATotal: fromStruct<bigint>(value, "sideATotal", 13),
    sideBTotal: fromStruct<bigint>(value, "sideBTotal", 14),
    bettorCount: fromStruct<bigint>(value, "bettorCount", 15),
  }
}

export function mapPlayerBet(
  value: readonly unknown[] | Record<string, unknown>
): PlayerBet {
  return {
    amount: fromStruct<bigint>(value, "amount", 0),
    side: fromStruct<RoundSide>(value, "side", 1),
    placed: fromStruct<boolean>(value, "placed", 2),
    claimed: fromStruct<boolean>(value, "claimed", 3),
  }
}

export function mapGlobalStats(
  value: readonly unknown[] | Record<string, unknown>
): GlobalStats {
  return {
    activeRounds: fromStruct<bigint>(value, "activeRounds", 0),
    totalRoundsCreated: fromStruct<bigint>(value, "totalRoundsCreated", 1),
    totalRoundsTracked: fromStruct<bigint>(value, "totalRoundsTracked", 2),
    activeDraftRounds: fromStruct<bigint>(value, "activeDraftRounds", 3),
    activeOpenRounds: fromStruct<bigint>(value, "activeOpenRounds", 4),
    activeClosedRounds: fromStruct<bigint>(value, "activeClosedRounds", 5),
    totalSettledRounds: fromStruct<bigint>(value, "totalSettledRounds", 6),
    totalCanceledRounds: fromStruct<bigint>(value, "totalCanceledRounds", 7),
    totalVolumeStaked: fromStruct<bigint>(value, "totalVolumeStaked", 8),
    accruedFees: fromStruct<bigint>(value, "accruedFees", 9),
  }
}
