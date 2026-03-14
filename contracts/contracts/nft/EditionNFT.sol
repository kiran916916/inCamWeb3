// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title EditionNFT — ERC-1155 limited-run collectible drops
contract EditionNFT is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 private _nextEditionId;

    struct Edition {
        address creator;
        uint256 maxSupply;  // 0 = unlimited
        uint256 mintPrice;  // in platform token (0 = free)
        uint96 royaltyBps;
        string metadataUri;
        bool active;
    }

    mapping(uint256 => Edition) public editions;
    mapping(uint256 => mapping(address => uint256)) public mintedPerWallet;

    event EditionCreated(uint256 indexed editionId, address indexed creator, uint256 maxSupply, uint256 mintPrice);
    event EditionMinted(uint256 indexed editionId, address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address defaultAdmin, address minter) public initializer {
        __ERC1155_init("");
        __ERC1155Supply_init();
        __ERC2981_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
    }

    function createEdition(
        address creator,
        uint256 maxSupply,
        uint256 mintPrice,
        uint96 royaltyBps,
        string calldata metadataUri
    ) external onlyRole(MINTER_ROLE) returns (uint256 editionId) {
        require(royaltyBps <= 1000, "EditionNFT: max royalty 10%");
        editionId = _nextEditionId++;

        editions[editionId] = Edition({
            creator: creator,
            maxSupply: maxSupply,
            mintPrice: mintPrice,
            royaltyBps: royaltyBps,
            metadataUri: metadataUri,
            active: true
        });

        _setTokenRoyalty(editionId, creator, royaltyBps);
        emit EditionCreated(editionId, creator, maxSupply, mintPrice);
    }

    function mint(
        address to,
        uint256 editionId,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) nonReentrant {
        Edition storage edition = editions[editionId];
        require(edition.active, "EditionNFT: edition inactive");
        require(
            edition.maxSupply == 0 || totalSupply(editionId) + amount <= edition.maxSupply,
            "EditionNFT: exceeds max supply"
        );

        _mint(to, editionId, amount, "");
        mintedPerWallet[editionId][to] += amount;
        emit EditionMinted(editionId, to, amount);
    }

    function uri(uint256 editionId) public view override returns (string memory) {
        return editions[editionId].metadataUri;
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155Upgradeable, ERC1155SupplyUpgradeable)
        whenNotPaused
    {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
