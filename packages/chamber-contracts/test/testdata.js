/**
 * test data generator
 */
const {
  constants,
  utils
} = require('ethers')

const {
  Block,
  DepositTransaction,
  Segment,
  TransferTransaction,
  SplitTransaction,
  MergeTransaction,
  SwapTransaction,
  SignedTransaction
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
    
function createTransfer(privKey, from, seg, blkNum, to) {
  const tx= new SignedTransaction(new TransferTransaction(from, seg, blkNum, to))
  tx.sign(privKey)
  return tx
}

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

  const depositTx1 = new DepositTransaction(AliceAddress, constants.AddressZero, segment1)
  const depositTx2 = new DepositTransaction(BobAddress, constants.AddressZero, segment2)
  const tx31 = createTransfer(AlicePrivateKey, AliceAddress, segment1, blkNum1, BobAddress)
  const tx32 = createTransfer(User4PrivateKey, User4Address, segment2, blkNum2, User5Address)
  const tx41 = createTransfer(BobPrivateKey, BobAddress, segment1, blkNum3, AliceAddress)
  const tx42 = createTransfer(User5PrivateKey, User5Address, segment2, blkNum3, User4Address)
  const tx51 = createTransfer(User5PrivateKey, User5Address, segment1, blkNum4, OperatorAddress)
  const tx52 = createTransfer(User4PrivateKey, User4Address, segment2, blkNum4, User5Address)
  const tx61 = createTransfer(User5PrivateKey, User5Address, segment3, blkNum1, OperatorAddress)
  const tx62 = createTransfer(User5PrivateKey, User5Address, segment2, blkNum4, User4Address)
  
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

  const signedTx31 = block3.getSignedTransactionWithProof(tx31.hash())[0]
  const signedTx32 = block3.getSignedTransactionWithProof(tx32.hash())[0]
  const signedTx41 = block4.getSignedTransactionWithProof(tx41.hash())[0]
  const signedTx42 = block4.getSignedTransactionWithProof(tx42.hash())[0]
  const signedTx51 = block5.getSignedTransactionWithProof(tx51.hash())[0]
  const signedTx52 = block5.getSignedTransactionWithProof(tx52.hash())[0]
  const signedTx61 = block6.getSignedTransactionWithProof(tx61.hash())[0]
  const signedTx62 = block6.getSignedTransactionWithProof(tx62.hash())[0]

  return {
    segments: [segment1, segment2, segment3],
    deposits: [depositTx1, depositTx2],
    blocks: [
      {
        block: block3,
        tree: tree3,
        transactions: [tx31, tx32],
        signedTransactions: [signedTx31, signedTx32],
        operatorSignes: [signedTx31.signedTx.justSign(OperatorPrivateKey)]
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

  const tx31 = new SignedTransaction(new SwapTransaction(
    AliceAddress, segment4, blkNum1, OperatorAddress, segment5, blkNum2))
  tx31.sign(AlicePrivateKey)
  tx31.sign(OperatorPrivateKey)
  const tx32 = createTransfer(User4PrivateKey, User4Address, segment2, blkNum2, User5Address)
  const tx41 = createTransfer(OperatorPrivateKey, OperatorAddress, segment4, blkNum3, OperatorAddress)
  const tx42 = createTransfer(OperatorPrivateKey, OperatorAddress, segment5, blkNum3, OperatorAddress)

  block3.appendTx(tx31)
  block3.appendTx(tx32)
  block4.appendTx(tx41)
  block4.appendTx(tx42)

  const tree3 = block3.createTree()
  const tree4 = block4.createTree()

  const signedTx31 = block3.getSignedTransactionWithProof(tx31.hash())[1]
  signedTx31.confirmMerkleProofs(AlicePrivateKey)
  signedTx31.confirmMerkleProofs(OperatorPrivateKey)

  const signedTx31NotEnough = block3.getSignedTransactionWithProof(tx31.hash())[1]
  signedTx31NotEnough.confirmMerkleProofs(AlicePrivateKey)

  const signedTx32 = block3.getSignedTransactionWithProof(tx32.hash())[0]

  const signedTx41 = block4.getSignedTransactionWithProof(tx41.hash())[0]
  const signedTx42 = block4.getSignedTransactionWithProof(tx42.hash())[0]

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

/*
 * fast finality scenario
 */
function scenario3() {
  // deposits
  const blkNum1 = utils.bigNumberify('3')
  const blkNum2 = utils.bigNumberify('5')
  // transactinos
  const blkNum3 = utils.bigNumberify('6')
  const blkNum4 = utils.bigNumberify('8')
  const block3 = new Block(6)
  const block4 = new Block(8)
  const block5 = new Block(10)

  const tx31 = new SignedTransaction(new SplitTransaction(AliceAddress, segment1, blkNum2, AliceAddress, BobAddress, utils.bigNumberify('500000')))
  tx31.sign(AlicePrivateKey)
  const tx32 = createTransfer(User4PrivateKey, User4Address, segment2, blkNum2, User5Address)
  const tx41 = new SignedTransaction(new SplitTransaction(AliceAddress, segment1, blkNum2, AliceAddress, OperatorAddress, utils.bigNumberify('500000')))
  tx41.sign(AlicePrivateKey)
  const tx42 = createTransfer(OperatorPrivateKey, OperatorAddress, segment5, blkNum3, OperatorAddress)
  
  block3.appendTx(tx31)
  block3.appendTx(tx32)
  block4.appendTx(tx41)
  block4.appendTx(tx42)

  const tree3 = block3.createTree()
  const tree4 = block4.createTree()

  const signedTx31 = block3.getSignedTransactionWithProof(tx31.hash())
  const signedTx32 = block3.getSignedTransactionWithProof(tx32.hash())[0]
  const signedTx41 = block4.getSignedTransactionWithProof(tx41.hash())
  const signedTx42 = block4.getSignedTransactionWithProof(tx42.hash())[0]

  return {
    segments: [segment1, segment2, segment3, segment4, segment5],
    blocks: [
      {
        block: block3,
        tree: tree3,
        transactions: [tx31, tx32],
        signedTransactions: [signedTx31, signedTx32],
        operatorSignes: [signedTx31[1].signedTx.justSign(OperatorPrivateKey)]
      },{
        block: block4,
        tree: tree4,
        transactions: [tx41, tx42],
        signedTransactions: [signedTx41, signedTx42],
        operatorSignes: [signedTx41[1].signedTx.justSign(OperatorPrivateKey)]
      }
    ]
  }
}

/**
 * transactions
 */
function transactions() {
  const segment4 = new Segment(
    utils.bigNumberify('3000000'),
    utils.bigNumberify('3100000'))
  const segment5 = new Segment(
    utils.bigNumberify('3100000'),
    utils.bigNumberify('3200000'))
  const segment45 = new Segment(
    utils.bigNumberify('3000000'),
    utils.bigNumberify('3200000'))
  
    
  const blkNum1 = utils.bigNumberify('3')
  const blkNum2 = utils.bigNumberify('5')
  const block = new Block(6)

  const tx = createTransfer(AlicePrivateKey, AliceAddress, segment1, blkNum1, BobAddress)
  const invalidTx = createTransfer(OperatorPrivateKey, AliceAddress, segment2, blkNum2, BobAddress)
  const mergeTx = new SignedTransaction(new MergeTransaction(AliceAddress, segment4, segment5, blkNum1, blkNum2, BobAddress))
  mergeTx.sign(AlicePrivateKey)
  
  block.appendTx(tx)
  block.appendTx(invalidTx)
  block.appendTx(mergeTx)
  
  const includedTx = block.getSignedTransactionWithProof(tx.hash())[0]
  const includedInvalidTx = block.getSignedTransactionWithProof(invalidTx.hash())[0]
  const includedMergeTx = block.getSignedTransactionWithProof(mergeTx.hash())[0]

  return {
    segments: [segment1, segment2, segment3, segment4, segment5],
    segment45: segment45,
    tx: includedTx,
    invalidTx: includedInvalidTx,
    mergeTx: includedMergeTx
  }
}

module.exports = {
  Scenario1: scenario1(),
  Scenario2: scenario2(),
  Scenario3: scenario3(),
  transactions: transactions()
}
