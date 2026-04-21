import { formatDistanceToNow } from "date-fns"
import { formatUnits } from "viem"

const TOKEN_DECIMALS = 18

export function formatGameTokenAmount(
  amount: bigint,
  fractionDigits = 2
): string {
  const normalized = formatUnits(amount, TOKEN_DECIMALS)
  const [whole, fraction = ""] = normalized.split(".")
  const maxFractionDigits = Math.max(0, Math.trunc(fractionDigits))
  const visibleFraction = fraction
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "")
  const groupedWhole = BigInt(whole).toLocaleString("en-US")

  return visibleFraction ? `${groupedWhole}.${visibleFraction}` : groupedWhole
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
