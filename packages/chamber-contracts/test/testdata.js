const {
  utils
} = require('ethers')

const BigNumber = utils.BigNumber

const {
  Block,
  Segment,
  SumMerkleTree,
  SumMerkleTreeNode,
  TransferTransaction,
  SwapTransaction,
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
const segment3 = new Segment(
  utils.bigNumberify('500000'),
  utils.bigNumberify('1000000'))
const segment4 = new Segment(
  utils.bigNumberify('3000000'),
  utils.bigNumberify('3100000'))
const segment5 = new Segment(
  utils.bigNumberify('3100000'),
  utils.bigNumberify('3200000'))
    

/*
 * 1->3->4-x>5
 */
function scenario1() {
  // deposits
  const blkNum1 = utils.bigNumberify('3')
  const blkNum2 = utils.bigNumberify('5')
  // transactinos
  const blkNum3 = utils.bigNumberify('6')
  const blkNum4 = utils.bigNumberify('8')
  const blkNum5 = utils.bigNumberify('10')
  const block3 = new Block(6)
  const block4 = new Block(8)
  const block5 = new Block(10)
  const block6 = new Block(12)

  const tx31 = new TransferTransaction(AliceAddress, segment1, blkNum1, BobAddress)
  const tx32 = new TransferTransaction(User4Address, segment2, blkNum2, User5Address)

  const tx41 = new TransferTransaction(BobAddress, segment1, blkNum3, AliceAddress)
  const tx42 = new TransferTransaction(User5Address, segment2, blkNum3, User4Address)

  const tx51 = new TransferTransaction(User5Address, segment1, blkNum4, OperatorAddress)
  const tx52 = new TransferTransaction(User4Address, segment2, blkNum4, User5Address)

  const tx61 = new TransferTransaction(User5Address, segment3, blkNum1, OperatorAddress)
  const tx62 = new TransferTransaction(User5Address, segment2, blkNum4, User4Address)

  const tx71 = new SwapTransaction(
    User4Address, segment4, blkNum1, OperatorAddress, segment5, blkNum2)

  block3.appendTx(tx31)
  block3.appendTx(tx32)

  block4.appendTx(tx41)
  block4.appendTx(tx42)

  block5.appendTx(tx51)
  block5.appendTx(tx52)

  block6.appendTx(tx61)
  block6.appendTx(tx62)

  const tree3 = block3.createTree()
  const tree4 = block4.createTree()
  const tree5 = block5.createTree()
  const tree6 = block6.createTree()

  const signedTx31 = new SignedTransactionWithProof(
    tx31,
    block3.getRoot(),
    block3.getProof(tx31.hash()))
  signedTx31.sign(AlicePrivateKey)
  const signedTx32 = new SignedTransactionWithProof(
    tx32,
    block3.getRoot(),
    block3.getProof(tx32.hash()))
  signedTx32.sign(User4PrivateKey)

  const signedTx41 = new SignedTransactionWithProof(
    tx41,
    block4.getRoot(),
    block4.getProof(tx41.hash()))
  signedTx41.sign(BobPrivateKey)
  const signedTx42 = new SignedTransactionWithProof(
    tx42,
    block4.getRoot(),
    block4.getProof(tx42.hash()))
  signedTx42.sign(User5PrivateKey)

  const signedTx51 = new SignedTransactionWithProof(
    tx51,
    block5.getRoot(),
    block5.getProof(tx51.hash()))
  signedTx51.sign(User5PrivateKey)
  const signedTx52 = new SignedTransactionWithProof(
    tx52,
    block5.getRoot(),
    block5.getProof(tx52.hash()))
  signedTx52.sign(User4PrivateKey)

  const signedTx61 = new SignedTransactionWithProof(
    tx61,
    block6.getRoot(),
    block6.getProof(tx61.hash()))
  signedTx61.sign(User5PrivateKey)
  const signedTx62 = new SignedTransactionWithProof(
    tx62,
    block6.getRoot(),
    block6.getProof(tx62.hash()))
  signedTx62.sign(User5PrivateKey)
  return {
    segments: [segment1, segment2, segment3],
    blocks: [
      {
        block: block3,
        tree: tree3,
        transactions: [tx31, tx32],
        signedTransactions: [signedTx31, signedTx32]
      },{
        block: block4,
        tree: tree4,
        transactions: [tx41, tx42],
        signedTransactions: [signedTx41, signedTx42]
      },{
        block: block5,
        tree: tree5,
        transactions: [tx51, tx52],
        signedTransactions: [signedTx51, signedTx52]
      },{
        block: block6,
        tree: tree6,
        transactions: [tx61, tx62],
        signedTransactions: [signedTx61, signedTx62]
      }
    ]
  }
}

function scenario2() {
  // deposits
  const blkNum1 = utils.bigNumberify('3')
  const blkNum2 = utils.bigNumberify('5')
  // transactinos
  const blkNum3 = utils.bigNumberify('6')
  const blkNum4 = utils.bigNumberify('8')
  const block3 = new Block(6)
  const block4 = new Block(8)
  const block5 = new Block(10)

  const tx31 = new SwapTransaction(
    AliceAddress, segment4, blkNum1, OperatorAddress, segment5, blkNum2)
  const tx32 = new TransferTransaction(User4Address, segment2, blkNum2, User5Address)
  const tx41 = new TransferTransaction(OperatorAddress, segment4, blkNum3, OperatorAddress)
  const tx42 = new TransferTransaction(OperatorAddress, segment5, blkNum3, OperatorAddress)
  
  block3.appendTx(tx31)
  block3.appendTx(tx32)

  block4.appendTx(tx41)
  block4.appendTx(tx42)

  const tree3 = block3.createTree()
  const tree4 = block4.createTree()

  const signedTx31 = new SignedTransactionWithProof(
    tx31,
    block3.getRoot(),
    block3.getProof(tx31.hash()))
  signedTx31.sign(AlicePrivateKey)
  signedTx31.sign(OperatorPrivateKey)
  signedTx31.confirmMerkleProofs(AlicePrivateKey)
  signedTx31.confirmMerkleProofs(OperatorPrivateKey)
  const signedTx31NotEnough = new SignedTransactionWithProof(
    tx31,
    block3.getRoot(),
    block3.getProof(tx31.hash()))
  signedTx31NotEnough.sign(AlicePrivateKey)
  signedTx31NotEnough.sign(OperatorPrivateKey)
  signedTx31NotEnough.confirmMerkleProofs(AlicePrivateKey)

  const signedTx32 = new SignedTransactionWithProof(
    tx32,
    block3.getRoot(),
    block3.getProof(tx32.hash()))
  signedTx32.sign(User4PrivateKey)

  const signedTx41 = new SignedTransactionWithProof(
    tx41,
    block4.getRoot(),
    block4.getProof(tx41.hash()))
  signedTx41.sign(OperatorPrivateKey)
  const signedTx42 = new SignedTransactionWithProof(
    tx42,
    block4.getRoot(),
    block4.getProof(tx42.hash()))
  signedTx42.sign(OperatorPrivateKey)

  return {
    segments: [segment1, segment2, segment3, segment4, segment5],
    blocks: [
      {
        block: block3,
        tree: tree3,
        transactions: [tx31, tx32],
        signedTransactions: [signedTx31, signedTx32],
        testTxs: [signedTx31NotEnough]
      },{
        block: block4,
        tree: tree4,
        transactions: [tx41, tx42],
        signedTransactions: [signedTx41, signedTx42]
      }
    ]
  }
}

module.exports = {
  Scenario1: scenario1(),
  Scenario2: scenario2()
}
