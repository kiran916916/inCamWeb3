// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Escrow — Holds funds during auctions and fixed-price trades
/// @notice Atomic: either both NFT transfer and payment happen, or neither
contract Escrow is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct EscrowEntry {
        address depositor;
        address paymentToken; // address(0) = native token
        uint256 amount;
        bool released;
        bool refunded;
    }

    mapping(bytes32 => EscrowEntry) public escrows;

    event EscrowDeposited(bytes32 indexed escrowId, address indexed depositor, address token, uint256 amount);
    event EscrowReleased(bytes32 indexed escrowId, address indexed recipient, uint256 amount);
    event EscrowRefunded(bytes32 indexed escrowId, address indexed depositor, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address defaultAdmin, address operator) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
    }

    function depositERC20(
        bytes32 escrowId,
        address depositor,
        address token,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        require(escrows[escrowId].depositor == address(0), "Escrow: ID already used");
        require(amount > 0, "Escrow: zero amount");

        IERC20(token).safeTransferFrom(depositor, address(this), amount);

        escrows[escrowId] = EscrowEntry({
            depositor: depositor,
            paymentToken: token,
            amount: amount,
            released: false,
            refunded: false
        });

        emit EscrowDeposited(escrowId, depositor, token, amount);
    }

    function release(bytes32 escrowId, address recipient) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        EscrowEntry storage entry = escrows[escrowId];
        require(entry.depositor != address(0), "Escrow: not found");
        require(!entry.released && !entry.refunded, "Escrow: already settled");

        entry.released = true;
        IERC20(entry.paymentToken).safeTransfer(recipient, entry.amount);

        emit EscrowReleased(escrowId, recipient, entry.amount);
    }

    function refund(bytes32 escrowId) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        EscrowEntry storage entry = escrows[escrowId];
        require(entry.depositor != address(0), "Escrow: not found");
        require(!entry.released && !entry.refunded, "Escrow: already settled");

        entry.refunded = true;
        IERC20(entry.paymentToken).safeTransfer(entry.depositor, entry.amount);

        emit EscrowRefunded(escrowId, entry.depositor, entry.amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
