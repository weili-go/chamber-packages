// deploy RLPDecoder

const ethers = require('ethers');
const utils = require("ethereumjs-util");
const assert = require('assert');
const bytecodes = require('./bytescodes.json')

const url = process.argv[2]
const privateKey = process.argv[3]

const httpProvider = new ethers.providers.JsonRpcProvider(url)
const wallet = new ethers.Wallet(privateKey, httpProvider)


deployRLPDecoder().then(() => {
  console.log('deployed RLP decoder!!')
  return deployContracts()
}).then(() => {
  console.log('deployed contracts!!')
}).catch(e => {
  console.error(2, e)
})

// ref: https://github.com/ethereum/vyper/blob/master/tests/parser/functions/rlp/conftest.py#L15-L20
async function deployRLPDecoder() {
  const deployTx = "0xf9035b808506fc23ac0083045f788080b903486103305660006109ac5260006109cc527f0100000000000000000000000000000000000000000000000000000000000000600035046109ec526000610a0c5260006109005260c06109ec51101515585760f86109ec51101561006e5760bf6109ec510336141558576001610a0c52610098565b60013560f76109ec51036020035260005160f66109ec510301361415585760f66109ec5103610a0c525b61022060016064818352015b36610a0c511015156100b557610291565b7f0100000000000000000000000000000000000000000000000000000000000000610a0c5135046109ec526109cc5160206109ac51026040015260016109ac51016109ac5260806109ec51101561013b5760016109cc5161044001526001610a0c516109cc5161046001376001610a0c5101610a0c5260216109cc51016109cc52610281565b60b86109ec5110156101d15760806109ec51036109cc51610440015260806109ec51036001610a0c51016109cc51610460013760816109ec5114156101ac5760807f01000000000000000000000000000000000000000000000000000000000000006001610a0c5101350410151558575b607f6109ec5103610a0c5101610a0c5260606109ec51036109cc51016109cc52610280565b60c06109ec51101561027d576001610a0c51013560b76109ec510360200352600051610a2c526038610a2c5110157f01000000000000000000000000000000000000000000000000000000000000006001610a0c5101350402155857610a2c516109cc516104400152610a2c5160b66109ec5103610a0c51016109cc516104600137610a2c5160b66109ec5103610a0c510101610a0c526020610a2c51016109cc51016109cc5261027f565bfe5b5b5b81516001018083528114156100a4575b5050601f6109ac511115155857602060206109ac5102016109005260206109005103610a0c5261022060016064818352015b6000610a0c5112156102d45761030a565b61090051610a0c516040015101610a0c51610900516104400301526020610a0c5103610a0c5281516001018083528114156102c3575b50506109cc516109005101610420526109cc5161090051016109005161044003f35b61000461033003610004600039610004610330036000f31b2d4f"
  const RLP_DECODER_ADDRESS = '0x5185D17c44699cecC3133114F8df70753b856709'
  await wallet.sendTransaction({
    to: "0x39ba083c30fCe59883775Fc729bBE1f9dE4DEe11",
    value: 10 ** 17,
    gasLimit: 200000
  })

  const receipt = await httpProvider.sendTransaction(deployTx)
  const txResult = await httpProvider.getTransaction(receipt.hash)
  const rlpDecoderAddr = utils.toChecksumAddress(txResult.creates)
  assert(rlpDecoderAddr == RLP_DECODER_ADDRESS);
}

async function deployContracts() {
  const MigrationsFactory = new ethers.ContractFactory([
    'function setCompleted(uint256 completed)'
  ], bytecodes.Migrations, wallet);
  const StandardVerifierFactory = new ethers.ContractFactory([], bytecodes.StandardVerifier, wallet);
  const EscrowVerifierFactory = new ethers.ContractFactory([], bytecodes.EscrowVerifier, wallet);
  const MultisigVerifierFactory = new ethers.ContractFactory([], bytecodes.MultisigVerifier, wallet);
  const TransactionVerifierFactory = new ethers.ContractFactory([
    'constructor(address _stdverifier, address _multisig, address _escrow)'
  ], bytecodes.TransactionVerifier, wallet);
  const RootChainFactory = new ethers.ContractFactory([
    'constructor(address _txverifierAddress)'
  ], bytecodes.RootChain, wallet);
  const FastFinalityFactory = new ethers.ContractFactory([
    'constructor(address _rootchain, address _txverifier)'

  ], bytecodes.FastFinality, wallet);

  const migrationsContract = await MigrationsFactory.deploy()
  await migrationsContract.deployed()
  await migrationsContract.setCompleted(0)
  const standardVerifierContract = await StandardVerifierFactory.deploy()
  const escrowVerifierContract = await EscrowVerifierFactory.deploy()
  const multisigVerifierContract = await MultisigVerifierFactory.deploy()
  const transactionVerifierContract = await TransactionVerifierFactory.deploy(
    standardVerifierContract.address,
    escrowVerifierContract.address,
    multisigVerifierContract.address
  )
  const rootChainContract = await RootChainFactory.deploy(
    transactionVerifierContract.address
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
}
