const {
  utils
} = require('ethers')

const BigNumber = utils.BigNumber

const {
  Segment,
  SumMerkleTree,
  SumMerkleTreeNode,
  TransferTransaction,
  SignedTransaction,
  SignedTransactionWithProof
} = require('@layer2/core')


const AlicePrivateKey = '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3'
const BobPrivateKey = '0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f'
const OperatorPrivateKey = '0x0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1'
const User4PrivateKey = '0xc88b703fb08cbea894b6aeff5a544fb92e78a18e19814cd85da83b71f772aa6c'
const User5PrivateKey = '0x388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418'


const AliceAddress = utils.computeAddress(AlicePrivateKey)
const BobAddress = utils.computeAddress(BobPrivateKey)
const OperatorAddress = utils.computeAddress(OperatorPrivateKey)
const User4Address = utils.computeAddress(User4PrivateKey)
const User5Address = utils.computeAddress(User5PrivateKey)

const segment1 = new Segment(
  utils.bigNumberify('0'),
  utils.bigNumberify('1000000'))
const segment2 = new Segment(
  utils.bigNumberify('1000000'),
  utils.bigNumberify('2000000'))
  
const blkNum = utils.bigNumberify('1')


const tx11 = new TransferTransaction(AliceAddress, segment1, blkNum, BobAddress)
const tx12 = new TransferTransaction(User4Address, segment2, blkNum, User5Address)

const leaves = []
leaves[0] = new SumMerkleTreeNode(
  tx11.hash(),
  new BigNumber(1000000)
);
leaves[1] = new SumMerkleTreeNode(
  tx12.hash(),
  new BigNumber(1000000)
);
const tree = new SumMerkleTree(leaves)
const signedTx11 = new SignedTransactionWithProof(
  tx11,
  tree.proof(leaves[0]))
signedTx11.sign(AlicePrivateKey)
const signedTx12 = new SignedTransactionWithProof(
  tx12,
  tree.proof(leaves[1]))
signedTx12.sign(User4PrivateKey)

module.exports = {
  Scenario1: {
    segments: [segment1, segment2],
    transactions: [tx11, tx12],
    signedTransactions: [signedTx11, signedTx12],
    leaves: leaves,
    tree: new SumMerkleTree(leaves)
  }
}
