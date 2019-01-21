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

/*
 * 1->3->4-x>5
 */

// deposits
const blkNum1 = utils.bigNumberify('3')
const blkNum2 = utils.bigNumberify('5')
// transactinos
const blkNum3 = utils.bigNumberify('6')
const blkNum4 = utils.bigNumberify('8')
const blkNum5 = utils.bigNumberify('10')

const tx31 = new TransferTransaction(AliceAddress, segment1, blkNum1, BobAddress)
const tx32 = new TransferTransaction(User4Address, segment2, blkNum2, User5Address)

const tx41 = new TransferTransaction(BobAddress, segment1, blkNum3, AliceAddress)
const tx42 = new TransferTransaction(User5Address, segment2, blkNum3, User4Address)

const tx51 = new TransferTransaction(User5Address, segment1, blkNum4, OperatorAddress)
const tx52 = new TransferTransaction(User4Address, segment2, blkNum4, User5Address)


const leaves3 = [
  new SumMerkleTreeNode(
    tx31.hash(),
    new BigNumber(1000000)
  ),
  new SumMerkleTreeNode(
    tx32.hash(),
    new BigNumber(1000000)
  )
]
const tree3 = new SumMerkleTree(leaves3)

const leaves4 = [
  new SumMerkleTreeNode(
    tx41.hash(),
    new BigNumber(1000000)
  ),
  new SumMerkleTreeNode(
    tx42.hash(),
    new BigNumber(1000000)
  )
]
const tree4 = new SumMerkleTree(leaves4)

const leaves5 = [
  new SumMerkleTreeNode(
    tx51.hash(),
    new BigNumber(1000000)
  ),
  new SumMerkleTreeNode(
    tx52.hash(),
    new BigNumber(1000000)
  )
]
const tree5 = new SumMerkleTree(leaves5)

const signedTx31 = new SignedTransactionWithProof(
  tx31,
  tree3.proof(leaves3[0]))
signedTx31.sign(AlicePrivateKey)
const signedTx32 = new SignedTransactionWithProof(
  tx32,
  tree3.proof(leaves3[1]))
signedTx32.sign(User4PrivateKey)

const signedTx41 = new SignedTransactionWithProof(
  tx41,
  tree4.proof(leaves4[0]))
signedTx41.sign(BobPrivateKey)
const signedTx42 = new SignedTransactionWithProof(
  tx42,
  tree4.proof(leaves4[1]))
signedTx42.sign(User5PrivateKey)

const signedTx51 = new SignedTransactionWithProof(
  tx51,
  tree5.proof(leaves5[0]))
signedTx51.sign(User5PrivateKey)
const signedTx52 = new SignedTransactionWithProof(
  tx52,
  tree5.proof(leaves5[1]))
signedTx52.sign(User4PrivateKey)

module.exports = {
  Scenario1: {
    segments: [segment1, segment2],
    blocks: [
      {
        tree: tree3,
        transactions: [tx31, tx32],
        signedTransactions: [signedTx31, signedTx32]
      },{
        tree: tree4,
        transactions: [tx41, tx42],
        signedTransactions: [signedTx41, signedTx42]
      },{
        tree: tree5,
        transactions: [tx51, tx52],
        signedTransactions: [signedTx51, signedTx52]
      }
    ]
  }
}
