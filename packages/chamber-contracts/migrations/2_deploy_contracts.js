const RootChain = artifacts.require("RootChain")
const TransactionVerifier = artifacts.require("TransactionVerifier")

module.exports = (deployer) => {
  deployer.deploy(TransactionVerifier)
  .then(() => deployer.deploy(
      RootChain
  ))
}
