// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/// @title Marketplace — Fixed-price and auction NFT exchange with royalty enforcement
/// @notice Atomic swaps, commit-reveal auctions, 2.5% protocol fee, ERC-2981 royalties
contract Marketplace is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    uint256 public constant MAX_PROTOCOL_FEE_BPS = 500; // 5% max
    uint256 public protocolFeeBps; // default 250 = 2.5%
    address public feeRecipient;
    address public paymentToken; // platform ERC-20 token

    enum ListingType { FIXED, AUCTION }
    enum NFTStandard { ERC721, ERC1155 }

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 amount;         // 1 for ERC-721, variable for ERC-1155
        uint256 price;          // fixed price or reserve price for auction
        address paymentToken;
        ListingType listingType;
        NFTStandard nftStandard;
        bool active;
        uint256 auctionEnd;     // 0 for fixed listings
    }

    // Commit-reveal auction bids
    struct BidCommit {
        bytes32 commitment;     // keccak256(abi.encodePacked(amount, salt))
        bool revealed;
        uint256 revealedAmount;
        address bidder;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => BidCommit[]) public auctionBids;
    mapping(uint256 => uint256) public highestBid;
    mapping(uint256 => address) public highestBidder;

    uint256 private _nextListingId;

    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 price, ListingType listingType);
    event Sale(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 royaltyPaid, uint256 platformFee);
    event BidCommitted(uint256 indexed listingId, address indexed bidder, bytes32 commitment);
    event BidRevealed(uint256 indexed listingId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed listingId, address indexed winner, uint256 amount);
    event ListingCancelled(uint256 indexed listingId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address defaultAdmin,
        address _feeRecipient,
        address _paymentToken,
        uint256 _protocolFeeBps
    ) public initializer {
        require(_protocolFeeBps <= MAX_PROTOCOL_FEE_BPS, "Marketplace: fee too high");
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
        _grantRole(FEE_MANAGER_ROLE, defaultAdmin);

        feeRecipient = _feeRecipient;
        paymentToken = _paymentToken;
        protocolFeeBps = _protocolFeeBps;
    }

    // ─────────────────────────────────────────────
    // Fixed-price listing
    // ─────────────────────────────────────────────

    function listFixed(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        NFTStandard standard
    ) external whenNotPaused returns (uint256 listingId) {
        require(price > 0, "Marketplace: price must be > 0");
        _escrowNFT(msg.sender, nftContract, tokenId, amount, standard);

        listingId = _nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            amount: amount,
            price: price,
            paymentToken: paymentToken,
            listingType: ListingType.FIXED,
            nftStandard: standard,
            active: true,
            auctionEnd: 0
        });

        emit Listed(listingId, msg.sender, nftContract, tokenId, price, ListingType.FIXED);
    }

    function buyFixed(uint256 listingId) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        require(listing.listingType == ListingType.FIXED, "Marketplace: not fixed listing");
        require(msg.sender != listing.seller, "Marketplace: seller cannot buy");

        listing.active = false;

        _settlePayment(listingId, msg.sender, listing.seller, listing.price);
        _releaseNFT(listing.seller, msg.sender, listing.nftContract, listing.tokenId, listing.amount, listing.nftStandard);
    }

    // ─────────────────────────────────────────────
    // Commit-reveal auction
    // ─────────────────────────────────────────────

    function listAuction(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 reservePrice,
        uint256 duration,
        NFTStandard standard
    ) external whenNotPaused returns (uint256 listingId) {
        require(duration >= 1 hours && duration <= 7 days, "Marketplace: invalid auction duration");
        _escrowNFT(msg.sender, nftContract, tokenId, amount, standard);

        listingId = _nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            amount: amount,
            price: reservePrice,
            paymentToken: paymentToken,
            listingType: ListingType.AUCTION,
            nftStandard: standard,
            active: true,
            auctionEnd: block.timestamp + duration
        });

        emit Listed(listingId, msg.sender, nftContract, tokenId, reservePrice, ListingType.AUCTION);
    }

    function commitBid(uint256 listingId, bytes32 commitment) external whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active && listing.listingType == ListingType.AUCTION, "Marketplace: not active auction");
        require(block.timestamp < listing.auctionEnd, "Marketplace: auction ended");

        auctionBids[listingId].push(BidCommit({
            commitment: commitment,
            revealed: false,
            revealedAmount: 0,
            bidder: msg.sender
        }));

        emit BidCommitted(listingId, msg.sender, commitment);
    }

    function revealBid(uint256 listingId, uint256 bidIndex, uint256 amount, bytes32 salt) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        // Allow reveal in a 24h window after auction end
        require(block.timestamp >= listing.auctionEnd, "Marketplace: reveal phase not started");
        require(block.timestamp <= listing.auctionEnd + 1 days, "Marketplace: reveal phase ended");

        BidCommit storage bid = auctionBids[listingId][bidIndex];
        require(bid.bidder == msg.sender, "Marketplace: not your bid");
        require(!bid.revealed, "Marketplace: already revealed");
        require(keccak256(abi.encodePacked(amount, salt)) == bid.commitment, "Marketplace: commitment mismatch");

        bid.revealed = true;
        bid.revealedAmount = amount;

        if (amount > highestBid[listingId]) {
            highestBid[listingId] = amount;
            highestBidder[listingId] = msg.sender;
        }

        // Escrow the bid payment
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);

        emit BidRevealed(listingId, msg.sender, amount);
    }

    function settleAuction(uint256 listingId) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active && listing.listingType == ListingType.AUCTION, "Marketplace: not active auction");
        require(block.timestamp > listing.auctionEnd + 1 days, "Marketplace: reveal phase not complete");

        listing.active = false;
        address winner = highestBidder[listingId];
        uint256 winAmount = highestBid[listingId];

        require(winAmount >= listing.price, "Marketplace: reserve not met");

        // Refund losing bidders
        for (uint256 i = 0; i < auctionBids[listingId].length; i++) {
            BidCommit storage bid = auctionBids[listingId][i];
            if (bid.revealed && bid.bidder != winner) {
                IERC20(paymentToken).safeTransfer(bid.bidder, bid.revealedAmount);
            }
        }

        _settlePaymentDirect(listingId, winner, listing.seller, winAmount);
        _releaseNFT(listing.seller, winner, listing.nftContract, listing.tokenId, listing.amount, listing.nftStandard);

        emit AuctionSettled(listingId, winner, winAmount);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Marketplace: not authorized");
        require(listing.active, "Marketplace: not active");
        require(listing.listingType == ListingType.FIXED || block.timestamp < listing.auctionEnd, "Marketplace: auction in progress");

        listing.active = false;
        _releaseNFT(address(this), listing.seller, listing.nftContract, listing.tokenId, listing.amount, listing.nftStandard);

        emit ListingCancelled(listingId);
    }

    // ─────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────

    function _settlePayment(uint256 listingId, address buyer, address seller, uint256 price) internal {
        IERC20(paymentToken).safeTransferFrom(buyer, address(this), price);
        _distributePayment(listingId, seller, price);
    }

    function _settlePaymentDirect(uint256 listingId, address buyer, address seller, uint256 price) internal {
        // Payment already in contract (from reveal phase escrow)
        _distributePayment(listingId, seller, price);
        (void) buyer; // suppress unused warning
    }

    function _distributePayment(uint256 listingId, address seller, uint256 price) internal {
        Listing storage listing = listings[listingId];
        uint256 protocolFee = (price * protocolFeeBps) / 10_000;
        uint256 royaltyAmount = 0;
        address royaltyRecipient;

        // Check ERC-2981 royalty
        if (IERC165(listing.nftContract).supportsInterface(type(IERC2981).interfaceId)) {
            (royaltyRecipient, royaltyAmount) = IERC2981(listing.nftContract).royaltyInfo(listing.tokenId, price);
        }

        uint256 sellerProceeds = price - protocolFee - royaltyAmount;

        if (protocolFee > 0) IERC20(paymentToken).safeTransfer(feeRecipient, protocolFee);
        if (royaltyAmount > 0) IERC20(paymentToken).safeTransfer(royaltyRecipient, royaltyAmount);
        IERC20(paymentToken).safeTransfer(seller, sellerProceeds);

        emit Sale(listingId, address(0), seller, price, royaltyAmount, protocolFee);
    }

    function _escrowNFT(address from, address nftContract, uint256 tokenId, uint256 amount, NFTStandard standard) internal {
        if (standard == NFTStandard.ERC721) {
            IERC721(nftContract).transferFrom(from, address(this), tokenId);
        } else {
            IERC1155(nftContract).safeTransferFrom(from, address(this), tokenId, amount, "");
        }
    }

    function _releaseNFT(address from, address to, address nftContract, uint256 tokenId, uint256 amount, NFTStandard standard) internal {
        if (standard == NFTStandard.ERC721) {
            IERC721(nftContract).transferFrom(from, to, tokenId);
        } else {
            IERC1155(nftContract).safeTransferFrom(from, to, tokenId, amount, "");
        }
    }

    function setProtocolFee(uint256 newFeeBps) external onlyRole(FEE_MANAGER_ROLE) {
        require(newFeeBps <= MAX_PROTOCOL_FEE_BPS, "Marketplace: fee too high");
        protocolFeeBps = newFeeBps;
    }

    function setFeeRecipient(address newRecipient) external onlyRole(FEE_MANAGER_ROLE) {
        require(newRecipient != address(0), "Marketplace: zero address");
        feeRecipient = newRecipient;
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
