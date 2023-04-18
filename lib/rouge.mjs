// SPDX-License-Identifier: AGPL-3.0

import { Buffer } from 'buffer'
import { ethers } from 'ethers'

import { TokenAmount } from 'erc-token-js'

const nullLogger = {
  fatal: args => new Error(...args),
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
}

let { fatal, error, warn, info, debug, trace } = nullLogger

export const setLogger = logger => {
  void({ fatal, error, warn, info, debug, trace } = logger)
}

// TODO lookup for contracts...

export const NFT_LIMIT = 281474976710655
export const ALL_CHANNELS = 65535

export const tokens = {
  'ETH': ethers.ZeroAddress,
  'USDC': ethers.ZeroAddress,
}


export const abiEncodeChannel = ({
  supply = NFT_LIMIT,
  amount = '0', // uint256
  token = ethers.ZeroAddress,
  free
} = {}) => {

  if (free) {
    amount = '0'
    token = ethers.ZeroAddress
  }

  if (amount instanceof TokenAmount) {
    token = amount.token.address || ethers.ZeroAddress
    amount = amount.valueOf()
  } else if (typeof token === 'object') {
    // old format to remove ...
    token = token.address || ethers.ZeroAddress
  }

  return [ supply, 0, 0, token, amount ]
}


// { scope: 'acquire', enable: true }
// { scope: 'acquire', hasRole: [ /*addresses_lists*/ ]   }
export const abiEncodeAuth = ({
  iface,
  address = ethers.ZeroAddress,
  scope,
  channels = [ ALL_CHANNELS ],
  grant = true
} = {}) => {

  return [
    address,
    /^0x/.test(scope) ? scope : iface.getFunction(scope).selector,
    channels,
    grant
  ]
}


export const getStamp = proof => ethers.keccak256(ethers.solidityPacked(['bytes32'],[proof])).slice(0,34)


// Make Class with asXXX as Qr stamp etc handler
export const calculateStampProof = async ({ contract, signer, secret, tokenId, channelId, salt, index }) => {
  trace('[calculateStampProof IN]', { contract, signer, secret, tokenId, channelId, salt, index })
  const signerAddress = await signer.getAddress()
  const { chainId } = await signer.provider.getNetwork()
  const secretHash = ethers.id(`${signerAddress}:${secret}`)
  if (tokenId) {
    if (!contract) fatal('not enough element to calculate stamp proof')
    void({ channelId } = await contract.getTokenInfos(tokenId))
    const event = (await contract.queryFilter(contract.filters.Acquired(BigInt(tokenId)), 0)).pop() || {}
    void({ salt, index } = event.args)
  }
  trace('[calculateStampProof OUT]', { channelId, secretHash, salt, index })
  // XXX trace wrong secret ?
  // console.log('MAIN LIB', `${chainId}:${contract.address}:${channelId}:${secretHash}:${salt}:${index}`)
  return ethers.id(`${chainId}:${contract.address}:${channelId}:${secretHash}:${salt}:${index}`)
}

export const encodeAnnotatedProof = ({ contract, bearer, tokenId, proof }) => {
  trace('[encodeAnnotatedProofShort]', { contract, bearer, tokenId, proof })
  // length is 6 + 20 + 20 + 32 = 78 bytes
  const packed = ethers.solidityPacked(
    [ 'uint48', 'address', 'address', 'bytes32' ], [ tokenId, contract, bearer, proof ]
  ).slice(2).replace(/^(00)+/,'')
  const b64 = Buffer.from(packed, 'hex').toString('base64')
  return b64
}

export const decodeAnnotatedProof = data => {
  const tokenId = parseInt('0x' + data.slice(0, 12), 16)
  const contract = ethers.getAddress('0x' + data.slice(12, 52))
  const bearer = ethers.getAddress('0x' + data.slice(52, 92))
  const proof = '0x' + data.slice(92, 156)
  return { contract, bearer, tokenId, proof }
}

export const encodeAnnotatedCertificate = ({ contract, bearer, tokenId, signature, selector = '0x0', expire = 0}) => {
  const { r, s, v } = ethers.Signature.from(signature)
  trace('[encodeAnnotatedCertificate]', { contract, bearer, tokenId, signature, selector, expire })
  // length is 6 + 20 + 20 + 4 + 4 + 1 + 32 + 32 = 119 bytes
  const packed = ethers.solidityPacked(
    [ 'uint48', 'address', 'address', 'uint32', 'bytes4', 'uint8', 'bytes32', 'bytes32' ], [ tokenId, contract, bearer, expire, selector, v, r, s ]
  ).slice(2).replace(/^(00)+/,'')
  const b64 = Buffer.from(packed, 'hex').toString('base64')
  return b64
}

export const decodeAnnotatedCertificate = data => {
  const tokenId = parseInt('0x' + data.slice(0, 12), 16)
  const contract = ethers.getAddress('0x' + data.slice(12, 52))
  const bearer = ethers.getAddress('0x' + data.slice(52, 92))
  const expire = '0x' + data.slice(92, 100)
  const selector = '0x' + data.slice(100, 108)
  const v = '0x' + data.slice(108, 110)
  const r = '0x' + data.slice(110, 174)
  const s = '0x' + data.slice(174, 238)
  // console.log('decodeAnnotatedCertificate DEBUG', { contract, bearer, tokenId, expire, selector, v, r, s})
  return { contract, bearer, tokenId, expire, selector, v, r, s}
}

export const decodeAnnotated = b64 => {
  const data = Buffer.from(b64, 'base64').toString('hex')
  // console.log('[decodeAnnotated]', b64, data, data.length)
  if (data.length > 156) return decodeAnnotatedCertificate(data.padStart(238, '0'))
  return decodeAnnotatedProof(data.padStart(156, '0'))
}

export const abiEncodeAcquire = async ({ channels, signer, secret, contract, acquisitions }) => {
  acquisitions = acquisitions.filter(a => a.qty > 0)
  if (acquisitions.length < 1) throw new Error('no acquisitions')
  const signerAddress = await signer.getAddress()
  const { chainId } = await signer.provider.getNetwork()
  const secretHash = ethers.id(`${signerAddress}:${secret}`)
  // XXX get optionally salt from args ? => no since it could be manipulated to create custom metadata certificate
  const salt = await signer.provider.getTransactionCount(signerAddress)
  trace('[abiEncodeAcquire]', { signerAddress, chainId, secretHash, salt })
  let index = 1
  let nativeTotal = BigNumber.from(0)
  // throw if twice same channelId => also solidityCheck ?
  const loop = ({ channelId, qty = 1 } = {}, i) => {
    // XXX check uint8 qty, uint16 channelId ?
    const stamps = []
    for (let i = 1; i <= qty; i++) {
      const proof = ethers.id(`${chainId}:${contract.address}:${channelId}:${secretHash}:${salt}:${index}`)
      trace('[abiEncodeAcquire]', { channelId, qty, index: i, proof })
      stamps.push(getStamp(proof))
      index++;
    }
    // or Type = 'Native'
    if (channels && channels[channelId] && channels[channelId]?.amount?.token?._isNative) {
      nativeTotal = nativeTotal.add(channels[channelId].amount.valueOf().mul(qty))
    }
    return [ channelId, qty, salt, stamps ]
  }
  return [ acquisitions.map((a, i) => loop(a, i)), { value: nativeTotal } ]
}

export const makeRedemptionStructArg = ({
  tokenId
} = {}) => {

  return [ tokenId ]
}



/* **************************** */

//export const certificationAsParams = entry => ([ entry.uid, [ entry.carType, entry.level, entry.weight, entry.exp ], entry.r, entry.s, entry.v ])

export const eip712DomainByChain = (chainId, verifyingContract) => ({
  name: 'Rouge',
  version: '2',
  chainId: parseInt(chainId),
  verifyingContract
})

export const generateCertificate = async ({
  signer, contract, tokenId, selector, expire = 0, chainId }) => {

    const from = await signer.getAddress()
    if (!chainId) {
      void({ chainId } = await signer.provider.getNetwork())
    }
    const signature = await signer._signTypedData(
    eip712DomainByChain(chainId, contract),
    {
      Memorandum: [
        { name: 'selector', type: 'bytes4' },
        { name: 'expire', type: 'uint32' },
      ],
      Certificate: [
        { name: 'from', type: 'address' },
        { name: 'tokenId', type: 'uint48' },
        { name: 'memorandum', type: 'Memorandum' },
      ]
    },
    { tokenId, from, memorandum: { selector, expire } }
  )
    return { from, tokenId, selector, expire, signature }
}

export const abiEncodeCertificate = ({ from, tokenId, selector, expire, signature, r, s, v } = {}) => {
  if (!signature && !r) return [ ethers.ZeroAddress, 0, [ '0x00000000', 0 ], ethers.ZeroHash, ethers.ZeroHash, 27 ]
  if (signature && !r) void({ r, s, v } = ethers.Signature.from(signature))
  return [ from, tokenId, [ selector, expire ], r, s, v ]
}

export const decodeRoles = async (contract, selectors, account, channels) => {
  const raw = await contract.getRoles(
    selectors.map(s => contract.interface.getFunction(s).selector,
    account
  )
  return raw.map(c => {
    const o = {}
    selectors.forEach((s,i) => {
      o[s] = c[i]
    })
    return o
  })
}
