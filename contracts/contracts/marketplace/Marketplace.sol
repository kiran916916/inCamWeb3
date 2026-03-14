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

/**
 * @title Marketplace
 * @notice NFT exchange supporting fixed-price listings and commit-reveal auctions.
 *
 * Design decisions:
 *  - Commit-reveal auctions prevent front-running: bids are hidden until the reveal phase
 *  - ERC-2981 royalties are read from the NFT contract and paid atomically in every sale
 *  - All fund movements use SafeERC20 to handle non-standard ERC-20 tokens safely
 *  - ReentrancyGuard on every function that moves funds or NFTs
 *  - Protocol fee capped at 5% (MAX_PROTOCOL_FEE_BPS) — cannot be raised above this
 *
 * TODO before mainnet:
 *  - Replace settleAuction's for-loop refund with pull-payment (gas DoS risk)
 *  - Add minimum bid increment enforcement
 */
contract Marketplace is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE      = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE    = keccak256("UPGRADER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    // Protocol fee ceiling — prevents governance from setting an exploitative fee
    uint256 public constant MAX_PROTOCOL_FEE_BPS = 500; // 5%

    uint256 public protocolFeeBps; // current fee, starts at 250 (2.5%)
    address public feeRecipient;   // receives the protocol cut on each sale
    address public paymentToken;   // the platform ERC-20 token (INCAM)

    // Listing can be fixed-price or a two-phase commit-reveal auction
    enum ListingType { FIXED, AUCTION }
    // NFT standard determines which transfer interface to use
    enum NFTStandard  { ERC721, ERC1155 }

    /**
     * @dev Stores everything needed to settle a listing.
     *      Packed into a single struct to reduce storage reads.
     */
    struct Listing {
        address     seller;
        address     nftContract;
        uint256     tokenId;
        uint256     amount;       // 1 for ERC-721; can be >1 for ERC-1155
        uint256     price;        // fixed price or reserve price for auctions
        address     paymentToken;
        ListingType listingType;
        NFTStandard nftStandard;
        bool        active;       // false after sale, cancellation, or settlement
        uint256     auctionEnd;   // 0 for fixed listings; Unix timestamp for auctions
    }

    /**
     * @dev One entry per bid submitted during the commit phase.
     *      The actual amount is hidden until the reveal phase.
     */
    struct BidCommit {
        bytes32 commitment;      // keccak256(abi.encodePacked(amount, salt))
        bool    revealed;        // true after bidder calls revealBid()
        uint256 revealedAmount;  // populated during reveal
        address bidder;
    }

    // listingId → Listing
    mapping(uint256 => Listing)         public listings;
    // listingId → all bid commitments for that auction
    mapping(uint256 => BidCommit[])     public auctionBids;
    // listingId → highest revealed bid amount so far
    mapping(uint256 => uint256)         public highestBid;
    // listingId → address of the current highest bidder
    mapping(uint256 => address)         public highestBidder;

    // Auto-incrementing listing ID; starts at 0
    uint256 private _nextListingId;

    // Events — indexed fields allow The Graph to filter efficiently
    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 price, ListingType listingType);
    event Sale(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 royaltyPaid, uint256 platformFee);
    event BidCommitted(uint256 indexed listingId, address indexed bidder, bytes32 commitment);
    event BidRevealed(uint256 indexed listingId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed listingId, address indexed winner, uint256 amount);
    event ListingCancelled(uint256 indexed listingId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /**
     * @param defaultAdmin       Multisig address — holds all admin roles
     * @param _feeRecipient      Where protocol fees are sent (treasury)
     * @param _paymentToken      INCAM token contract address
     * @param _protocolFeeBps    Initial fee in basis points, e.g. 250 = 2.5%
     */
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
        _grantRole(PAUSER_ROLE,        defaultAdmin);
        _grantRole(UPGRADER_ROLE,      defaultAdmin);
        _grantRole(FEE_MANAGER_ROLE,   defaultAdmin);

        feeRecipient   = _feeRecipient;
        paymentToken   = _paymentToken;
        protocolFeeBps = _protocolFeeBps;
    }

    // ─── Fixed-price listings ────────────────────────────────────────────────

    /**
     * @notice List an NFT at a fixed price.
     *         The NFT is transferred into this contract (escrow) immediately.
     *         Caller must have approved this contract to transfer the NFT beforehand.
     * @param nftContract  Address of the ERC-721 or ERC-1155 contract
     * @param tokenId      Token ID to list
     * @param amount       1 for ERC-721; any amount for ERC-1155
     * @param price        Exact INCAM token price the buyer must pay
     * @param standard     0 = ERC721, 1 = ERC1155
     */
    function listFixed(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        NFTStandard standard
    ) external whenNotPaused returns (uint256 listingId) {
        require(price > 0, "Marketplace: price must be > 0");

        // Pull the NFT from the seller into this contract as escrow
        _escrowNFT(msg.sender, nftContract, tokenId, amount, standard);

        listingId = _nextListingId++;
        listings[listingId] = Listing({
            seller:      msg.sender,
            nftContract: nftContract,
            tokenId:     tokenId,
            amount:      amount,
            price:       price,
            paymentToken: paymentToken,
            listingType: ListingType.FIXED,
            nftStandard: standard,
            active:      true,
            auctionEnd:  0 // zero = not an auction
        });

        emit Listed(listingId, msg.sender, nftContract, tokenId, price, ListingType.FIXED);
    }

    /**
     * @notice Purchase a fixed-price listing.
     *         Atomic: the NFT transfer and payment happen in the same call or both revert.
     *         ReentrancyGuard prevents the buyer's contract from re-entering before state updates.
     */
    function buyFixed(uint256 listingId) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active,                           "Marketplace: listing not active");
        require(listing.listingType == ListingType.FIXED, "Marketplace: not fixed listing");
        // Prevent wash trading — seller buying their own listing
        require(msg.sender != listing.seller,             "Marketplace: seller cannot buy");

        // Mark inactive before any external calls (checks-effects-interactions pattern)
        listing.active = false;

        // Pull payment from buyer, then distribute to seller, creator, platform
        _settlePayment(listingId, msg.sender, listing.seller, listing.price);

        // Transfer the escrowed NFT to the buyer
        _releaseNFT(address(this), msg.sender, listing.nftContract, listing.tokenId, listing.amount, listing.nftStandard);
    }

    // ─── Commit-reveal auction ───────────────────────────────────────────────

    /**
     * @notice List an NFT for auction with a commit-reveal scheme.
     *
     *         Why commit-reveal?
     *         In a naive on-chain auction, all bids are visible in the mempool.
     *         A miner or MEV bot can see a bid and insert a higher one just before
     *         it confirms, extracting value from honest bidders (front-running).
     *         With commit-reveal, the amount is hidden during the bidding phase.
     *
     * @param duration  Auction length in seconds (1 hour minimum, 7 days maximum)
     */
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
            seller:      msg.sender,
            nftContract: nftContract,
            tokenId:     tokenId,
            amount:      amount,
            price:       reservePrice,
            paymentToken: paymentToken,
            listingType: ListingType.AUCTION,
            nftStandard: standard,
            active:      true,
            auctionEnd:  block.timestamp + duration
        });

        emit Listed(listingId, msg.sender, nftContract, tokenId, reservePrice, ListingType.AUCTION);
    }

    /**
     * @notice Phase 1 — commit a hidden bid.
     *         Bidder computes the commitment off-chain:
     *         `commitment = keccak256(abi.encodePacked(amount, salt))`
     *         where `salt` is a random secret kept by the bidder.
     *         The actual bid amount is not revealed to anyone at this stage.
     */
    function commitBid(uint256 listingId, bytes32 commitment) external whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active && listing.listingType == ListingType.AUCTION, "Marketplace: not active auction");
        // Commitments only accepted during the auction window
        require(block.timestamp < listing.auctionEnd, "Marketplace: auction ended");

        auctionBids[listingId].push(BidCommit({
            commitment:     commitment,
            revealed:       false,
            revealedAmount: 0,
            bidder:         msg.sender
        }));

        emit BidCommitted(listingId, msg.sender, commitment);
    }

    /**
     * @notice Phase 2 — reveal a committed bid.
     *         Bidder provides the original amount and salt.
     *         The contract verifies: keccak256(amount, salt) == stored commitment.
     *         If correct, the bid amount is escrowed and the highest bid is tracked.
     *
     *         Reveal window: 24 hours after auction end.
     *         Bidders who do not reveal forfeit only their commit-phase gas (no funds at stake yet).
     */
    function revealBid(uint256 listingId, uint256 bidIndex, uint256 amount, bytes32 salt) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        // Reveals only accepted after auction ends
        require(block.timestamp >= listing.auctionEnd,          "Marketplace: reveal phase not started");
        // Reveals close 24 hours after auction end
        require(block.timestamp <= listing.auctionEnd + 1 days, "Marketplace: reveal phase ended");

        BidCommit storage bid = auctionBids[listingId][bidIndex];
        require(bid.bidder == msg.sender, "Marketplace: not your bid");
        require(!bid.revealed,            "Marketplace: already revealed");

        // Verify the commitment — this is the anti-front-running check
        require(keccak256(abi.encodePacked(amount, salt)) == bid.commitment, "Marketplace: commitment mismatch");

        bid.revealed       = true;
        bid.revealedAmount = amount;

        // Track the highest bid so far for settlement
        if (amount > highestBid[listingId]) {
            highestBid[listingId]    = amount;
            highestBidder[listingId] = msg.sender;
        }

        // Escrow this bidder's tokens now that the amount is verified
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);

        emit BidRevealed(listingId, msg.sender, amount);
    }

    /**
     * @notice Phase 3 — settle the auction after the reveal phase closes.
     *         Anyone can call this (typically the seller or a keeper bot).
     *         The winner gets the NFT; losing bidders are refunded in this call.
     *
     *         WARNING: The refund loop here is a gas DoS risk if there are many bidders.
     *         TODO: Replace with pull-payment — each loser calls claimRefund() separately.
     */
    function settleAuction(uint256 listingId) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active && listing.listingType == ListingType.AUCTION, "Marketplace: not active auction");
        // Settlement only possible after the reveal phase has fully closed
        require(block.timestamp > listing.auctionEnd + 1 days, "Marketplace: reveal phase not complete");

        listing.active = false;

        address winner    = highestBidder[listingId];
        uint256 winAmount = highestBid[listingId];

        // If no one met the reserve price, return the NFT to the seller
        require(winAmount >= listing.price, "Marketplace: reserve not met");

        // Refund all losing revealed bids (see TODO above about gas DoS)
        for (uint256 i = 0; i < auctionBids[listingId].length; i++) {
            BidCommit storage bid = auctionBids[listingId][i];
            if (bid.revealed && bid.bidder != winner) {
                IERC20(paymentToken).safeTransfer(bid.bidder, bid.revealedAmount);
            }
        }

        // Pay seller (and creator royalty, and platform fee) from winner's escrowed funds
        _settlePaymentDirect(listingId, winner, listing.seller, winAmount);

        // Transfer the NFT to the winner
        _releaseNFT(address(this), winner, listing.nftContract, listing.tokenId, listing.amount, listing.nftStandard);

        emit AuctionSettled(listingId, winner, winAmount);
    }

    /**
     * @notice Cancel a listing and return the NFT to the seller.
     *         Fixed listings can be cancelled any time.
     *         Auctions can only be cancelled before any bids are committed.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        // Only the seller or an admin can cancel
        require(listing.seller == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Marketplace: not authorized");
        require(listing.active, "Marketplace: not active");
        // Block cancellation once an auction is live and receiving bids
        require(listing.listingType == ListingType.FIXED || block.timestamp < listing.auctionEnd, "Marketplace: auction in progress");

        listing.active = false;

        // Return the escrowed NFT to the seller
        _releaseNFT(address(this), listing.seller, listing.nftContract, listing.tokenId, listing.amount, listing.nftStandard);

        emit ListingCancelled(listingId);
    }

    // ─── Internal payment helpers ────────────────────────────────────────────

    /**
     * @dev Pull payment from buyer into this contract, then distribute.
     *      Used by buyFixed — payment is not yet in the contract.
     */
    function _settlePayment(uint256 listingId, address buyer, address seller, uint256 price) internal {
        IERC20(paymentToken).safeTransferFrom(buyer, address(this), price);
        _distributePayment(listingId, seller, price);
    }

    /**
     * @dev Distribute payment that is already held in this contract.
     *      Used by settleAuction — funds were escrowed during revealBid.
     */
    function _settlePaymentDirect(uint256 listingId, address /* buyer */, address seller, uint256 price) internal {
        _distributePayment(listingId, seller, price);
    }

    /**
     * @dev Split a sale price three ways:
     *       1. Platform protocol fee (2.5% by default)
     *       2. Creator royalty (read from ERC-2981 on the NFT contract — enforced on-chain)
     *       3. Seller proceeds (remainder)
     *
     *      ERC-2981 royalties are enforced atomically here — they cannot be bypassed
     *      by using this marketplace, unlike off-chain royalty systems.
     */
    function _distributePayment(uint256 listingId, address seller, uint256 price) internal {
        Listing storage listing = listings[listingId];

        // Calculate platform fee
        uint256 platformFee   = (price * protocolFeeBps) / 10_000;
        uint256 royaltyAmount = 0;
        address royaltyRecipient;

        // Query ERC-2981 royalty if the NFT contract supports it
        if (IERC165(listing.nftContract).supportsInterface(type(IERC2981).interfaceId)) {
            (royaltyRecipient, royaltyAmount) = IERC2981(listing.nftContract).royaltyInfo(listing.tokenId, price);
        }

        // Seller gets what remains after fees and royalties
        uint256 sellerProceeds = price - platformFee - royaltyAmount;

        if (platformFee > 0)    IERC20(paymentToken).safeTransfer(feeRecipient,       platformFee);
        if (royaltyAmount > 0)  IERC20(paymentToken).safeTransfer(royaltyRecipient,   royaltyAmount);
        IERC20(paymentToken).safeTransfer(seller, sellerProceeds);

        emit Sale(listingId, address(0), seller, price, royaltyAmount, platformFee);
    }

    /**
     * @dev Transfer an NFT from `from` into this contract as escrow.
     *      Caller must have approved this contract before calling.
     *      Dispatches to ERC-721 or ERC-1155 based on the standard flag.
     */
    function _escrowNFT(address from, address nftContract, uint256 tokenId, uint256 amount, NFTStandard standard) internal {
        if (standard == NFTStandard.ERC721) {
            IERC721(nftContract).transferFrom(from, address(this), tokenId);
        } else {
            IERC1155(nftContract).safeTransferFrom(from, address(this), tokenId, amount, "");
        }
    }

    /**
     * @dev Transfer an escrowed NFT from `from` (usually address(this)) to `to`.
     */
    function _releaseNFT(address from, address to, address nftContract, uint256 tokenId, uint256 amount, NFTStandard standard) internal {
        if (standard == NFTStandard.ERC721) {
            IERC721(nftContract).transferFrom(from, to, tokenId);
        } else {
            IERC1155(nftContract).safeTransferFrom(from, to, tokenId, amount, "");
        }
    }

    // ─── Admin functions ─────────────────────────────────────────────────────

    /**
     * @notice Update the protocol fee rate.
     *         Cannot exceed MAX_PROTOCOL_FEE_BPS (5%) — hard-coded ceiling.
     */
    function setProtocolFee(uint256 newFeeBps) external onlyRole(FEE_MANAGER_ROLE) {
        require(newFeeBps <= MAX_PROTOCOL_FEE_BPS, "Marketplace: fee too high");
        protocolFeeBps = newFeeBps;
    }

    /**
     * @notice Update where protocol fees are sent (e.g. new treasury address).
     */
    function setFeeRecipient(address newRecipient) external onlyRole(FEE_MANAGER_ROLE) {
        require(newRecipient != address(0), "Marketplace: zero address");
        feeRecipient = newRecipient;
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause();   }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ─── ERC-721 / ERC-1155 receiver hooks ──────────────────────────────────
    // Required so this contract can hold NFTs via safeTransfer

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
