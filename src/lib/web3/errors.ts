import { BaseError, ContractFunctionRevertedError } from "viem"

import { getRoundStatusLabel, RoundStatus } from "@/lib/web3/types"

const ERROR_MESSAGES: Record<string, string> = {
  ZeroAddress: "Address cannot be zero.",
  ZeroAmount: "Amount must be greater than zero.",
  RoundNotFound: "Round not found.",
  RoundAlreadyFinalized: "Round is already finalized.",
  RoundHasBettors: "Round still has bettors and cannot be removed.",
  RoundHasNoBets: "Round has no bets to settle.",
  BetAlreadyPlaced: "You already placed a bet for this round.",
  BetNotPlaced: "No bet found for this round.",
  AlreadyClaimed: "This round has already been claimed by this account.",
  NotWinningSide: "Your bet is not on the winning side.",
  InsufficientFeeBalance:
    "Requested fee withdrawal exceeds available accrued fees.",
  InvalidPagination: "Invalid history pagination request.",
}

function stringifyArg(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifyArg(item)).join(", ")
  }

  return String(value)
}

function parseStatus(value: unknown): string {
  if (typeof value === "bigint" || typeof value === "number") {
    return getRoundStatusLabel(Number(value) as RoundStatus)
  }

  return stringifyArg(value)
}

export function decodeContractError(error: unknown): string {
  if (!(error instanceof BaseError)) {
    return "Transaction failed. Please try again."
  }

  const revertedError = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError
  ) as ContractFunctionRevertedError | null

  const errorName = revertedError?.data?.errorName
  const args = revertedError?.data?.args

  if (!errorName) {
    return error.shortMessage || error.message
  }

  if (errorName === "InvalidRoundStatus" && args?.length === 3) {
    return `Round ${stringifyArg(args[0])} must be ${parseStatus(args[1])}, but is ${parseStatus(args[2])}.`
  }

  if (errorName === "BetBelowMinimum" && args?.length === 2) {
    return `Bet amount ${stringifyArg(args[0])} is lower than minimum ${stringifyArg(args[1])}.`
  }

  return ERROR_MESSAGES[errorName] ?? error.shortMessage ?? error.message
}
