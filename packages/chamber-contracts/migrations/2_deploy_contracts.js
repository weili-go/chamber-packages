const RootChain = artifacts.require("RootChain")

module.exports = (deployer) => {
  deployer.deploy(RootChain)
}
