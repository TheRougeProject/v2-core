
const deploy = async ({getNamedAccounts, deployments}) => {

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  // const balance = await provider.getBalance(deployer.address)
  // console.log('deployer is ', deployer.address, balance)

  const singleton = await deploy('Rouge', {
    from: deployer,
    args: [],
    log: true,
  })

  const factory = await deploy('RougeProxyFactory', {
    from: deployer,
    args: [],
    log: true,
  })

}

export default deploy

export const tags = ['Rouge', 'RougeProxyFactory']
