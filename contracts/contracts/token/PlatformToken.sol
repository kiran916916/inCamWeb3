// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OpenZeppelin upgradeable contracts are used throughout.
// The "Upgradeable" variants store no state in the constructor and use
// initializer functions instead, making them safe behind a proxy.
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title PlatformToken
 * @notice Governance and utility ERC-20 token for the InCam Web3 platform.
 *
 * Key properties:
 *  - ERC-20 with burning capability (token holders can destroy their own tokens)
 *  - ERC-20Permit: gasless approvals via off-chain signatures (EIP-2612)
 *  - ERC-20Votes: snapshot-based voting weight for on-chain governance (EIP-5805)
 *  - Role-based access control instead of single-owner pattern (more secure)
 *  - Pausable: emergency stop for all transfers if a vulnerability is discovered
 *  - UUPS upgradeable: allows bug fixes without migrating token balances
 *  - Hard cap of 1 billion tokens — minting beyond this always reverts
 */
contract PlatformToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Role identifiers — each is a keccak256 hash used as an access key.
    // Separate roles mean a compromised minter cannot pause or upgrade the contract.
    bytes32 public constant MINTER_ROLE  = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Absolute maximum token supply — 1 billion tokens at 18 decimal places.
    // This prevents inflationary minting even if the MINTER_ROLE is compromised.
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    /**
     * @notice Disable the implementation contract's initializer.
     * Without this, an attacker could call initialize() on the bare implementation
     * (not through the proxy) and gain admin control over the logic contract.
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialise the token — called once by the proxy deployer.
     *         Replaces a constructor in the upgradeable pattern.
     * @param name         Token name, e.g. "InCam Token"
     * @param symbol       Token ticker, e.g. "INCAM"
     * @param defaultAdmin Address that receives DEFAULT_ADMIN_ROLE (intended: 3-of-5 multisig)
     * @param minter       Address that can call mint() (intended: treasury/rewards service wallet)
     * @param pauser       Address that can pause/unpause (intended: same multisig as admin)
     */
    function initialize(
        string memory name,
        string memory symbol,
        address defaultAdmin,
        address minter,
        address pauser
    ) public initializer {
        // Initialise every parent contract — order matters for storage layout
        __ERC20_init(name, symbol);
        __ERC20Burnable_init();
        __ERC20Permit_init(name);   // domain separator uses the token name
        __ERC20Votes_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        // Grant roles — multiple addresses can hold the same role
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE,        minter);
        _grantRole(PAUSER_ROLE,        pauser);
        // Admin also holds UPGRADER_ROLE so the multisig controls contract upgrades
        _grantRole(UPGRADER_ROLE,      defaultAdmin);
    }

    /**
     * @notice Create new tokens and send them to `to`.
     *         Only callable by MINTER_ROLE (rewards service, treasury).
     *         Enforces the hard cap — reverts if minting would exceed MAX_SUPPLY.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "PlatformToken: max supply exceeded");
        _mint(to, amount);
    }

    /**
     * @notice Halt all token transfers immediately.
     *         Used in emergencies — e.g. a vulnerability is discovered on the marketplace.
     *         Only PAUSER_ROLE (multisig) can call this.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Resume token transfers after an emergency pause.
     *         Should only be called after the root cause has been resolved.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Gate contract upgrades to UPGRADER_ROLE.
     *         UUPS pattern requires the implementation itself to authorise upgrades,
     *         which prevents the proxy admin from upgrading to an arbitrary contract.
     *         In production: UPGRADER_ROLE is held by a 3-of-5 Gnosis Safe multisig
     *         with a 48-hour timelock enforced by the PlatformDAO governor.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @notice Override required by Solidity when multiple parents define _update.
     *         Adding `whenNotPaused` means all transfers revert while the contract is paused,
     *         including minting, burning, and standard transfers.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) whenNotPaused {
        super._update(from, to, value);
    }

    /**
     * @notice Override required by Solidity: both ERC20Permit and Nonces define nonces().
     *         Delegates to the parent chain — no custom logic needed.
     */
    function nonces(address owner)
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
