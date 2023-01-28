// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "./proxies/Singleton.sol";
import "./modules/UseCertificate.sol";
import "./modules/UseStampProof.sol";

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
//import "@openzeppelin/contracts/interfaces/IERC721.sol";
//import "@openzeppelin/contracts/interfaces/IERC1155.sol";

//import "hardhat/console.sol";

contract Rouge is Singleton, ERC721, UseCertificate, UseStampProof {
    using Address for address payable;

    string public constant VERSION = "2.0.0";

    uint256 public constant NFT_LIMIT = ~uint48(0); // 281,474,976,710,655
    uint16 public constant CHANNEL_LIMIT = ~uint16(0); // 65,535
    uint256 public constant ACQUISITION_LIMIT = ~uint16(0); // 65,535 per batch

    // uint48 to be less than js 2^53 safe integer
    uint48 private _nextTokenId;

    bool private ready = false;

    string public URI;

    constructor() ERC721("Rouge NFT", "RGN") {
        // master copy is not usable
        ready = true;
    }

    struct Authorization {
        address account;
        bytes4 selector;
        uint16[] channels;
        bool grant;
    }

    struct Role {
        mapping(uint16 => mapping(address => bool)) scope;
    }

    mapping (bytes4 => Role) private _role;

    function hasRole(address account, bytes4 selector, uint16 channelId) view public returns (bool) {
        if (_role[selector].scope[channelId][account]) return true;
        if (channelId != CHANNEL_LIMIT) return hasRole(account, selector, CHANNEL_LIMIT);
        return false;
    }

    function isEnabled(bytes4 selector, uint16 channelId) view public returns (bool) {
        return hasRole(address(0), selector, channelId);
    }

    struct Channel {
        // uint256 type; ? to change on chain behavior
        uint48 supply; // keep issuance ? NFT_LIMIT = inf
        uint48 totalAcquired;
        uint48 totalRedeemed;
        address token; // should support ERC20, ERC721, ERC1155
        uint256 amount;
    }

    Channel[] private _channel;

    event AddedChannel(uint16 indexed channelId, uint48 supply, uint256 amount);

    function addChannels(Channel[] memory channel) public {

        // require(!ready || true);
        require(channel.length > 0);
        require(_channel.length + channel.length < CHANNEL_LIMIT);

        for (uint16 i = 0; i < channel.length; i++) {

            require(isEnabled(this.addChannels.selector, CHANNEL_LIMIT), "not enabled");
            require(!ready || hasRole(_msgSender(), this.addChannels.selector, CHANNEL_LIMIT), "not authorized");

            // XXX allow non zero starting channel ?
            channel[i].totalAcquired = 0;
            channel[i].totalRedeemed = 0;

            _channel.push(channel[i]);

            emit AddedChannel(
                              uint16(_channel.length - 1),
                              channel[i].supply,
                              channel[i].amount
            );
        }
    }

    event UpdateAuthorization(address indexed account, bytes4 indexed selector, uint16 indexed channelId, bool grant);

    function updateAuthorizations(Authorization[] memory auth) public {

        for (uint256 i = 0; i < auth.length; i++) {

            // per channel grant
            if (auth[i].channels.length > 0) {
                for (uint16 j = 0; j < auth[i].channels.length; j++) {

                    require(isEnabled(this.updateAuthorizations.selector, auth[i].channels[j]), "not enabled");
                    require(!ready || hasRole(_msgSender(), this.updateAuthorizations.selector, auth[i].channels[j]), "not authorized");

                    _role[auth[i].selector].scope[auth[i].channels[j]][auth[i].account] = auth[i].grant;
                    emit UpdateAuthorization(
                                    auth[i].account,
                                    auth[i].selector,
                                    auth[i].channels[j],
                                    auth[i].grant
                                    );
                }

            }
        }
    }

    event ProjectSetup(address creator, address manager, string URI);

    function setup(address manager, string calldata URI_, Channel[] memory channel, Authorization[] memory auth) external {
        require(!ready);
        URI = URI_;
        _nextTokenId = 1;

        // all selector enable except acquire/redeem
        _role[this.addChannels.selector].scope[CHANNEL_LIMIT][address(0)] = true;
        _role[this.updateAuthorizations.selector].scope[CHANNEL_LIMIT][address(0)] = true;
        _role[this.widthdraw.selector].scope[CHANNEL_LIMIT][address(0)] = true;
        _role[this.widthdrawToken.selector].scope[CHANNEL_LIMIT][address(0)] = true;
        _role[this.approveToken.selector].scope[CHANNEL_LIMIT][address(0)] = true;

        // default all roles for manager
        _role[this.addChannels.selector].scope[CHANNEL_LIMIT][manager] = true;
        _role[this.updateAuthorizations.selector].scope[CHANNEL_LIMIT][manager] = true;
        _role[this.widthdraw.selector].scope[CHANNEL_LIMIT][manager] = true;
        _role[this.widthdrawToken.selector].scope[CHANNEL_LIMIT][manager] = true;
        _role[this.approveToken.selector].scope[CHANNEL_LIMIT][manager] = true;
        _role[this.redeem.selector].scope[CHANNEL_LIMIT][manager] = true;

        if (channel.length > 0) addChannels(channel);
        if (auth.length > 0) updateAuthorizations(auth);
        ready = true;

        emit ProjectSetup(msg.sender, manager, URI);

        // console.log('NFT_LIMIT', NFT_LIMIT);
        // console.log('CHANNEL_LIMIT', CHANNEL_LIMIT);
    }

    // issuance channel => code ticket
    // Label -  Standard Rate, Early Bird, VIP, etc    // => add in meta ?
    // Quota/Max/supply
    // token => contract 0 means gas

    struct NFT { // XXX more packing ?
        uint16 channelId;
        bytes16 stamp;
        bool redeemed;
        bool repudiated;
    }

    mapping (uint48 => NFT) private _nft;

    event Acquired(uint48 indexed tokenId, bytes16 stamp, uint256 salt, uint24 index);

    function _acquire(address account, uint16 channelId, bytes16 stamp, uint256 salt, uint24 index) private {
        _nft[_nextTokenId] = NFT({
            channelId: channelId,
            stamp: stamp,
            redeemed: false,
            repudiated: false
        });

        _mint(account, _nextTokenId);

        emit Acquired(_nextTokenId, stamp, salt, index);

        _nextTokenId++;
    }

    struct Acquisition {
        uint16 channelId;
        uint16 qty;
        uint256 salt;
        bytes16[] stamps;
        // other behavior ...
    }

    // todo airdrop ?

    function _payToken(address token, uint256 amount) private {
        // XXX check interface
        // TODO possibility to have collector address
        require(IERC20(token).transferFrom(_msgSender(), address(this), amount));
    }

    // too much duplicate with Transfer ... ?
    // event Acquired(address bearer, uint256 indexed tokenId);

    function acquire(Acquisition[] memory acquisitions) payable public {
        uint24 index = 1;
        uint256 value = msg.value;

        for (uint16 i = 0; i < acquisitions.length; i++) {
            require(_channel.length > acquisitions[i].channelId);
            require(isEnabled(this.acquire.selector, acquisitions[i].channelId), "not enabled");

            // revert all acquisitions if not enough supply in one
            require(_channel[acquisitions[i].channelId].supply >= _channel[acquisitions[i].channelId].totalAcquired + acquisitions[i].qty, "supply exhausted");

            // console.log("\n[acquire] %s * channel %s", acquisitions[i].qty, acquisitions[i].channelId);

            for (uint16 j = 0; j < acquisitions[i].qty; j++) {

                bytes16 stamp = acquisitions[i].stamps.length > j ? acquisitions[i].stamps[j] : bytes16(0);

                _acquire(_msgSender(), acquisitions[i].channelId, stamp, acquisitions[i].salt, index);

                index++;
            }

            if (_channel[acquisitions[i].channelId].amount > 0) {

                if (_channel[acquisitions[i].channelId].token == address(0)) {
                    require(value >= _channel[acquisitions[i].channelId].amount * acquisitions[i].qty, 'no enough funding');
                    // xxx uncheck
                    value -= _channel[acquisitions[i].channelId].amount * acquisitions[i].qty;
                } else {
                    _payToken(_channel[acquisitions[i].channelId].token, _channel[acquisitions[i].channelId].amount * acquisitions[i].qty);
                }
            }

            _channel[acquisitions[i].channelId].totalAcquired += acquisitions[i].qty;
        }
    }

    // TODO reset stamp (transfer or lost proof)

    struct Redemption {
        uint16 tokenId;
        bytes32 proof;
        SignedCertificate certificate;
    }

    event Redeemed(address bearer, uint48 indexed tokenId);

    function _acceptanceFromIssuer(Redemption memory redemption, bytes4 selector) private view returns (bool) {
        if (hasRole(_msgSender(), selector, _nft[redemption.tokenId].channelId)) return true;

        // we have a matching certificate
        if (redemption.certificate.tokenId == redemption.tokenId
            && redemption.certificate.memorandum.selector == selector
            && hasRole(redemption.certificate.from, selector, _nft[redemption.tokenId].channelId)
            ) {
            if (isValid(redemption.certificate)) return true;
        }

        // TODO use delegation
        return false;
    }

    function validTokenProof(uint16 tokenId, bytes32 proof) public view returns (bool) {
        return validProof(_nft[tokenId].stamp, proof);
    }

    function _acceptanceFromBearer(Redemption memory redemption, bytes4 selector) private view returns (bool) {
        // always ok when tx.from is bearer
        if (ownerOf(redemption.tokenId) == _msgSender()) return true;

        // we have a matching certificate
        if (redemption.certificate.tokenId == redemption.tokenId
            && redemption.certificate.memorandum.selector == selector) {
            // ok if valid & signed by rightful nft owner
            if (redemption.certificate.from == ownerOf(redemption.tokenId) && isValid(redemption.certificate)) return true;
        }

        return validTokenProof(redemption.tokenId, redemption.proof);
    }

    //  XXX add signature barrier before redemption => ? eg POA
    function redeem(Redemption[] memory redemptions) public {
        for (uint16 i = 0; i < redemptions.length; i++) {
            require(redemptions[i].tokenId < _nextTokenId);
            require(isEnabled(this.redeem.selector, _nft[redemptions[i].tokenId].channelId), "not enabled");

            // XXX many redeem per nft possible ?
            require(!_nft[redemptions[i].tokenId].redeemed);

            require(_acceptanceFromIssuer(redemptions[i], this.redeem.selector), "not authorized by issuer");
            require(_acceptanceFromBearer(redemptions[i], this.redeem.selector), "not authorized by bearer");

            // option to burn NFT Rule X burn and supply++;

            // XXX assets requirement on redeem, donation, pool incentive ?
            _nft[redemptions[i].tokenId].redeemed = true;
            _channel[_nft[redemptions[i].tokenId].channelId].totalRedeemed++;
            emit Redeemed(ownerOf(redemptions[i].tokenId), redemptions[i].tokenId);
        }
    }

    function getRoles(bytes4[] memory selectors, address account) public view returns (bool[][] memory roles) {
        bool[][] memory r = new bool[][](_channel.length + 1);

        for (uint16 i = 0; i < _channel.length; i++) {
            bool[] memory s = new bool[](selectors.length);
            for (uint16 j = 0; j < selectors.length; j++) {
                s[j] = _role[selectors[j]].scope[i][account];
            }
            r[i] = s;
        }
        bool[] memory s = new bool[](selectors.length);
        for (uint16 j = 0; j < selectors.length; j++) {
            s[j] = _role[selectors[j]].scope[CHANNEL_LIMIT][account];
        }
        r[_channel.length] = s;
        roles = r;
    }
    //_role[this.addChannels.selector].scope[CHANNEL_LIMIT][address(0)] = true;

    function getInfos() public view returns (string memory uri, Channel[] memory channels, uint256[] memory balances) {
        uri = URI;
        channels = _channel;
        uint256[] memory balances_ = new uint256[](_channel.length);

        for (uint16 i = 0; i < _channel.length; i++) {
            if (_channel[i].amount > 0) {
                if (_channel[i].token == address(0)) {
                    balances_[i] = address(this).balance;
                } else {
                    // XXX use try ?
                    //console.log('checking balance', i, _channel[i].token, balance);
                    balances_[i] = IERC20(_channel[i].token).balanceOf(address(this));
                }
            }
        }
        balances = balances_;
    }


    function getTokenInfos(uint48 tokenId) public view
        returns (address owner, uint16 channelId, bytes16 stamp, bool redeemed, uint256 nextTokenId) {
        owner = ownerOf(tokenId);
        channelId = _nft[tokenId].channelId;
        stamp = _nft[tokenId].stamp;
        redeemed = _nft[tokenId].redeemed;
        nextTokenId = _nextTokenId;
    }

    // TODO onchain json + image from contract + metadata updates in the future
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        // TODO level 1, better attributes and link to dapp
        return URI;
    }

    function widthdraw(address payable to, uint256 amount) external {
        require(isEnabled(this.widthdraw.selector, CHANNEL_LIMIT), "not enabled");
        require(hasRole(_msgSender(), this.widthdraw.selector, CHANNEL_LIMIT));
        to.sendValue(amount);
    }

    function approveToken(address token, address spender, uint256 amount) external {
        require(isEnabled(this.approveToken.selector, CHANNEL_LIMIT), "not enabled");
        require(hasRole(_msgSender(), this.approveToken.selector, CHANNEL_LIMIT));
        IERC20(token).approve(spender, amount);
    }

    // XXX or approveToken enough ?
    function widthdrawToken(
                            address token,
                            address to,
                            uint256 amount
                            ) external {
        require(isEnabled(this.widthdrawToken.selector, CHANNEL_LIMIT), "not enabled");
        require(hasRole(_msgSender(), this.widthdrawToken.selector, CHANNEL_LIMIT));
        IERC20(token).transfer(to, amount);
    }

    // TODO attachments erc20 + erc721 as module ?
}
