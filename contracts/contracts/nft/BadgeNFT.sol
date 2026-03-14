// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title BadgeNFT — Soulbound ERC-1155 achievement badges for the reward system
/// @notice Soulbound: transfers are disabled. Badges are wallet-bound achievements.
contract BadgeNFT is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct Badge {
        string name;
        string description;
        string metadataUri;
        bool exists;
    }

    mapping(uint256 => Badge) public badges;
    // Track if a wallet already has a specific badge (prevent duplicates)
    mapping(address => mapping(uint256 => bool)) public hasBadge;

    event BadgeDefined(uint256 indexed badgeId, string name);
    event BadgeAwarded(uint256 indexed badgeId, address indexed recipient);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address defaultAdmin, address minter) public initializer {
        __ERC1155_init("");
        __ERC1155Supply_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
    }

    function defineBadge(
        uint256 badgeId,
        string calldata name,
        string calldata description,
        string calldata metadataUri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!badges[badgeId].exists, "BadgeNFT: badge already defined");
        badges[badgeId] = Badge({ name: name, description: description, metadataUri: metadataUri, exists: true });
        emit BadgeDefined(badgeId, name);
    }

    function awardBadge(address recipient, uint256 badgeId) external onlyRole(MINTER_ROLE) nonReentrant {
        require(badges[badgeId].exists, "BadgeNFT: badge not defined");
        require(!hasBadge[recipient][badgeId], "BadgeNFT: already awarded");

        hasBadge[recipient][badgeId] = true;
        _mint(recipient, badgeId, 1, "");
        emit BadgeAwarded(badgeId, recipient);
    }

    function uri(uint256 badgeId) public view override returns (string memory) {
        return badges[badgeId].metadataUri;
    }

    /// @notice Soulbound: block all transfers
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155Upgradeable, ERC1155SupplyUpgradeable)
    {
        // Allow minting (from == address(0)) but block all other transfers
        require(from == address(0), "BadgeNFT: soulbound, non-transferable");
        super._update(from, to, ids, values);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
