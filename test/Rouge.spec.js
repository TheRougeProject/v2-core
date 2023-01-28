
import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import { nanoid } from 'nanoid'

import {
  standardEventFixature,
  standardAcquireFixature,
  standardRedemtionReadyFixature
} from './fixatures'

import {
  ALL_CHANNELS,
  abiEncodeChannel,
  abiEncodeAuth,
  abiEncodeAcquire,
  makeRedemptionStructArg,
  generateCertificate,
  abiEncodeCertificate,
  calculateStampProof,
  getStamp
} from '../lib/rouge'

const { utils, constants } = ethers
const { createFixtureLoader } = waffle

let loadFixture

describe('Rouge Contract', () => {

  // use ethers.js
  beforeEach(async () => {
    loadFixture = createFixtureLoader(await ethers.getSigners(), ethers.provider)
  })

  it('acquisition', async () => {
    const { deployer, issuer, rouge, usdc, alice, channels } = await loadFixture(standardEventFixature)

    const auths = [
      { scope: rouge.interface.getSighash('acquire'), enable: true }
    ].map(a => abiEncodeAuth(a))

    void(await rouge.connect(issuer).updateAuthorizations(auths)).wait()

    const params = await abiEncodeAcquire({
      channels,
      contract:rouge,
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

    const tx1 = await rouge.connect(alice).acquire(...params)
    const rcpt1 = await tx1.wait()
    expect(rcpt1.events.filter(e => e.event === 'Transfer').length).to.equal(9)

    const infos = await rouge.getTokenInfos(9)
    expect(infos.owner).to.equal(alice.address)
    expect(infos.channelId).to.equal(4)
    expect(infos.redeemed).to.equal(false)

    await expect(await rouge.balanceOf(alice.address)).to.equal(9)

    await expect(
      rouge.getTokenInfos(10)
    ).reverted
  })

  it('sound stamp/proof system', async () => {
    const { deployer, issuer, rouge, usdc, alice } = await loadFixture(standardEventFixature)

    const randomHash = ethers.utils.id(nanoid())
    expect(await rouge.validProof(getStamp(randomHash), randomHash)).to.equal(true)

    const proof = await calculateStampProof({
      contract: rouge,
      signer: alice,
      secret: nanoid(),
      salt: 42,
      index: 100,
    })
    expect(await rouge.validProof(getStamp(proof), proof)).to.equal(true)
  })

  it('issuer redeem using stamp proof', async () => {
    const { deployer, issuer, rouge, usdc, alice } = await loadFixture(standardRedemtionReadyFixature)

    const aliceProof = await calculateStampProof({
      contract: rouge,
      signer: alice,
      tokenId: 9,
      secret: 'rougetest'
    })

    const tx1 = await rouge.connect(issuer).redeem([
      // null certificate when not used
      [ 9, aliceProof, abiEncodeCertificate() ]
    ])

  })

  it('issuer redeem using a valid certificate', async () => {
    const { deployer, issuer, rouge, usdc, alice } = await loadFixture(standardRedemtionReadyFixature)

    const certificate = await generateCertificate({
      signer: alice,
      contract: rouge.address,
      tokenId: 9,
      selector: rouge.interface.getSighash('redeem')
    })
    expect(
      await rouge.isValidSignature(abiEncodeCertificate(certificate))
    ).to.equal(true)

    const tx1 = await rouge.connect(issuer).redeem([
      // null proof when not used
      [ 9, constants.HashZero, abiEncodeCertificate(certificate) ]
    ])

  })

  it('bearer redeem using a valid certificate', async () => {
    const { deployer, issuer, rouge, usdc, alice } = await loadFixture(standardRedemtionReadyFixature)

    const certificate = await generateCertificate({
      signer: issuer,
      contract: rouge.address,
      tokenId: 9,
      selector: rouge.interface.getSighash('redeem')
    })
    expect(
      await rouge.isValidSignature(abiEncodeCertificate(certificate))
    ).to.equal(true)

    const tx1 = await rouge.connect(alice).redeem([
      // null proof when not used
      [ 9, constants.HashZero, abiEncodeCertificate(certificate) ]
    ])

  })



})
