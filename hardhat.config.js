require('@babel/register')()

const dotenv = require('dotenv')

require("@nomiclabs/hardhat-ethers")
require('@nomiclabs/hardhat-waffle')
require('hardhat-gas-reporter')
require('hardhat-deploy')

dotenv.config()
dotenv.config({ path: '.server.env' })

const fs = require('fs')

const mnemonic = fs.readFileSync(".mnemonic").toString().trim()
const deployer = fs.readFileSync(".deployer").toString().trim()

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
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      'arb-nova': deployer
    },
    // pool:{
    //   default: 1, // here this will by default take the second account
    // }
  },
  networks: {
    hardhat: {
      //initialBaseFeePerGas: 0, // workaround from https://github.com/sc-forks/>
      // forking: { url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`, }
    },
    // main nets
    'arb-nova': {
      url: 'https://nova.arbitrum.io/rpc',
      tokens: {
        'USDC': '0x750ba8b76187092b0d1e87e28daaf484d1b5273b',
        'XDAI': '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
      }
    },
    'optimism': {
      url: '',
      tokens: {
        'USDC': '',
        'XDAI': '',
      }
    },
    // test nets
    'geth': {
      targets: [ 'test' ],
      url: 'http://127.0.0.1:8545/',
      createTestSet: true,
      accounts: { mnemonic },
      tags: ["xxx", "local"]
    },
    gor: {
      targets: [ 'staging', 'production' ],
      tokens: {
        'USDC': '0xFA37fC3840C6E4A591D43f15160c9aeC70db57c7',
      },
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: { mnemonic },
    },
    'arb-goerli': {
      url: `https://goerli-rollup.arbitrum.io/rpc`,
      accounts: { mnemonic },
      tags: ["xxx", "test"]
    },
    'basegor': {
      url: `https://base-goerli.infura.io/v3/${process.env.BASE_INFURA_KEY}`,
      accounts: { mnemonic },
    },
    'metis-stardust': {
      tokens: {
        'USDC': '0xFA37fC3840C6E4A591D43f15160c9aeC70db57c7',
      },
      url: 'https://stardust.metis.io/?owner=588',
      accounts: { mnemonic },
    },
    mainnet: {
      tokens: {
        'USDC': 'TODO',
      },
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
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
