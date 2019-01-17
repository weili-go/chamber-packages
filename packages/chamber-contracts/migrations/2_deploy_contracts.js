const RootChain = artifacts.require("Rootchain")

module.exports = (deployer) => {
  deployer.deploy(RootChain)
}
