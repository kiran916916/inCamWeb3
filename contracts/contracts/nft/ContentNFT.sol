// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title ContentNFT — ERC-721 tokens representing individual creator content pieces
/// @notice Implements ERC-2981 on-chain royalties, pausable, role-based access
contract ContentNFT is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 private _nextTokenId;

    struct ContentMetadata {
        address creator;
        uint8 tier; // 0 = freemium, 1 = premium
        uint8 contentType; // 0 = video, 1 = image, 2 = audio, 3 = text
        uint96 royaltyBps; // basis points (200–1000)
        uint256 mintedAt;
    }

    mapping(uint256 => ContentMetadata) public contentMetadata;

    event ContentMinted(
        uint256 indexed tokenId,
        address indexed creator,
        string metadataUri,
        uint8 tier,
        uint96 royaltyBps
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        address defaultAdmin,
        address minter
    ) public initializer {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
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

    /// @notice Mint a new Content NFT
    /// @param to Recipient address (usually the creator)
    /// @param metadataUri IPFS URI of the NFT metadata
    /// @param creator Creator's address for royalty purposes
    /// @param tier 0 = freemium, 1 = premium
    /// @param contentType 0=video,1=image,2=audio,3=text
    /// @param royaltyBps Royalty in basis points (200–1000)
    function mintContent(
        address to,
        string calldata metadataUri,
        address creator,
        uint8 tier,
        uint8 contentType,
        uint96 royaltyBps
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256) {
        require(royaltyBps >= 200 && royaltyBps <= 1000, "ContentNFT: royalty must be 2-10%");
        require(creator != address(0), "ContentNFT: invalid creator");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataUri);
        _setTokenRoyalty(tokenId, creator, royaltyBps);

        contentMetadata[tokenId] = ContentMetadata({
            creator: creator,
            tier: tier,
            contentType: contentType,
            royaltyBps: royaltyBps,
            mintedAt: block.timestamp
        });

        emit ContentMinted(tokenId, creator, metadataUri, tier, royaltyBps);
        return tokenId;
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // Required overrides
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

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
