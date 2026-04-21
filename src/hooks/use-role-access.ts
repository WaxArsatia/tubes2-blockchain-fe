import { useMemo } from "react"
import { useAccount, useReadContracts } from "wagmi"

import { blockchainGameReads } from "@/lib/web3/contract"

const ZERO_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const

export function useRoleAccess() {
  const { address } = useAccount()

  const roleIdsQuery = useReadContracts({
    contracts: [
      blockchainGameReads.adminRole(),
      blockchainGameReads.operatorRole(),
      blockchainGameReads.treasurerRole(),
    ],
    allowFailure: false,
  })

  const adminRole =
    (roleIdsQuery.data?.[0] as `0x${string}` | undefined) ?? ZERO_ROLE
  const operatorRole =
    (roleIdsQuery.data?.[1] as `0x${string}` | undefined) ?? ZERO_ROLE
  const treasurerRole =
    (roleIdsQuery.data?.[2] as `0x${string}` | undefined) ?? ZERO_ROLE

  const roleChecksQuery = useReadContracts({
    contracts:
      address && roleIdsQuery.data
        ? [
            blockchainGameReads.hasRole(adminRole, address),
            blockchainGameReads.hasRole(operatorRole, address),
            blockchainGameReads.hasRole(treasurerRole, address),
          ]
        : [],
    allowFailure: false,
    query: {
      enabled: Boolean(address && roleIdsQuery.data),
      refetchInterval: 15_000,
    },
  })

  const access = useMemo(() => {
    const isAdmin = Boolean(roleChecksQuery.data?.[0])
    const isOperator = Boolean(roleChecksQuery.data?.[1])
    const isTreasurer = Boolean(roleChecksQuery.data?.[2])

    return {
      isAdmin,
      isOperator,
      isTreasurer,
    }
  }, [roleChecksQuery.data])

  const hasResolvedRoleChecks = Boolean(roleChecksQuery.data)

  return {
    ...access,
    isConnected: Boolean(address),
    roleWarning:
      address &&
      hasResolvedRoleChecks &&
      !access.isAdmin &&
      !access.isOperator &&
      !access.isTreasurer
        ? "Connected wallet has no privileged role. Panels remain read-only."
        : null,
  }
}
