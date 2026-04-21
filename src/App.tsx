import { useCallback, useMemo, useState } from "react"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldAlertIcon,
  Wallet2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { isAddress, parseUnits } from "viem"
import { useReadContract } from "wagmi"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBettingActions } from "@/hooks/use-betting-actions"
import { useBettingReads } from "@/hooks/use-betting-reads"
import { useLiveSync } from "@/hooks/use-live-sync"
import { useRoleAccess } from "@/hooks/use-role-access"
import { useRoundHistory } from "@/hooks/use-round-history"
import { isWalletConnectProjectIdPlaceholder } from "@/lib/web3/config"
import { blockchainGameReads } from "@/lib/web3/contract"
import { decodeContractError } from "@/lib/web3/errors"
import {
  formatGameTokenAmount,
  formatRelativeTimestamp,
  formatTimestamp,
} from "@/lib/web3/format"
import { mapPlayerBet, mapRoundView } from "@/lib/web3/mappers"
import {
  getRoundStatusLabel,
  getSideLabel,
  RoundSide,
  RoundStatus,
  type RoundStatus as RoundStatusValue,
} from "@/lib/web3/types"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

function toBigIntOrNull(rawValue: string): bigint | null {
  const trimmed = rawValue.trim()

  if (!trimmed) {
    return null
  }

  try {
    return BigInt(trimmed)
  } catch {
    return null
  }
}

function parseTokenAmount(rawAmount: string): bigint {
  return parseUnits(rawAmount.trim(), 18)
}

function getStatusBadgeVariant(status: RoundStatusValue) {
  if (status === RoundStatus.OPEN) {
    return "default"
  }

  if (status === RoundStatus.CLOSED || status === RoundStatus.DRAFT) {
    return "secondary"
  }

  if (status === RoundStatus.SETTLED) {
    return "outline"
  }

  return "destructive"
}

export function App() {
  const [selectedRoundId, setSelectedRoundId] = useState<bigint | null>(null)
  const [betSide, setBetSide] = useState<RoundSide>(RoundSide.SIDE_A)
  const [betAmountInput, setBetAmountInput] = useState("")

  const [claimRoundInput, setClaimRoundInput] = useState("")
  const [createTitle, setCreateTitle] = useState("")
  const [createMetadataUri, setCreateMetadataUri] = useState("")

  const [adminRoundTargetInput, setAdminRoundTargetInput] = useState("")
  const [updateTitle, setUpdateTitle] = useState("")
  const [updateMetadataUri, setUpdateMetadataUri] = useState("")

  const [mintRecipient, setMintRecipient] = useState("")
  const [mintAmount, setMintAmount] = useState("")
  const [minBetInput, setMinBetInput] = useState("")

  const [withdrawRecipient, setWithdrawRecipient] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [lastEventLabel, setLastEventLabel] = useState<string | null>(null)

  const {
    address,
    rounds,
    globalStats,
    minBetAmount,
    accruedFees,
    tokenBalance,
    playerBetsByRound,
    isAnyLoading,
    isRefreshing,
  } = useBettingReads()

  const {
    placeBet,
    claimPayout,
    claimRefund,
    createRound,
    updateRound,
    deleteRound,
    openRound,
    closeRound,
    settleRound,
    cancelRound,
    mint,
    setMinBetAmount,
    withdrawFees,
    recentTransactions,
    isPending,
  } = useBettingActions()

  const { isConnected, isAdmin, isOperator, isTreasurer, roleWarning } =
    useRoleAccess()
  const history = useRoundHistory()

  const handleLiveEvent = useCallback(
    (eventName: string) => {
      setLastEventLabel(`${eventName} · ${new Date().toLocaleTimeString()}`)
      history.refresh()
    },
    [history]
  )

  useLiveSync({ onEvent: handleLiveEvent })

  const claimRoundId = useMemo(
    () => toBigIntOrNull(claimRoundInput),
    [claimRoundInput]
  )
  const adminRoundTarget = useMemo(
    () => toBigIntOrNull(adminRoundTargetInput),
    [adminRoundTargetInput]
  )

  const selectedRound = useMemo(() => {
    if (rounds.length === 0) {
      return null
    }

    if (selectedRoundId) {
      const matched = rounds.find((round) => round.id === selectedRoundId)
      if (matched) {
        return matched
      }
    }

    return rounds[0]
  }, [rounds, selectedRoundId])

  const inspectedRoundQuery = useReadContract({
    ...blockchainGameReads.getRound(claimRoundId ?? 0n),
    query: {
      enabled: claimRoundId !== null,
    },
  })

  const inspectedBetQuery = useReadContract({
    ...blockchainGameReads.getPlayerBet(
      claimRoundId ?? 0n,
      address ?? ZERO_ADDRESS
    ),
    query: {
      enabled: Boolean(address && claimRoundId !== null),
    },
  })

  const inspectedRound = useMemo(() => {
    if (!inspectedRoundQuery.data) {
      return null
    }

    return mapRoundView(
      inspectedRoundQuery.data as readonly unknown[] | Record<string, unknown>
    )
  }, [inspectedRoundQuery.data])

  const inspectedBet = useMemo(() => {
    if (!inspectedBetQuery.data) {
      return null
    }

    return mapPlayerBet(
      inspectedBetQuery.data as readonly unknown[] | Record<string, unknown>
    )
  }, [inspectedBetQuery.data])

  const selectedRoundBet =
    selectedRound && address
      ? (playerBetsByRound.get(selectedRound.id) ?? null)
      : null

  const roundCount = rounds.length

  const handlePlaceBet = async () => {
    if (!selectedRound) {
      toast.error("No active round available.")
      return
    }

    if (!address) {
      toast.error("Connect wallet before placing a bet.")
      return
    }

    if (selectedRound.status !== RoundStatus.OPEN) {
      toast.error("Betting is only allowed when the round is OPEN.")
      return
    }

    try {
      const parsedAmount = parseTokenAmount(betAmountInput)
      if (parsedAmount < minBetAmount) {
        toast.error(
          `Minimum bet is ${formatGameTokenAmount(minBetAmount)} GAME.`
        )
        return
      }

      await placeBet(selectedRound.id, betSide, parsedAmount)
      setBetAmountInput("")
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  const handleClaimPayout = async () => {
    if (!claimRoundId) {
      toast.error("Enter a round ID first.")
      return
    }

    if (!address) {
      toast.error("Connect wallet before claiming.")
      return
    }

    try {
      await claimPayout(claimRoundId)
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  const handleClaimRefund = async () => {
    if (!claimRoundId) {
      toast.error("Enter a round ID first.")
      return
    }

    if (!address) {
      toast.error("Connect wallet before claiming.")
      return
    }

    try {
      await claimRefund(claimRoundId)
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  const handleCreateRound = async () => {
    if (!createTitle.trim()) {
      toast.error("Round title is required.")
      return
    }

    try {
      await createRound(createTitle.trim(), createMetadataUri.trim())
      setCreateTitle("")
      setCreateMetadataUri("")
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  const handleUpdateRound = async () => {
    if (!adminRoundTarget) {
      toast.error("Provide a valid round ID.")
      return
    }

    if (!updateTitle.trim()) {
      toast.error("Updated title is required.")
      return
    }

    try {
      await updateRound(
        adminRoundTarget,
        updateTitle.trim(),
        updateMetadataUri.trim()
      )
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  const runRoundAction = async (
    actionName: string,
    action: (roundId: bigint) => Promise<unknown>
  ) => {
    if (!adminRoundTarget) {
      toast.error("Provide a valid round ID.")
      return
    }

    try {
      await action(adminRoundTarget)
    } catch (error) {
      toast.error(`${actionName}: ${decodeContractError(error)}`)
    }
  }

  const handleMint = async () => {
    if (!isAddress(mintRecipient)) {
      toast.error("Recipient must be a valid address.")
      return
    }

    try {
      await mint(mintRecipient, parseTokenAmount(mintAmount))
      setMintRecipient("")
      setMintAmount("")
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  const handleSetMinBet = async () => {
    try {
      await setMinBetAmount(parseTokenAmount(minBetInput))
      setMinBetInput("")
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  const handleWithdrawFees = async () => {
    if (!isAddress(withdrawRecipient)) {
      toast.error("Recipient must be a valid address.")
      return
    }

    try {
      await withdrawFees(withdrawRecipient, parseTokenAmount(withdrawAmount))
      setWithdrawRecipient("")
      setWithdrawAmount("")
    } catch (error) {
      toast.error(decodeContractError(error))
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(10,170,131,0.18),transparent_38%),radial-gradient(circle_at_85%_12%,rgba(70,90,255,0.17),transparent_34%),radial-gradient(circle_at_50%_120%,rgba(20,120,255,0.12),transparent_42%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8 lg:py-8">
        <Card className="border-white/5 bg-card/75 backdrop-blur-lg">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl">
                Sepolia Betting Control Panel
              </CardTitle>
              <CardDescription>
                Single-page dApp for contract
                0x6E556F9e7e680D8bBB969D300F96ccED40E94905.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Sepolia</Badge>
                <Badge variant="secondary">Dark Mode Only</Badge>
                <Badge variant="outline">SIDE_A / SIDE_B</Badge>
                {isRefreshing ? (
                  <Badge variant="secondary" className="gap-1">
                    <RefreshCwIcon className="size-3 animate-spin" />
                    Syncing
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <ConnectButton showBalance={false} />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet2Icon className="size-3" />
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "Wallet disconnected"}
              </div>
            </div>
          </CardHeader>
        </Card>

        {isWalletConnectProjectIdPlaceholder ? (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>WalletConnect Project ID Placeholder In Use</AlertTitle>
            <AlertDescription>
              Set VITE_WALLETCONNECT_PROJECT_ID before production deployment.
            </AlertDescription>
          </Alert>
        ) : null}

        {!isConnected ? (
          <Alert>
            <ShieldAlertIcon className="size-4" />
            <AlertTitle>Connect Wallet To Continue</AlertTitle>
            <AlertDescription>
              Connect a Sepolia wallet to place bets, claim rewards, and access
              role-based controls.
            </AlertDescription>
          </Alert>
        ) : null}

        {roleWarning ? (
          <Alert>
            <ShieldAlertIcon className="size-4" />
            <AlertTitle>Read-Only Privileged Panels</AlertTitle>
            <AlertDescription>{roleWarning}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Wallet Balance"
            value={`${formatGameTokenAmount(tokenBalance)} GAME`}
            helper="Connected account"
          />
          <StatCard
            label="Minimum Bet"
            value={`${formatGameTokenAmount(minBetAmount)} GAME`}
            helper="On-chain guard"
          />
          <StatCard
            label="Accrued Fees"
            value={`${formatGameTokenAmount(accruedFees)} GAME`}
            helper="Treasurer withdrawable"
          />
          <StatCard
            label="Active Rounds"
            value={String(roundCount)}
            helper={lastEventLabel ?? "Waiting for on-chain events"}
          />
        </section>

        <Tabs defaultValue="player" className="gap-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="player">Player Dashboard</TabsTrigger>
            <TabsTrigger value="operations">Operations Panel</TabsTrigger>
            <TabsTrigger value="history">History & Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="player" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Active Rounds</CardTitle>
                  <CardDescription>
                    Draft, open, and closed rounds are read live from contract
                    storage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isAnyLoading ? (
                    <div className="grid gap-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Round</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total Pool</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rounds.map((round) => (
                          <TableRow key={round.id.toString()}>
                            <TableCell>
                              <div className="font-medium">
                                #{round.id.toString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {round.title || "Untitled round"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getStatusBadgeVariant(round.status)}
                              >
                                {getRoundStatusLabel(round.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatGameTokenAmount(round.totalPool)} GAME
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedRoundId(round.id)}
                              >
                                Inspect
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {rounds.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground"
                            >
                              No active rounds available.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Round Detail</CardTitle>
                  <CardDescription>
                    Betting is only available while status is OPEN.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedRound ? (
                    <>
                      <div className="space-y-2 rounded-lg border border-white/8 bg-black/15 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            #{selectedRound.id.toString()}
                          </span>
                          <Badge
                            variant={getStatusBadgeVariant(
                              selectedRound.status
                            )}
                          >
                            {getRoundStatusLabel(selectedRound.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {selectedRound.title || "Untitled round"}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>
                            SIDE_A:{" "}
                            {formatGameTokenAmount(selectedRound.sideATotal)}
                          </span>
                          <span>
                            SIDE_B:{" "}
                            {formatGameTokenAmount(selectedRound.sideBTotal)}
                          </span>
                          <span>
                            Bettors: {selectedRound.bettorCount.toString()}
                          </span>
                          <span>
                            Total:{" "}
                            {formatGameTokenAmount(selectedRound.totalPool)}
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                          Place Bet
                        </p>
                        <ToggleGroup
                          value={[String(betSide)]}
                          onValueChange={(values) => {
                            const nextValue = values.at(0)

                            if (!nextValue) {
                              return
                            }

                            setBetSide(Number(nextValue) as RoundSide)
                          }}
                        >
                          <ToggleGroupItem value={String(RoundSide.SIDE_A)}>
                            SIDE_A
                          </ToggleGroupItem>
                          <ToggleGroupItem value={String(RoundSide.SIDE_B)}>
                            SIDE_B
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <Input
                          value={betAmountInput}
                          onChange={(event) =>
                            setBetAmountInput(event.target.value)
                          }
                          placeholder="Amount in GAME"
                        />
                        <Button
                          onClick={handlePlaceBet}
                          disabled={
                            isPending ||
                            selectedRound.status !== RoundStatus.OPEN
                          }
                          className="w-full"
                        >
                          {isPending ? (
                            <Loader2Icon className="size-4 animate-spin" />
                          ) : null}
                          Submit Bet
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Minimum: {formatGameTokenAmount(minBetAmount)} GAME
                        </p>
                      </div>

                      <Separator />

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>
                          Created: {formatTimestamp(selectedRound.createdAt)}
                        </div>
                        <div>
                          Opened: {formatTimestamp(selectedRound.openedAt)}
                        </div>
                        <div>
                          Closed: {formatTimestamp(selectedRound.closedAt)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a round from the table.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>My Position</CardTitle>
                  <CardDescription>
                    Position details for the selected round and connected
                    account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedRound && selectedRoundBet ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        Round #{selectedRound.id.toString()} ·{" "}
                        {selectedRound.title || "Untitled round"}
                      </div>
                      <div>
                        Bet: {formatGameTokenAmount(selectedRoundBet.amount)}{" "}
                        GAME
                      </div>
                      <div>Side: {getSideLabel(selectedRoundBet.side)}</div>
                      <div>
                        Placed: {selectedRoundBet.placed ? "Yes" : "No"}
                      </div>
                      <div>
                        Claimed: {selectedRoundBet.claimed ? "Yes" : "No"}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No position available for the current selection.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Claim Center</CardTitle>
                  <CardDescription>
                    Claim payout/refund by round ID. Needed because finalized
                    rounds are event-indexed in v1.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={claimRoundInput}
                    onChange={(event) => setClaimRoundInput(event.target.value)}
                    placeholder="Round ID"
                  />

                  {inspectedRound ? (
                    <div className="rounded-lg border border-white/8 bg-black/10 p-3 text-xs text-muted-foreground">
                      <div>
                        Status: {getRoundStatusLabel(inspectedRound.status)}
                      </div>
                      <div>
                        Winning Side: {getSideLabel(inspectedRound.winningSide)}
                      </div>
                      <div>
                        Total Pool:{" "}
                        {formatGameTokenAmount(inspectedRound.totalPool)} GAME
                      </div>
                      {inspectedBet ? (
                        <>
                          <Separator className="my-2" />
                          <div>
                            Your Bet:{" "}
                            {formatGameTokenAmount(inspectedBet.amount)} GAME
                          </div>
                          <div>
                            Your Side: {getSideLabel(inspectedBet.side)}
                          </div>
                          <div>
                            Claimed: {inspectedBet.claimed ? "Yes" : "No"}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : inspectedRoundQuery.error ? (
                    <p className="text-xs text-destructive">
                      Unable to load round. Check ID and network.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={handleClaimPayout}
                      disabled={isPending}
                    >
                      Claim Payout
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClaimRefund}
                      disabled={isPending}
                    >
                      Claim Refund
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Operator Panel</CardTitle>
                  <CardDescription>
                    Create, update, delete, open, close, settle, and cancel
                    rounds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isOperator ? (
                    <Alert>
                      <ShieldAlertIcon className="size-4" />
                      <AlertTitle>Operator role required</AlertTitle>
                      <AlertDescription>
                        This panel stays visible but actions are disabled
                        without OPERATOR_ROLE.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div
                    className={
                      isOperator
                        ? "space-y-3"
                        : "pointer-events-none space-y-3 opacity-60"
                    }
                  >
                    <div className="space-y-2 rounded-lg border border-white/8 bg-black/10 p-3">
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">
                        Create Round
                      </p>
                      <Input
                        value={createTitle}
                        onChange={(event) => setCreateTitle(event.target.value)}
                        placeholder="Round title"
                      />
                      <Textarea
                        value={createMetadataUri}
                        onChange={(event) =>
                          setCreateMetadataUri(event.target.value)
                        }
                        placeholder="Metadata URI (ignored by v1 UI)"
                      />
                      <Button
                        onClick={handleCreateRound}
                        disabled={!isOperator || isPending}
                      >
                        Create Round
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-lg border border-white/8 bg-black/10 p-3">
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">
                        Round Target
                      </p>
                      <Select
                        value={adminRoundTargetInput}
                        onValueChange={(value) =>
                          setAdminRoundTargetInput(value ?? "")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pick active round" />
                        </SelectTrigger>
                        <SelectContent>
                          {rounds.map((round) => (
                            <SelectItem
                              key={round.id.toString()}
                              value={round.id.toString()}
                            >
                              #{round.id.toString()} ·{" "}
                              {getRoundStatusLabel(round.status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={adminRoundTargetInput}
                        onChange={(event) =>
                          setAdminRoundTargetInput(event.target.value)
                        }
                        placeholder="Or type round ID"
                      />
                      <Input
                        value={updateTitle}
                        onChange={(event) => setUpdateTitle(event.target.value)}
                        placeholder="Updated title"
                      />
                      <Textarea
                        value={updateMetadataUri}
                        onChange={(event) =>
                          setUpdateMetadataUri(event.target.value)
                        }
                        placeholder="Updated metadata URI"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={handleUpdateRound}
                          disabled={!isOperator || isPending}
                        >
                          Update
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void runRoundAction("Delete", deleteRound)
                          }
                          disabled={!isOperator || isPending}
                        >
                          Delete
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => void runRoundAction("Open", openRound)}
                          disabled={!isOperator || isPending}
                        >
                          Open
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void runRoundAction("Close", closeRound)
                          }
                          disabled={!isOperator || isPending}
                        >
                          Close
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void runRoundAction("Settle", settleRound)
                          }
                          disabled={!isOperator || isPending}
                        >
                          Settle
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() =>
                            void runRoundAction("Cancel", cancelRound)
                          }
                          disabled={!isOperator || isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Admin Panel</CardTitle>
                    <CardDescription>
                      Mint tokens and update minimum bet size.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isAdmin ? (
                      <Alert>
                        <ShieldAlertIcon className="size-4" />
                        <AlertTitle>Admin role required</AlertTitle>
                        <AlertDescription>
                          GAME minting and min-bet updates require
                          DEFAULT_ADMIN_ROLE.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <div
                      className={
                        isAdmin
                          ? "space-y-3"
                          : "pointer-events-none space-y-3 opacity-60"
                      }
                    >
                      <div className="space-y-2 rounded-lg border border-white/8 bg-black/10 p-3">
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                          Mint GAME
                        </p>
                        <Input
                          value={mintRecipient}
                          onChange={(event) =>
                            setMintRecipient(event.target.value)
                          }
                          placeholder="Recipient address"
                        />
                        <Input
                          value={mintAmount}
                          onChange={(event) =>
                            setMintAmount(event.target.value)
                          }
                          placeholder="Amount"
                        />
                        <Button
                          onClick={handleMint}
                          disabled={!isAdmin || isPending}
                        >
                          Mint Tokens
                        </Button>
                      </div>

                      <div className="space-y-2 rounded-lg border border-white/8 bg-black/10 p-3">
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                          Set Min Bet
                        </p>
                        <Input
                          value={minBetInput}
                          onChange={(event) =>
                            setMinBetInput(event.target.value)
                          }
                          placeholder="New minimum GAME amount"
                        />
                        <Button
                          variant="outline"
                          onClick={handleSetMinBet}
                          disabled={!isAdmin || isPending}
                        >
                          Update Min Bet
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Treasurer Panel</CardTitle>
                    <CardDescription>
                      Withdraw accumulated platform fees.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isTreasurer ? (
                      <Alert>
                        <ShieldAlertIcon className="size-4" />
                        <AlertTitle>Treasurer role required</AlertTitle>
                        <AlertDescription>
                          Fee withdrawal is gated by TREASURER_ROLE.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <div
                      className={
                        isTreasurer
                          ? "space-y-3"
                          : "pointer-events-none space-y-3 opacity-60"
                      }
                    >
                      <Input
                        value={withdrawRecipient}
                        onChange={(event) =>
                          setWithdrawRecipient(event.target.value)
                        }
                        placeholder="Recipient address"
                      />
                      <Input
                        value={withdrawAmount}
                        onChange={(event) =>
                          setWithdrawAmount(event.target.value)
                        }
                        placeholder="Withdraw amount"
                      />
                      <Button
                        variant="outline"
                        onClick={handleWithdrawFees}
                        disabled={!isTreasurer || isPending}
                      >
                        Withdraw Fees
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        On-chain accrued fees:{" "}
                        {formatGameTokenAmount(accruedFees)} GAME
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Event-Based Round History (v1)</CardTitle>
                  <CardDescription>
                    Browser-only aggregation of RoundSettled and RoundCanceled
                    events.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-88 rounded-lg border border-white/8 bg-black/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Round</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Pool</TableHead>
                          <TableHead>Tx</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>#{item.roundId.toString()}</TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {item.kind === "settled"
                                  ? "Settled"
                                  : "Canceled"}
                              </div>
                              {item.kind === "settled" &&
                              item.winningSide !== undefined ? (
                                <div className="text-xs text-muted-foreground">
                                  Winner: {getSideLabel(item.winningSide)}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {item.totalPool !== undefined
                                ? `${formatGameTokenAmount(item.totalPool)} GAME`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <a
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                href={`${history.explorerBaseUrl}/tx/${item.txHash}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                View
                                <ExternalLinkIcon className="size-3" />
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                        {history.items.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground"
                            >
                              No settled/canceled events cached yet.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>{history.itemCountLabel}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void history.loadMore()}
                      disabled={!history.hasMore || history.isLoading}
                    >
                      {history.isLoading ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : null}
                      Load Older Window
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={history.refresh}
                    >
                      Reset Cache
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>
                    Pending, success, and error states are tracked in-app with
                    explorer links.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-88 rounded-lg border border-white/8 bg-black/10 p-3">
                    <div className="flex flex-col gap-2">
                      {recentTransactions.map((transaction) => (
                        <div
                          key={transaction.hash}
                          className="rounded-lg border border-white/8 bg-black/15 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {transaction.label}
                            </span>
                            <Badge
                              variant={
                                transaction.status === "success"
                                  ? "default"
                                  : transaction.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {transaction.status}
                            </Badge>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {formatRelativeTimestamp(transaction.submittedAt)}
                          </div>
                          {transaction.errorMessage ? (
                            <div className="mt-1 text-destructive">
                              {transaction.errorMessage}
                            </div>
                          ) : null}
                          <a
                            className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                            href={transaction.explorerUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Explorer
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        </div>
                      ))}
                      {recentTransactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No transactions submitted yet.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <AlertCircleIcon className="size-4" />
              <AlertTitle>History Limitations In v1</AlertTitle>
              <AlertDescription>
                History is read directly from chain logs in block windows and
                retained in browser memory only. For large-scale production
                history, migrate to an indexed backend/subgraph.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {globalStats ? (
          <Card>
            <CardHeader>
              <CardTitle>Global Stats</CardTitle>
              <CardDescription>
                Snapshot from getGlobalStats() for quick operational context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MiniStat
                  label="Active"
                  value={globalStats.activeRounds.toString()}
                />
                <MiniStat
                  label="Created"
                  value={globalStats.totalRoundsCreated.toString()}
                />
                <MiniStat
                  label="Settled"
                  value={globalStats.totalSettledRounds.toString()}
                />
                <MiniStat
                  label="Canceled"
                  value={globalStats.totalCanceledRounds.toString()}
                />
                <MiniStat
                  label="Volume"
                  value={`${formatGameTokenAmount(globalStats.totalVolumeStaked)} GAME`}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <Card className="border-white/5 bg-card/70 backdrop-blur-lg">
      <CardHeader className="pb-1">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/10 p-3">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}

export default App
