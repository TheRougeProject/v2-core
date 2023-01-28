
import { ethers, waffle } from 'hardhat'

import { expect } from 'chai'
import { Token, TokenAmount, TokenAmountSet } from '../lib/Token'
import { expandToNDecimals } from '../lib/ethers'

const { utils, constants, BigNumber } = ethers

// const USDToken = { decimals: 6, address: USDCAddress, symbol: 'USDC' }
// const ETHToken = { decimals: 18, symbol: 'ETH', formatSymbol: constants.EtherSymbol } // +

let usdc, uni, ethToken

describe("Token", function () {

  it("deploy", async function () {
    const [ alice, bob, carol, dave, deployer ] = await ethers.getSigners()

    const TestERC20 = await ethers.getContractFactory("TestERC20")
    usdc = await TestERC20.deploy(
      expandToNDecimals(5, 9 + 6), // 5 billions
      "USDC Test",
      "USDC",
      6
    )
    await usdc.deployed()

    const usdcToken = await Token.from({
      chainId: 6,
      address: usdc.address,
      decimals: 6,
      symbol: 'USDC'
    })
    //console.log( usdcToken )

    uni = await TestERC20.connect(deployer).deploy(
      expandToNDecimals(1, 9 + 18), // 1 billion
      "Uniswap Test",
      "UNI",
      18
    )
    await uni.deployed()
    const uniToken = await Token.from(uni)

    const usdcToken2 = await Token.from(usdc, { chainId: 6 })
    //console.log( usdcToken2 )


    ethToken = await Token.native(
      { decimals: 18, symbol: 'Ether', symbol: 'ETH', formatSymbol: constants.EtherSymbol }
    )
    //console.log( ethToken )


  })

})


describe("TokenERC20Amount", function () {

  it("xxx", async function () {

    const usdcToken = await Token.from(usdc, { chainId: 6 })

    const amount1 = await TokenAmount.from(usdcToken, 11111)
    //console.log( amount1 )
    //console.log( amount1+'' )


    const amount2 = usdcToken.newAmount( 0.01 )
    //console.log( amount2 )
    //console.log( amount2+'' )


    const amount3 = ethToken.newAmount(1, 15)
    //console.log( amount3 )
    //console.log( amount3+'' )

    // console.log( '*2     => ' + amount3.mul(2)     )
    // console.log( '+1     => ' + amount3.add(1)     )
    // console.log( '-0.001 => ' + amount3.sub(0.001) )
    // console.log( 'gt 0   => ' + amount3.gt(0)    )
    // console.log( 'gt 2   => ' + amount3.gt(0.1)    )

    const amount4 = ethToken.newAmount(0)
    // console.log( 'gt 0   => ' + amount4.gt(0)    )


    const fromObject = {
      "token": {
        "type": "ERC20",
        "_isToken": true,
        "_isNative": false,
        "address": "0x3917C8B4358cE1167470CbE286f1c8096dc15d33",
        "chainId": 1337,
        "name": "USDC Test",
        "symbol": "USDC",
        "decimals": 6
      },
      "number": {
        "type": "BigNumber",
        "hex": "0x34edce00"
      },
      "_isTokenAmount": true
    }

    const amount5 = await TokenAmount.from(fromObject)

  })

})



describe("TokenAmountSet", function () {

  it("xxx", async function () {

    const usdcToken = await Token.from(usdc)
    const uniToken = await Token.from(uni)

    const set = await TokenAmountSet.from([])

    set.add( TokenAmount.from(usdcToken, 10) )
    set.add( TokenAmount.from(uniToken, 100) )

    set.add( TokenAmount.from(usdcToken, 2) )
    set.add( TokenAmount.from(uniToken, 45) )

    set.add( TokenAmount.from(ethToken, 2) )

    set.add( TokenAmount.from(usdcToken, 0.001) )
    set.add( TokenAmount.from(uniToken, 0.001) )
    set.add( TokenAmount.from(ethToken, 0.001) )

    set.add( TokenAmount.from(ethToken, 1) )
    set.add( TokenAmount.from(ethToken, BigNumber.from(42)) )

    // console.log( set )
    // console.log( set+'' )

    // test different chainId => shoudl throw

  })

})
