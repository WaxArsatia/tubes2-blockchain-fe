import type { Address } from "viem"

import { blockchainGameAbi } from "@/lib/web3/abi"
import { BLOCKCHAIN_GAME_CONTRACT_ADDRESS } from "@/lib/web3/constants"
import { RoundSide } from "@/lib/web3/types"

export const blockchainGameContract = {
  address: BLOCKCHAIN_GAME_CONTRACT_ADDRESS,
  abi: blockchainGameAbi,
} as const

export const blockchainGameReads = {
  minBetAmount: () =>
    ({
      ...blockchainGameContract,
      functionName: "minBetAmount",
    }) as const,
  accruedFees: () =>
    ({
      ...blockchainGameContract,
      functionName: "accruedFees",
    }) as const,
  balanceOf: (account: Address) =>
    ({
      ...blockchainGameContract,
      functionName: "balanceOf",
      args: [account],
    }) as const,
  getRoundIds: () =>
    ({
      ...blockchainGameContract,
      functionName: "getRoundIds",
    }) as const,
  getRound: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "getRound",
      args: [roundId],
    }) as const,
  getPlayerBet: (roundId: bigint, player: Address) =>
    ({
      ...blockchainGameContract,
      functionName: "getPlayerBet",
      args: [roundId, player],
    }) as const,
  getGlobalStats: () =>
    ({
      ...blockchainGameContract,
      functionName: "getGlobalStats",
    }) as const,
  operatorRole: () =>
    ({
      ...blockchainGameContract,
      functionName: "OPERATOR_ROLE",
    }) as const,
  treasurerRole: () =>
    ({
      ...blockchainGameContract,
      functionName: "TREASURER_ROLE",
    }) as const,
  adminRole: () =>
    ({
      ...blockchainGameContract,
      functionName: "DEFAULT_ADMIN_ROLE",
    }) as const,
  hasRole: (role: `0x${string}`, account: Address) =>
    ({
      ...blockchainGameContract,
      functionName: "hasRole",
      args: [role, account],
    }) as const,
}

export const blockchainGameWrites = {
  placeBet: (roundId: bigint, side: RoundSide, amount: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "placeBet",
      args: [roundId, side, amount],
    }) as const,
  claimPayout: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "claimPayout",
      args: [roundId],
    }) as const,
  claimRefund: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "claimRefund",
      args: [roundId],
    }) as const,
  createRound: (title: string, metadataURI: string) =>
    ({
      ...blockchainGameContract,
      functionName: "createRound",
      args: [title, metadataURI],
    }) as const,
  updateRound: (roundId: bigint, title: string, metadataURI: string) =>
    ({
      ...blockchainGameContract,
      functionName: "updateRound",
      args: [roundId, title, metadataURI],
    }) as const,
  deleteRound: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "deleteRound",
      args: [roundId],
    }) as const,
  openRound: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "openRound",
      args: [roundId],
    }) as const,
  closeRound: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "closeRound",
      args: [roundId],
    }) as const,
  settleRound: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "settleRound",
      args: [roundId],
    }) as const,
  cancelRound: (roundId: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "cancelRound",
      args: [roundId],
    }) as const,
  mint: (to: Address, amount: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "mint",
      args: [to, amount],
    }) as const,
  setMinBetAmount: (amount: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "setMinBetAmount",
      args: [amount],
    }) as const,
  withdrawFees: (recipient: Address, amount: bigint) =>
    ({
      ...blockchainGameContract,
      functionName: "withdrawFees",
      args: [recipient, amount],
    }) as const,
}
