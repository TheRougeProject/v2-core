require('@babel/register')()

const dotenv = require('dotenv')

require("@nomiclabs/hardhat-ethers")
require('@nomiclabs/hardhat-waffle')
require('hardhat-gas-reporter')

dotenv.config()
dotenv.config({ path: '.server.env' })

const fs = require('fs')

const mnemonic = fs.readFileSync(".mnemonic").toString().trim()
const deployer = fs.readFileSync(".deployer").toString().trim()

const HashOne = "0x0000000000000000000000000000000000000000000000000000000000000001"
const HashTwo = "0x0000000000000000000000000000000000000000000000000000000000000002"

// Go to https://hardhat.org/config/ to learn more
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 3000
      }
    }
  },
  networks: {
    hardhat: {
      //initialBaseFeePerGas: 0, // workaround from https://github.com/sc-forks/>
      // forking: { url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`, }
    },
    // main nets
    'arb-nova': {
      url: 'https://nova.arbitrum.io/rpc',
      usdcAddress: '0x750ba8b76187092b0d1e87e28daaf484d1b5273b',
      xdaiAddress: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
      accounts: [ HashOne, HashTwo, deployer ]
    },
    // test nets
    'cennz-old': {
      targets: [ 'test' ],
      url: 'http://127.0.0.1:8545/',
      createTestSet: true,
      accounts: { mnemonic },
    },
    gor: {
      targets: [ 'staging', 'production' ],
      usdcAddress: '0xFA37fC3840C6E4A591D43f15160c9aeC70db57c7',
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: { mnemonic },
    },
    'arb-goerli': {
      targets: [ 'test' ],
      url: `https://goerli-rollup.arbitrum.io/rpc`,
      accounts: { mnemonic },
    },
    'metis-stardust': {
      targets: [ 'staging', 'production' ],
      usdcAddress: '0xFA37fC3840C6E4A591D43f15160c9aeC70db57c7',
      url: 'https://stardust.metis.io/?owner=588',
      accounts: { mnemonic },
    },
    mainnet: {
      usdcAddress: '0xxxxxxxxxxx',
      url: `https://mainnet.infura.io/v3/${process.env.VITE_INFURA_KEY}`,
      //accounts: [ deployer ],
      //gasPrice: 50 * 1e9,
      maxFeePerGas: 65 * 1e9
      //You sent both gasPrice, and maxFeePerGas or maxPriorityFeePerGas
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
}
