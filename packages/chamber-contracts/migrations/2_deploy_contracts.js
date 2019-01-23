const RootChain = artifacts.require("RootChain")
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const FastFinality = artifacts.require("FastFinality")

module.exports = (deployer) => {
  deployer.deploy(StandardVerifier)
  .then(() => deployer.deploy(MultisigVerifier))
  .then(() => deployer.deploy(
    TransactionVerifier,
    StandardVerifier.address,
    MultisigVerifier.address
  ))
  .then(() => deployer.deploy(
    RootChain,
    TransactionVerifier.address
  ))
  .then(() => deployer.deploy(
    FastFinality,
    RootChain.address,
    TransactionVerifier.address
  ))
}
