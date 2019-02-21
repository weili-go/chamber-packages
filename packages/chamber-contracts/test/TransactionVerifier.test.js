const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const EscrowVerifier = artifacts.require("EscrowVerifier")
const ethers = require('ethers')
const BigNumber = ethers.utils.BigNumber
const {
  assertRevert
} = require('./helpers/assertRevert')
const {
  transactions
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract("TransactionVerifier", ([alice, bob, operator, user4, user5, admin]) => {

  beforeEach(async () => {
    const standardVerifier = await StandardVerifier.new({ from: operator })
    this.standardVerifier = standardVerifier
    const multisigVerifier = await MultisigVerifier.new({ from: operator })
    const escrowVerifier = await EscrowVerifier.new({ from: operator })
    this.transactionVerifier = await TransactionVerifier.new(
      standardVerifier.address,
      multisigVerifier.address,
      escrowVerifier.address,
      {
        from: operator
      })
  });

  describe("TransferTransaction", () => {

    it("should be verified", async () => {
      const tx = transactions.tx
      const result = await this.transactionVerifier.verify(
        tx.getTxHash(),
        tx.merkleHash(),
        tx.getTxBytes(),
        tx.getSignatures(),
        0,
        0,
        ethers.constants.AddressZero,
        ethers.constants.Zero,
        transactions.segments[0].start,
        transactions.segments[0].end,
        0,
        {
          from: alice
        });
      assert.equal(result, true)
    })

    it("should be failed to verified", async () => {
      const invalidTx = transactions.invalidTx
      await assertRevert(this.transactionVerifier.verify(
        invalidTx.getTxHash(),
        invalidTx.merkleHash(),
        invalidTx.getTxBytes(),
        invalidTx.getSignatures(),
        0,
        0,
        ethers.constants.AddressZero,
        ethers.constants.Zero,
        transactions.segments[0].start,
        transactions.segments[0].end,
        0,
        {
          from: alice
        }))
    })

    it("should be failed to verified by invalid segment", async () => {
      const tx = transactions.tx
      await assertRevert(this.transactionVerifier.verify(
        tx.getTxHash(),
        tx.merkleHash(),
        tx.getTxBytes(),
        tx.getSignatures(),
        0,
        0,
        ethers.constants.AddressZero,
        ethers.constants.Zero,
        transactions.segments[1].start,
        transactions.segments[1].end,
        0,
        {
          from: alice
        }))
    })

  })
  
  describe("MergeTransaction", () => {

    it("should be verified", async () => {
      const tx = transactions.mergeTx
      const result = await this.transactionVerifier.verify(
        tx.getTxHash(),
        tx.merkleHash(),
        tx.getTxBytes(),
        tx.getSignatures(),
        0,
        0,
        ethers.constants.AddressZero,
        ethers.constants.Zero,
        transactions.segment45.start,
        transactions.segment45.end,
        0,
        {
          from: alice
        });
      assert.equal(result, true)
    })

  })

  describe("parseSegment", () => {

    it("should be parsed", async () => {
      const result = await this.standardVerifier.parseSegment(
        transactions.segment45.toBigNumber(),
        {
          from: alice
        });
      assert.equal(result[0].toNumber(), 0)
      assert.equal(result[1].toNumber(), transactions.segment45.start.toNumber())
      assert.equal(result[2].toNumber(), transactions.segment45.end.toNumber())

    })

  })

})
