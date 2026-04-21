import { formatDistanceToNow } from "date-fns"
import { formatUnits } from "viem"

const TOKEN_DECIMALS = 18

export function formatGameTokenAmount(
  amount: bigint,
  fractionDigits = 2
): string {
  const normalized = Number(formatUnits(amount, TOKEN_DECIMALS))

  if (!Number.isFinite(normalized)) {
    return "0"
  }

  return normalized.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatTimestamp(timestamp: bigint): string {
  if (timestamp === 0n) {
    return "-"
  }

  return new Date(Number(timestamp) * 1000).toLocaleString()
}

export function formatRelativeTimestamp(timestamp: number): string {
  return formatDistanceToNow(timestamp, { addSuffix: true })
}
