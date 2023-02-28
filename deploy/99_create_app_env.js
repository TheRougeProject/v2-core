
import dotenv from 'dotenv'

import hre from 'hardhat'

import { writeEnv } from '../lib/deploy-helpers.js'

const deploy = async ({ getChainId, getNamedAccounts, deployments }) => {

  const chainId = await getChainId()

  const { get } = deployments

  const singleton = await get('Rouge')
  const factory = await get('RougeProxyFactory')

  const tokens = hre.network.config.tokens || {}

  await writeEnv(`.env`, {
    ...dotenv.config().parsed,
    [`VITE_FALLBACK_PROVIDER_${chainId}`]: hre.network.config.url,
    [`VITE_ASSET_TOKENS_${chainId}`]: JSON.stringify(tokens),
  })

}

export default deploy

export const tags = []
