// deploy RLPDecoder

const ethers = require('ethers');
const utils = require("ethereumjs-util");
const assert = require('assert');
const bytecodes = require('./bytescodes.json')

const url = process.argv[2]
const privateKey = process.argv[3]

const httpProvider = new ethers.providers.JsonRpcProvider(url)
const wallet = new ethers.Wallet(privateKey, httpProvider)


deployContracts().then(() => {
  console.log('deployed contracts!!')
}).catch(e => {
  console.error(2, e)
})

async function deployContracts() {
  const MigrationsFactory = new ethers.ContractFactory([
    'function setCompleted(uint256 completed)'
  ], bytecodes.Migrations, wallet);
  const ERC721Factory = new ethers.ContractFactory([], bytecodes.ERC721, wallet);
  const StandardVerifierFactory = new ethers.ContractFactory([], bytecodes.StandardVerifier, wallet);
  const EscrowVerifierFactory = new ethers.ContractFactory([], bytecodes.EscrowVerifier, wallet);
  const MultisigVerifierFactory = new ethers.ContractFactory([], bytecodes.MultisigVerifier, wallet);
  const TransactionVerifierFactory = new ethers.ContractFactory([
    'constructor(address _stdverifier, address _multisig, address _escrow)'
  ], bytecodes.TransactionVerifier, wallet);
  const RootChainFactory = new ethers.ContractFactory([
    'constructor(address _txverifierAddress)',
    'function listToken(address tokenAddress, uint256 denomination)'
  ], bytecodes.RootChain, wallet);
  const FastFinalityFactory = new ethers.ContractFactory([
    'constructor(address _rootchain, address _txverifier)'

  ], bytecodes.FastFinality, wallet);

  const migrationsContract = await MigrationsFactory.deploy()
  await migrationsContract.deployed()
  await migrationsContract.setCompleted(0)
  const erc721Contract = await ERC721Factory.deploy()
  const standardVerifierContract = await StandardVerifierFactory.deploy()
  const escrowVerifierContract = await EscrowVerifierFactory.deploy()
  const multisigVerifierContract = await MultisigVerifierFactory.deploy()
  const transactionVerifierContract = await TransactionVerifierFactory.deploy(
    standardVerifierContract.address,
    escrowVerifierContract.address,
    multisigVerifierContract.address
  )
  const rootChainContract = await RootChainFactory.deploy(
    transactionVerifierContract.address,
    erc721Contract.address
  )
  const fastFinalityContract = await FastFinalityFactory.deploy(
    rootChainContract.address,
    transactionVerifierContract.address
  )
  console.log('Migrations', migrationsContract.address)
  console.log('StandardVerifier', standardVerifierContract.address)
  console.log('EscrowVerifier', escrowVerifierContract.address)
  console.log('MultisigVerifier', multisigVerifierContract.address)
  console.log('TransactionVerifier', transactionVerifierContract.address)
  console.log('RootChain', rootChainContract.address)
  console.log('FastFinality', fastFinalityContract.address)
  await rootChainContract.deployed()
  await rootChainContract.listToken(
    ethers.constants.AddressZero,
    ethers.utils.bigNumberify('1000000000')
  )
}
