// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RewardDistributor
 * @notice Issues INCAM token rewards from the DAO treasury to users who complete quests.
 *
 * Idempotency guarantee:
 *   Every reward has a unique `rewardId` (keccak256 of userId + questId + dateBucket).
 *   Claiming the same rewardId twice is a no-op on the second call — it reverts.
 *   This means the off-chain service can safely retry failed transactions without
 *   any risk of double-awarding tokens.
 *
 * Append-only audit trail:
 *   Rewards are never deleted or modified retroactively. If a reward was issued
 *   incorrectly (e.g. Sybil detection after the fact), a Correction entry is
 *   appended to the corrections array. This gives a complete, immutable audit trail.
 */
contract RewardDistributor is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PAUSER_ROLE      = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE    = keccak256("UPGRADER_ROLE");

    IERC20 public platformToken;

    // Tracks which rewardIds have already been claimed.
    // Key: deterministic rewardId = keccak256(userId, questId, dateBucket)
    // Value: true = claimed, false = unclaimed
    mapping(bytes32 => bool) public claimed;

    /**
     * @dev Correction entries form the append-only audit trail.
     *      A correction is issued when a reward was given incorrectly (e.g. Sybil).
     *      The original reward is NOT deleted — corrections are additive entries only.
     */
    struct Correction {
        address user;
        bytes32 originalRewardId; // the reward being corrected
        int256  adjustment;       // positive = bonus top-up; negative = clawback notation
        string  reason;           // human-readable explanation for the audit trail
        uint256 timestamp;
    }

    // Append-only; never delete or modify entries
    Correction[] public corrections;

    event RewardClaimed(bytes32 indexed rewardId, address indexed user, uint256 amount);
    event CorrectionIssued(uint256 indexed correctionId, address indexed user, bytes32 originalRewardId, int256 adjustment, string reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /**
     * @param defaultAdmin  Multisig — holds admin and upgrader roles
     * @param distributor   Off-chain reward service wallet — issues claims
     * @param _platformToken  INCAM token contract address
     */
    function initialize(
        address defaultAdmin,
        address distributor,
        address _platformToken
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(DISTRIBUTOR_ROLE,   distributor);
        _grantRole(PAUSER_ROLE,        defaultAdmin);
        _grantRole(UPGRADER_ROLE,      defaultAdmin);

        platformToken = IERC20(_platformToken);
    }

    /**
     * @notice Issue a token reward to a user. Idempotent — safe to call multiple times.
     *
     *         The rewardId is generated deterministically off-chain:
     *         `rewardId = keccak256(abi.encodePacked(userId, questId, dateBucket))`
     *
     *         If the rewardId has already been claimed, this call reverts.
     *         The off-chain service should treat this revert as a success (already done).
     *
     * @param rewardId  Unique identifier for this reward event
     * @param user      Wallet address to receive the tokens
     * @param amount    Number of tokens in wei (18 decimals)
     */
    function claimReward(
        bytes32 rewardId,
        address user,
        uint256 amount
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused {
        // Idempotency check — reverts on duplicate claim
        require(!claimed[rewardId], "RewardDistributor: already claimed");
        require(user != address(0), "RewardDistributor: zero address");
        require(amount > 0,         "RewardDistributor: zero amount");

        // Mark as claimed BEFORE the external call (checks-effects-interactions)
        claimed[rewardId] = true;

        // Transfer tokens from this contract's treasury balance to the user
        platformToken.safeTransfer(user, amount);

        emit RewardClaimed(rewardId, user, amount);
    }

    /**
     * @notice Batch version of claimReward — processes multiple rewards in one tx.
     *         Used for weekly leaderboard payouts where many users are rewarded at once.
     *
     *         Idempotency: already-claimed entries are silently skipped (not reverted).
     *         This means a partially-failed batch can be retried safely.
     *
     * @param rewardIds  Array of unique reward identifiers
     * @param users      Corresponding recipient addresses
     * @param amounts    Corresponding token amounts
     */
    function batchClaimRewards(
        bytes32[] calldata rewardIds,
        address[]  calldata users,
        uint256[]  calldata amounts
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused {
        require(
            rewardIds.length == users.length && users.length == amounts.length,
            "RewardDistributor: array mismatch"
        );

        for (uint256 i = 0; i < rewardIds.length; i++) {
            // Skip already-claimed entries — do not revert the whole batch
            if (claimed[rewardIds[i]]) continue;
            require(users[i] != address(0) && amounts[i] > 0, "RewardDistributor: invalid entry");

            claimed[rewardIds[i]] = true;
            platformToken.safeTransfer(users[i], amounts[i]);
            emit RewardClaimed(rewardIds[i], users[i], amounts[i]);
        }
    }

    /**
     * @notice Append a correction entry to the audit trail.
     *         Corrections are NEVER retroactive modifications — they are new entries.
     *         A clawback is represented as a new correctionRewardId with a negative adjustment note.
     *         If an additional token payment is needed (e.g. top-up for a previously under-paid reward),
     *         pass the amount in `tokenAmount`; otherwise pass 0.
     *
     * @param user                 The affected user's wallet
     * @param originalRewardId     The rewardId being corrected
     * @param adjustment           Signed int for audit notation (negative = clawback, positive = bonus)
     * @param reason               Human-readable explanation (stored on-chain permanently)
     * @param correctionRewardId   A new unique rewardId for this correction entry
     * @param tokenAmount          Additional tokens to send (0 if this is a notation-only correction)
     */
    function issueCorrection(
        address user,
        bytes32 originalRewardId,
        int256  adjustment,
        string calldata reason,
        bytes32 correctionRewardId,
        uint256 tokenAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused {
        // Correction itself is also idempotent — cannot issue the same correction twice
        require(!claimed[correctionRewardId], "RewardDistributor: correction already issued");
        claimed[correctionRewardId] = true;

        // Append to the immutable audit trail — never delete this entry
        corrections.push(Correction({
            user:             user,
            originalRewardId: originalRewardId,
            adjustment:       adjustment,
            reason:           reason,
            timestamp:        block.timestamp
        }));

        // If a compensatory payment is needed alongside the correction note, issue it
        if (tokenAmount > 0) {
            platformToken.safeTransfer(user, tokenAmount);
            emit RewardClaimed(correctionRewardId, user, tokenAmount);
        }

        emit CorrectionIssued(corrections.length - 1, user, originalRewardId, adjustment, reason);
    }

    /**
     * @notice Allow the admin to move treasury tokens out (e.g. to fund a new distributor contract).
     *         Requires the multisig — not callable by the distributor service wallet.
     */
    function withdrawTreasury(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        platformToken.safeTransfer(to, amount);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause();   }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
