// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title RewardDistributor — Manages idempotent token reward claims from the DAO treasury
/// @notice All reward issuance is idempotent — retrying a claim never double-awards
contract RewardDistributor is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IERC20 public platformToken;

    // Idempotency: track claimed rewards by (user, rewardId)
    // rewardId is a unique identifier generated off-chain per reward event
    mapping(bytes32 => bool) public claimed;

    // Correction entries for audit trail (rewards are append-only)
    struct Correction {
        address user;
        bytes32 originalRewardId;
        int256 adjustment; // positive = bonus, negative = clawback
        string reason;
        uint256 timestamp;
    }
    Correction[] public corrections;

    event RewardClaimed(bytes32 indexed rewardId, address indexed user, uint256 amount);
    event CorrectionIssued(uint256 indexed correctionId, address indexed user, bytes32 originalRewardId, int256 adjustment, string reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

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
        _grantRole(DISTRIBUTOR_ROLE, distributor);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);

        platformToken = IERC20(_platformToken);
    }

    /// @notice Idempotently claim a reward. Noop if already claimed.
    /// @param rewardId Unique ID for this reward event (generated off-chain, keyed on user+quest+date)
    /// @param user Recipient wallet
    /// @param amount Token amount (18 decimals)
    function claimReward(
        bytes32 rewardId,
        address user,
        uint256 amount
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused {
        require(!claimed[rewardId], "RewardDistributor: already claimed");
        require(user != address(0), "RewardDistributor: zero address");
        require(amount > 0, "RewardDistributor: zero amount");

        claimed[rewardId] = true;
        platformToken.safeTransfer(user, amount);

        emit RewardClaimed(rewardId, user, amount);
    }

    /// @notice Batch claim for gas efficiency (leaderboard settlements)
    function batchClaimRewards(
        bytes32[] calldata rewardIds,
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused {
        require(rewardIds.length == users.length && users.length == amounts.length, "RewardDistributor: array mismatch");

        for (uint256 i = 0; i < rewardIds.length; i++) {
            if (claimed[rewardIds[i]]) continue; // skip already claimed (idempotent)
            require(users[i] != address(0) && amounts[i] > 0, "RewardDistributor: invalid entry");

            claimed[rewardIds[i]] = true;
            platformToken.safeTransfer(users[i], amounts[i]);
            emit RewardClaimed(rewardIds[i], users[i], amounts[i]);
        }
    }

    /// @notice Issue a correction entry (append-only audit trail, rewards never deleted)
    function issueCorrection(
        address user,
        bytes32 originalRewardId,
        int256 adjustment,
        string calldata reason,
        bytes32 correctionRewardId,
        uint256 tokenAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused {
        require(!claimed[correctionRewardId], "RewardDistributor: correction already issued");
        claimed[correctionRewardId] = true;

        corrections.push(Correction({
            user: user,
            originalRewardId: originalRewardId,
            adjustment: adjustment,
            reason: reason,
            timestamp: block.timestamp
        }));

        if (tokenAmount > 0) {
            platformToken.safeTransfer(user, tokenAmount);
            emit RewardClaimed(correctionRewardId, user, tokenAmount);
        }

        emit CorrectionIssued(corrections.length - 1, user, originalRewardId, adjustment, reason);
    }

    function withdrawTreasury(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        platformToken.safeTransfer(to, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
