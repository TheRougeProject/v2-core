// SPDX-License-Identifier: AGPL-3.0
// domain for on chain validation (not Springbok)

export const eip712DomainByChain = chainId => ({
  name: 'Rouge',
  version: '1',
  chainId: parseInt(chainId)
})
