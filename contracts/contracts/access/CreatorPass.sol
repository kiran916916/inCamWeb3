// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CreatorPass — ERC-721 subscription access key to all premium content from a creator
contract CreatorPass is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IERC20 public paymentToken;
    uint256 private _nextTokenId;

    struct PassTier {
        address creator;
        uint256 monthlyPrice;   // in platform tokens
        uint256 maxSupply;      // 0 = unlimited
        bool active;
        string metadataUri;
    }

    mapping(uint256 => PassTier) public passTiers;    // tierId -> PassTier
    mapping(uint256 => uint256) public passToTier;    // tokenId -> tierId
    mapping(uint256 => uint256) public passExpiry;    // tokenId -> expiry timestamp
    uint256 private _nextTierId;

    event PassTierCreated(uint256 indexed tierId, address indexed creator, uint256 monthlyPrice);
    event PassMinted(uint256 indexed tokenId, uint256 indexed tierId, address indexed to, uint256 expiry);
    event PassRenewed(uint256 indexed tokenId, uint256 newExpiry);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        string memory name,
        string memory symbol,
        address defaultAdmin,
        address minter,
        address _paymentToken
    ) public initializer {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERC2981_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);

        paymentToken = IERC20(_paymentToken);
    }

    function createPassTier(
        address creator,
        uint256 monthlyPrice,
        uint256 maxSupply,
        string calldata metadataUri,
        uint96 royaltyBps
    ) external onlyRole(MINTER_ROLE) returns (uint256 tierId) {
        tierId = _nextTierId++;
        passTiers[tierId] = PassTier({
            creator: creator,
            monthlyPrice: monthlyPrice,
            maxSupply: maxSupply,
            active: true,
            metadataUri: metadataUri
        });

        emit PassTierCreated(tierId, creator, monthlyPrice);
    }

    function mintPass(address to, uint256 tierId, uint256 months) external nonReentrant whenNotPaused returns (uint256 tokenId) {
        PassTier storage tier = passTiers[tierId];
        require(tier.active, "CreatorPass: tier inactive");
        require(months > 0 && months <= 12, "CreatorPass: invalid months");
        require(
            tier.maxSupply == 0 || totalSupply() < tier.maxSupply,
            "CreatorPass: sold out"
        );

        uint256 totalCost = tier.monthlyPrice * months;
        paymentToken.safeTransferFrom(msg.sender, tier.creator, totalCost);

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        passToTier[tokenId] = tierId;
        passExpiry[tokenId] = block.timestamp + (months * 30 days);

        emit PassMinted(tokenId, tierId, to, passExpiry[tokenId]);
    }

    function renewPass(uint256 tokenId, uint256 months) external nonReentrant whenNotPaused {
        require(_ownerOf(tokenId) != address(0), "CreatorPass: nonexistent token");
        uint256 tierId = passToTier[tokenId];
        PassTier storage tier = passTiers[tierId];
        require(tier.active, "CreatorPass: tier inactive");
        require(months > 0 && months <= 12, "CreatorPass: invalid months");

        uint256 totalCost = tier.monthlyPrice * months;
        paymentToken.safeTransferFrom(msg.sender, tier.creator, totalCost);

        uint256 baseExpiry = passExpiry[tokenId] > block.timestamp ? passExpiry[tokenId] : block.timestamp;
        passExpiry[tokenId] = baseExpiry + (months * 30 days);

        emit PassRenewed(tokenId, passExpiry[tokenId]);
    }

    function isActivePass(uint256 tokenId) external view returns (bool) {
        return passExpiry[tokenId] > block.timestamp;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721Upgradeable) returns (string memory) {
        uint256 tierId = passToTier[tokenId];
        return passTiers[tierId].metadataUri;
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        whenNotPaused
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
