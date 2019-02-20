const ERC721 = artifacts.require("ERC721")
const RootChain = artifacts.require("RootChain")
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const EscrowVerifier = artifacts.require("EscrowVerifier")
const FastFinality = artifacts.require("FastFinality")

module.exports = (deployer) => {
  let rootChain
  let fastFinality
  deployer.deploy(ERC721)
  .then(() => deployer.deploy(StandardVerifier))
  .then(() => deployer.deploy(EscrowVerifier))
  .then(() => deployer.deploy(MultisigVerifier))
  .then(() => deployer.deploy(
    TransactionVerifier,
    StandardVerifier.address,
    MultisigVerifier.address,
    EscrowVerifier.address
  ))
  .then(() => deployer.deploy(
    RootChain,
    TransactionVerifier.address,
    ERC721.address
  ))
  .then((_rootChain) => {
    rootChain = _rootChain
    return rootChain.setup()
  })
  .then(() => deployer.deploy(
      FastFinality,
      RootChain.address,
      TransactionVerifier.address,
      ERC721.address
  ))
  .then((_fastFinality) => {
    fastFinality = _fastFinality
    return rootChain.getTokenAddress.call()
  })
  .then((exitNFT) => {
    console.log('exitNFT', exitNFT)
    return fastFinality.getTokenAddress.call()
  })
  .then((ffNFT) => {
    console.log('ffNFT', ffNFT)
  })
}
