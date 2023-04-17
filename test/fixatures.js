
import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { nanoid } from 'nanoid'

const { utils, constants } = ethers

import {
  abiEncodeChannel,
  abiEncodeAuth,
  abiEncodeAcquire,
  makeRedemptionStructArg,
  generateCertificate,
  abiEncodeCertificate
} from '../lib/rouge'

import { Token, TokenAmount, expandToNDecimals } from 'erc-token-js'

const hashURI = 'Qmc9Jq48M4yveuPdscgZxecFcwCRUtdApfWdB3bYzAWGgS'
const metaURI = `ipfs://${hashURI}/`

export const standardEventFixature = async (signers, provider) => {
  const [ issuer, alice, bob, carol, dave, deployer ] = await ethers.getSigners()

  const TestERC20 = await ethers.getContractFactory("TestERC20")
  const usdc = await TestERC20.deploy(
    expandToNDecimals(15, 9 + 6), // 45 billions
    "USD Coin (Fake)",
    "USDC",
    6
  )
  await usdc.deployed()
  const uni = await TestERC20.deploy(
    expandToNDecimals(1, 9 + 18), // 1 billion
    "Uniswap (Fake)",
    "UNI",
    19
  )
  await uni.deployed()

  // const USDToken = { decimals: 6, address: usdc.address, symbol: 'USDC' }
  // const ETHToken = { decimals: 18, symbol: 'ETH' } // or constants.AddressZero
  const usdcToken = await Token.from(usdc)
  const uniToken = await Token.from(uni)
  const ethToken = await Token.native(
    { name: 'Ether', symbol: 'ETH', formatSymbol: constants.EtherSymbol }
  )

  const channels = [
    { free: false, supply: 15, label: "Sponsor", amount: uniToken.newAmount( 100 ) },
    { free: true,  supply: 110, label: "Super Early Bird" },
    { free: false, supply: 120, label: "Early Bird", amount: usdcToken.newAmount( 99 ) },
    { free: false, label: "Normal", amount: usdcToken.newAmount( 289 ) },
    { free: false, supply: 130, label: "VIP", amount: usdcToken.newAmount( 888 ) },
    { free: false, supply: 20, label: "Aficionado", amount: ethToken.newAmount( 1 ) },
  ]

  const Rouge = await ethers.getContractFactory("Rouge")
  const singleton = await Rouge.deploy()
  await singleton.deployed()

  const Factory = await ethers.getContractFactory("RougeProxyFactory")
  const factory = await Factory.deploy()
  await factory.deployed()

  const channelsAsParams = channels.map(v => abiEncodeChannel(v))
  const saltNonce = 42
  const initCode = Rouge.interface.encodeFunctionData("setup", [issuer.address, metaURI, channelsAsParams, []])

  const tx = await factory.connect(issuer).createProxyWithNonce(singleton.address, initCode, saltNonce)
  const rcpt = await tx.wait()
  const proxyAddress = rcpt.events.filter(e => e.event === 'ProxyCreation')[0].args.proxy
  const rouge = Rouge.attach( proxyAddress )

  for await (const account of [ alice, bob, carol, dave ]) {
    // console.log('move fake USDC to ', account.address)
    await (await usdc.transfer(account.address, expandToNDecimals('10 000 000', 6))).wait()
    await (await uni.transfer(account.address, expandToNDecimals('10 000 000', 18))).wait()
    // todo remove
    await (await usdc.connect(account).approve(rouge.address, constants.MaxUint256)).wait()
    await (await uni.connect(account).approve(rouge.address, constants.MaxUint256)).wait()
  }

  return { deployer, issuer, alice, bob, carol, usdc, uni, rouge, channels }
}

export const standardAcquireFixature = async (signers, provider) => {
  const { deployer, issuer, alice, bob, carol, dave, usdc, uni, rouge, channels } = await standardEventFixature(signers, provider)

  const auths = [
    { scope: rouge.interface.getSighash('acquire'), enable: true }
  ].map(a => abiEncodeAuth(a))

  void(await rouge.connect(issuer).updateAuthorizations(auths)).wait()

  const params = await abiEncodeAcquire({
    channels,
    contract: rouge,
    signer: alice,
    secret: 'rougetest',
    acquisitions: [
      { channelId: 0, qty: 1 },
      { channelId: 1, qty: 2 },
      { channelId: 2, qty: 3 },
      { channelId: 3, qty: 2 },
      { channelId: 4, qty: 1 },
    ]
  })

  void(await rouge.connect(alice).acquire(...params)).wait()

  return { deployer, issuer, alice, bob, carol, usdc, uni, rouge }
}


export const standardRedemtionReadyFixature = async (signers, provider) => {
  const { deployer, issuer, alice, bob, carol, dave, usdc, uni, rouge, channels } = await standardAcquireFixature(signers, provider)

  const auths = [
    { scope: rouge.interface.getSighash('redeem'), enable: true }
  ].map(a => abiEncodeAuth(a))

  void(await rouge.connect(issuer).updateAuthorizations(auths)).wait()

  return { deployer, issuer, alice, bob, carol, usdc, uni, rouge }
}
