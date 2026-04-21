// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BlockchainGame is ERC20, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    uint256 public constant PLATFORM_FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    enum RoundStatus {
        DRAFT,
        OPEN,
        CLOSED,
        SETTLED,
        CANCELED
    }

    enum Side {
        SIDE_A,
        SIDE_B
    }

    struct Round {
        uint256 id;
        string title;
        string metadataURI;
        RoundStatus status;
        Side winningSide;
        uint64 createdAt;
        uint64 openedAt;
        uint64 closedAt;
        uint64 settledAt;
        uint64 canceledAt;
        uint256 totalPool;
        uint256 feeAmount;
        uint256 netPayoutPool;
    }

    struct Bet {
        uint256 amount;
        Side side;
        bool placed;
    }

    struct RoundView {
        uint256 id;
        string title;
        string metadataURI;
        RoundStatus status;
        Side winningSide;
        uint64 createdAt;
        uint64 openedAt;
        uint64 closedAt;
        uint64 settledAt;
        uint64 canceledAt;
        uint256 totalPool;
        uint256 feeAmount;
        uint256 netPayoutPool;
        uint256 sideATotal;
        uint256 sideBTotal;
        uint256 bettorCount;
    }

    struct GlobalStats {
        uint256 activeRounds;
        uint256 totalRoundsCreated;
        uint256 totalRoundsTracked;
        uint256 activeDraftRounds;
        uint256 activeOpenRounds;
        uint256 activeClosedRounds;
        uint256 totalSettledRounds;
        uint256 totalCanceledRounds;
        uint256 totalVolumeStaked;
        uint256 accruedFees;
    }

    error ZeroAddress();
    error ZeroAmount();
    error RoundNotFound(uint256 roundId);
    error InvalidRoundStatus(
        uint256 roundId,
        RoundStatus expectedStatus,
        RoundStatus currentStatus
    );
    error RoundAlreadyFinalized(uint256 roundId, RoundStatus currentStatus);
    error RoundHasBettors(uint256 roundId);
    error RoundHasNoBets(uint256 roundId);
    error BetAlreadyPlaced(uint256 roundId, address player);
    error BetBelowMinimum(uint256 amount, uint256 minBetAmount);
    error BetNotPlaced(uint256 roundId, address player);
    error AlreadyClaimed(uint256 roundId, address player);
    error NotWinningSide(uint256 roundId, address player);
    error InsufficientFeeBalance(uint256 requested, uint256 available);
    error InvalidPagination();

    event RoundCreated(
        uint256 indexed roundId,
        string title,
        string metadataURI
    );
    event RoundUpdated(
        uint256 indexed roundId,
        string title,
        string metadataURI
    );
    event RoundDeleted(uint256 indexed roundId);
    event RoundOpened(uint256 indexed roundId, uint64 openedAt);
    event BetPlaced(
        uint256 indexed roundId,
        address indexed player,
        Side side,
        uint256 amount
    );
    event RoundClosed(uint256 indexed roundId, uint64 closedAt);
    event RoundSettled(
        uint256 indexed roundId,
        Side winningSide,
        uint256 totalPool,
        uint256 feeAmount,
        uint256 netPayoutPool,
        uint256 randomness
    );
    event RoundCanceled(uint256 indexed roundId, uint64 canceledAt);
    event PayoutClaimed(
        uint256 indexed roundId,
        address indexed player,
        uint256 payoutAmount
    );
    event RefundClaimed(
        uint256 indexed roundId,
        address indexed player,
        uint256 refundAmount
    );
    event FeesWithdrawn(
        address indexed caller,
        address indexed recipient,
        uint256 amount
    );
    event TokensMinted(address indexed to, uint256 amount);
    event MinBetAmountUpdated(
        uint256 previousMinBetAmount,
        uint256 newMinBetAmount
    );

    uint256 public totalRoundsCreated;
    uint256 public totalRoundsTracked;
    uint256 public totalVolumeStaked;
    uint256 public accruedFees;
    uint256 public minBetAmount = 1e18;

    uint256 private _nextRoundId = 1;
    uint256[] private _roundIds;

    mapping(uint256 => uint256) private _roundIndexPlusOne;
    mapping(uint256 => Round) private _rounds;
    mapping(uint256 => mapping(address => Bet)) private _bets;
    mapping(uint256 => uint256[2]) private _totalStakeBySide;
    mapping(uint256 => uint256) private _bettorCount;
    mapping(uint256 => mapping(address => bool)) private _hasClaimed;
    uint256[5] private _statusCounts;

    constructor(
        address admin,
        address operator,
        address treasurer,
        uint256 initialMint
    ) ERC20("BlockchainGame", "GAME") {
        if (
            admin == address(0) ||
            operator == address(0) ||
            treasurer == address(0)
        ) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(TREASURER_ROLE, treasurer);

        if (initialMint > 0) {
            _mint(admin, initialMint);
            emit TokensMinted(admin, initialMint);
        }
    }

    /// @notice Mint GAME token for faucet/distribution in local testing.
    function mint(
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /// @notice Update the minimum allowed stake amount for future bets.
    function setMinBetAmount(
        uint256 newMinBetAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newMinBetAmount == 0) revert ZeroAmount();

        uint256 previousMinBetAmount = minBetAmount;
        minBetAmount = newMinBetAmount;

        emit MinBetAmountUpdated(previousMinBetAmount, newMinBetAmount);
    }

    /// @notice Create a betting round in DRAFT status.
    function createRound(
        string calldata title,
        string calldata metadataURI
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 roundId) {
        roundId = _nextRoundId;
        _nextRoundId += 1;

        Round storage round = _rounds[roundId];
        round.id = roundId;
        round.title = title;
        round.metadataURI = metadataURI;
        round.status = RoundStatus.DRAFT;
        round.createdAt = uint64(block.timestamp);

        _roundIds.push(roundId);
        _roundIndexPlusOne[roundId] = _roundIds.length;
        _statusCounts[uint256(RoundStatus.DRAFT)] += 1;
        totalRoundsCreated += 1;
        totalRoundsTracked += 1;

        emit RoundCreated(roundId, title, metadataURI);
    }

    /// @notice Update mutable round fields before OPEN.
    function updateRound(
        uint256 roundId,
        string calldata title,
        string calldata metadataURI
    ) external onlyRole(OPERATOR_ROLE) {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.DRAFT) {
            revert InvalidRoundStatus(roundId, RoundStatus.DRAFT, round.status);
        }

        round.title = title;
        round.metadataURI = metadataURI;

        emit RoundUpdated(roundId, title, metadataURI);
    }

    /// @notice Delete round storage physically while still DRAFT and bettor-free.
    function deleteRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.DRAFT) {
            revert InvalidRoundStatus(roundId, RoundStatus.DRAFT, round.status);
        }
        if (_bettorCount[roundId] != 0) revert RoundHasBettors(roundId);

        _statusCounts[uint256(RoundStatus.DRAFT)] -= 1;
        _removeRoundId(roundId);
        totalRoundsTracked -= 1;

        delete _rounds[roundId];
        delete _totalStakeBySide[roundId];
        delete _bettorCount[roundId];

        emit RoundDeleted(roundId);
    }

    /// @notice Move round from DRAFT to OPEN.
    function openRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.DRAFT) {
            revert InvalidRoundStatus(roundId, RoundStatus.DRAFT, round.status);
        }

        _transitionStatus(round, RoundStatus.OPEN);
        round.openedAt = uint64(block.timestamp);

        emit RoundOpened(roundId, round.openedAt);
    }

    /// @notice Place exactly one bet per user in a round.
    function placeBet(uint256 roundId, Side side, uint256 amount) external {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.OPEN) {
            revert InvalidRoundStatus(roundId, RoundStatus.OPEN, round.status);
        }
        if (amount == 0) revert ZeroAmount();
        if (amount < minBetAmount) revert BetBelowMinimum(amount, minBetAmount);

        Bet storage playerBet = _bets[roundId][msg.sender];
        if (playerBet.placed) revert BetAlreadyPlaced(roundId, msg.sender);

        playerBet.amount = amount;
        playerBet.side = side;
        playerBet.placed = true;

        uint256 sideIndex = uint256(side);
        _totalStakeBySide[roundId][sideIndex] += amount;
        _bettorCount[roundId] += 1;
        round.totalPool += amount;
        totalVolumeStaked += amount;

        _transfer(msg.sender, address(this), amount);

        emit BetPlaced(roundId, msg.sender, side, amount);
    }

    /// @notice Move round from OPEN to CLOSED.
    function closeRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.OPEN) {
            revert InvalidRoundStatus(roundId, RoundStatus.OPEN, round.status);
        }

        _transitionStatus(round, RoundStatus.CLOSED);
        round.closedAt = uint64(block.timestamp);

        emit RoundClosed(roundId, round.closedAt);
    }

    /// @notice Settle round with demo-level pseudo randomness (not for production use).
    function settleRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.CLOSED) {
            revert InvalidRoundStatus(
                roundId,
                RoundStatus.CLOSED,
                round.status
            );
        }
        if (round.totalPool == 0) revert RoundHasNoBets(roundId);

        uint256 randomness = _randomWord(roundId);
        Side winningSide = _resolveWinningSide(roundId, randomness);

        uint256 feeAmount = (round.totalPool * PLATFORM_FEE_BPS) /
            BPS_DENOMINATOR;
        uint256 netPayoutPool = round.totalPool - feeAmount;

        round.winningSide = winningSide;
        round.feeAmount = feeAmount;
        round.netPayoutPool = netPayoutPool;
        round.settledAt = uint64(block.timestamp);

        accruedFees += feeAmount;
        _transitionStatus(round, RoundStatus.SETTLED);
        _removeRoundId(roundId);

        emit RoundSettled(
            roundId,
            winningSide,
            round.totalPool,
            feeAmount,
            netPayoutPool,
            randomness
        );
    }

    /// @notice Cancel round while not settled; bettors can claim refund independently.
    function cancelRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage round = _getRound(roundId);
        if (
            round.status == RoundStatus.SETTLED ||
            round.status == RoundStatus.CANCELED
        ) {
            revert RoundAlreadyFinalized(roundId, round.status);
        }

        _transitionStatus(round, RoundStatus.CANCELED);
        round.canceledAt = uint64(block.timestamp);
        _removeRoundId(roundId);

        emit RoundCanceled(roundId, round.canceledAt);
    }

    /// @notice Claim winning payout using pull-payment.
    function claimPayout(
        uint256 roundId
    ) external returns (uint256 payoutAmount) {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.SETTLED) {
            revert InvalidRoundStatus(
                roundId,
                RoundStatus.SETTLED,
                round.status
            );
        }
        if (_hasClaimed[roundId][msg.sender])
            revert AlreadyClaimed(roundId, msg.sender);

        Bet storage playerBet = _bets[roundId][msg.sender];
        if (!playerBet.placed) revert BetNotPlaced(roundId, msg.sender);
        if (playerBet.side != round.winningSide)
            revert NotWinningSide(roundId, msg.sender);

        uint256 totalWinningStake = _totalStakeBySide[roundId][
            uint256(round.winningSide)
        ];
        payoutAmount =
            (round.netPayoutPool * playerBet.amount) /
            totalWinningStake;

        _hasClaimed[roundId][msg.sender] = true;
        _transfer(address(this), msg.sender, payoutAmount);

        emit PayoutClaimed(roundId, msg.sender, payoutAmount);
    }

    /// @notice Claim full refund on canceled round.
    function claimRefund(
        uint256 roundId
    ) external returns (uint256 refundAmount) {
        Round storage round = _getRound(roundId);
        if (round.status != RoundStatus.CANCELED) {
            revert InvalidRoundStatus(
                roundId,
                RoundStatus.CANCELED,
                round.status
            );
        }
        if (_hasClaimed[roundId][msg.sender])
            revert AlreadyClaimed(roundId, msg.sender);

        Bet storage playerBet = _bets[roundId][msg.sender];
        if (!playerBet.placed) revert BetNotPlaced(roundId, msg.sender);

        refundAmount = playerBet.amount;
        _hasClaimed[roundId][msg.sender] = true;
        _transfer(address(this), msg.sender, refundAmount);

        emit RefundClaimed(roundId, msg.sender, refundAmount);
    }

    /// @notice Withdraw accrued platform fees to a recipient.
    function withdrawFees(
        address recipient,
        uint256 amount
    ) external onlyRole(TREASURER_ROLE) {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = accruedFees;
        if (amount > available)
            revert InsufficientFeeBalance(amount, available);

        accruedFees = available - amount;
        _transfer(address(this), recipient, amount);

        emit FeesWithdrawn(msg.sender, recipient, amount);
    }

    /// @notice Return all active round IDs.
    function getRoundIds() external view returns (uint256[] memory) {
        return _roundIds;
    }

    /// @notice Return a paginated slice of active round IDs.
    function getRoundIdsSlice(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory ids) {
        uint256 total = _roundIds.length;
        if (offset > total) revert InvalidPagination();

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        ids = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            ids[i] = _roundIds[offset + i];
        }
    }

    /// @notice Return complete round snapshot for frontend/indexers.
    function getRound(
        uint256 roundId
    ) external view returns (RoundView memory roundView) {
        Round storage round = _getRound(roundId);

        roundView = RoundView({
            id: round.id,
            title: round.title,
            metadataURI: round.metadataURI,
            status: round.status,
            winningSide: round.winningSide,
            createdAt: round.createdAt,
            openedAt: round.openedAt,
            closedAt: round.closedAt,
            settledAt: round.settledAt,
            canceledAt: round.canceledAt,
            totalPool: round.totalPool,
            feeAmount: round.feeAmount,
            netPayoutPool: round.netPayoutPool,
            sideATotal: _totalStakeBySide[roundId][uint256(Side.SIDE_A)],
            sideBTotal: _totalStakeBySide[roundId][uint256(Side.SIDE_B)],
            bettorCount: _bettorCount[roundId]
        });
    }

    /// @notice Return stake totals for side A and side B.
    function getRoundStakeTotals(
        uint256 roundId
    ) external view returns (uint256 sideATotal, uint256 sideBTotal) {
        _ensureRoundExists(roundId);
        sideATotal = _totalStakeBySide[roundId][uint256(Side.SIDE_A)];
        sideBTotal = _totalStakeBySide[roundId][uint256(Side.SIDE_B)];
    }

    /// @notice Return a player's bet and claim status in a round.
    function getPlayerBet(
        uint256 roundId,
        address player
    )
        external
        view
        returns (uint256 amount, Side side, bool placed, bool claimed)
    {
        _ensureRoundExists(roundId);
        Bet storage playerBet = _bets[roundId][player];
        amount = playerBet.amount;
        side = playerBet.side;
        placed = playerBet.placed;
        claimed = _hasClaimed[roundId][player];
    }

    /// @notice Return compact global stats for dashboards.
    function getGlobalStats() external view returns (GlobalStats memory stats) {
        stats = GlobalStats({
            activeRounds: _roundIds.length,
            totalRoundsCreated: totalRoundsCreated,
            totalRoundsTracked: totalRoundsTracked,
            activeDraftRounds: _statusCounts[uint256(RoundStatus.DRAFT)],
            activeOpenRounds: _statusCounts[uint256(RoundStatus.OPEN)],
            activeClosedRounds: _statusCounts[uint256(RoundStatus.CLOSED)],
            totalSettledRounds: _statusCounts[uint256(RoundStatus.SETTLED)],
            totalCanceledRounds: _statusCounts[uint256(RoundStatus.CANCELED)],
            totalVolumeStaked: totalVolumeStaked,
            accruedFees: accruedFees
        });
    }

    function _getRound(
        uint256 roundId
    ) internal view returns (Round storage round) {
        round = _rounds[roundId];
        if (round.id == 0) revert RoundNotFound(roundId);
    }

    function _ensureRoundExists(uint256 roundId) internal view {
        if (_rounds[roundId].id == 0) revert RoundNotFound(roundId);
    }

    function _transitionStatus(
        Round storage round,
        RoundStatus newStatus
    ) internal {
        _statusCounts[uint256(round.status)] -= 1;
        _statusCounts[uint256(newStatus)] += 1;
        round.status = newStatus;
    }

    function _removeRoundId(uint256 roundId) internal {
        uint256 indexPlusOne = _roundIndexPlusOne[roundId];
        if (indexPlusOne == 0) revert RoundNotFound(roundId);

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _roundIds.length - 1;

        if (index != lastIndex) {
            uint256 movedRoundId = _roundIds[lastIndex];
            _roundIds[index] = movedRoundId;
            _roundIndexPlusOne[movedRoundId] = index + 1;
        }

        _roundIds.pop();
        delete _roundIndexPlusOne[roundId];
    }

    function _resolveWinningSide(
        uint256 roundId,
        uint256 randomness
    ) internal view returns (Side) {
        uint256 sideATotal = _totalStakeBySide[roundId][uint256(Side.SIDE_A)];
        uint256 sideBTotal = _totalStakeBySide[roundId][uint256(Side.SIDE_B)];

        if (sideATotal == 0) {
            return Side.SIDE_B;
        }
        if (sideBTotal == 0) {
            return Side.SIDE_A;
        }

        return randomness % 2 == 0 ? Side.SIDE_A : Side.SIDE_B;
    }

    function _randomWord(uint256 roundId) internal view returns (uint256) {
        // This randomness is intentionally demo-level and not safe for production.
        return
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        block.timestamp,
                        blockhash(block.number - 1),
                        roundId,
                        _rounds[roundId].totalPool
                    )
                )
            );
    }
}
