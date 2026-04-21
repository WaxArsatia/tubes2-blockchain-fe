import type { Hash } from "viem"

export const RoundStatus = {
  DRAFT: 0,
  OPEN: 1,
  CLOSED: 2,
  SETTLED: 3,
  CANCELED: 4,
} as const

export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus]

export const RoundSide = {
  SIDE_A: 0,
  SIDE_B: 1,
} as const

export type RoundSide = (typeof RoundSide)[keyof typeof RoundSide]

export type RoundView = {
  id: bigint
  title: string
  metadataURI: string
  status: RoundStatus
  winningSide: RoundSide
  createdAt: bigint
  openedAt: bigint
  closedAt: bigint
  settledAt: bigint
  canceledAt: bigint
  totalPool: bigint
  feeAmount: bigint
  netPayoutPool: bigint
  sideATotal: bigint
  sideBTotal: bigint
  bettorCount: bigint
}

export type PlayerBet = {
  amount: bigint
  side: RoundSide
  placed: boolean
  claimed: boolean
}

export type GlobalStats = {
  activeRounds: bigint
  totalRoundsCreated: bigint
  totalRoundsTracked: bigint
  activeDraftRounds: bigint
  activeOpenRounds: bigint
  activeClosedRounds: bigint
  totalSettledRounds: bigint
  totalCanceledRounds: bigint
  totalVolumeStaked: bigint
  accruedFees: bigint
}

export type RoleAccess = {
  isAdmin: boolean
  isOperator: boolean
  isTreasurer: boolean
}

export type RecentTransactionStatus = "pending" | "success" | "error"

export type RecentTransaction = {
  hash: Hash
  label: string
  status: RecentTransactionStatus
  submittedAt: number
  explorerUrl: string
  errorMessage?: string
}

export type RoundHistoryItem = {
  id: string
  roundId: bigint
  kind: "settled" | "canceled"
  blockNumber: bigint
  txHash: Hash
  createdAt: number
  winningSide?: RoundSide
  totalPool?: bigint
  feeAmount?: bigint
  netPayoutPool?: bigint
}

export function getRoundStatusLabel(status: RoundStatus): string {
  switch (status) {
    case RoundStatus.DRAFT:
      return "Draft"
    case RoundStatus.OPEN:
      return "Open"
    case RoundStatus.CLOSED:
      return "Closed"
    case RoundStatus.SETTLED:
      return "Settled"
    case RoundStatus.CANCELED:
      return "Canceled"
    default:
      return "Unknown"
  }
}

export function getSideLabel(side: RoundSide): string {
  switch (side) {
    case RoundSide.SIDE_A:
      return "SIDE_A"
    case RoundSide.SIDE_B:
      return "SIDE_B"
    default:
      return "Unknown"
  }
}
