// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

contract UseCertificate {

    struct Memorandum {
        bytes4 selector;
        uint32 expire;
    }

    struct Certificate {
        address from;
        uint48 tokenId;
        Memorandum memorandum;
    }

    struct SignedCertificate {
        address from;
        uint48 tokenId;
        Memorandum memorandum;
        bytes32 sigR;
        bytes32 sigS;
        uint8 sigV;
    }

    string private constant EIP712_DOMAIN  = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
    string private constant MEMORANDUM_TYPE = "Memorandum(bytes4 selector,uint32 expire)";
    string private constant CERTIFICAT_TYPE = "Certificate(address from,uint48 tokenId,Memorandum memorandum)Memorandum(bytes4 selector,uint32 expire)";

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(EIP712_DOMAIN));
    bytes32 private constant MEMORANDUM_TYPEHASH = keccak256(abi.encodePacked(MEMORANDUM_TYPE));
    bytes32 private constant CERTIFICAT_TYPEHASH = keccak256(abi.encodePacked(CERTIFICAT_TYPE));

    // keeep public ?
    function getChainId() public view returns (uint256) {
        uint256 id;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }

    function separator() private view returns (bytes32) {
        // solhint-disable-next-line var-name-mixedcase
        return keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256("Rouge"),
            keccak256("2"), // string version
            getChainId(),
            address(this)
        ));
    }

    function hashMemorandum(Memorandum memory memorandum) private pure returns (bytes32) {
        return keccak256(abi.encode(
            MEMORANDUM_TYPEHASH,
            memorandum.selector,
            memorandum.expire
        ));
    }

    function hashCertificate(Certificate memory message) private view returns (bytes32) {
        return keccak256(abi.encodePacked(
                "\x19\x01",
                separator(),
                keccak256(abi.encode(
                    CERTIFICAT_TYPEHASH,
                    message.from,
                    message.tokenId,
                    hashMemorandum(message.memorandum)
                ))
            ));
    }

    function isValidSignature(SignedCertificate memory signed) public view returns (bool) {
        return ecrecover(
                         hashCertificate(Certificate({
                                 from: signed.from,
                                 tokenId: signed.tokenId,
                                 memorandum: signed.memorandum
                                 })
                             ), signed.sigV, signed.sigR, signed.sigS
                         ) == signed.from;
    }

    function isValid(SignedCertificate memory signed) public view returns (bool) {
        // there is an expiration date
        if (signed.memorandum.expire > 0 && block.timestamp > signed.memorandum.expire) {
            // console.log("[warn] expired certificate");
            return false;
        }
        return isValidSignature(signed);
    }

}
