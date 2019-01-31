const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const EscrowVerifier = artifacts.require("EscrowVerifier")
const ethers = require('ethers')
const BigNumber = ethers.utils.BigNumber

const {
  transactions
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract("TransactionVerifier", ([alice, bob, operator, user4, user5, admin]) => {

  beforeEach(async () => {
    await deployRLPdecoder(admin)
    const standardVerifier = await StandardVerifier.new({ from: operator })
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
        ethers.constants.AddressZero,
        transactions.segments[0].start,
        transactions.segments[0].end,
        {
          from: alice
        });
      assert.equal(result, true)
    })

    it("should be failed to verified", async () => {
      const invalidTx = transactions.invalidTx
      const result = await this.transactionVerifier.verify(
        invalidTx.getTxHash(),
        invalidTx.merkleHash(),
        invalidTx.getTxBytes(),
        invalidTx.getSignatures(),
        0,
        ethers.constants.AddressZero,
        transactions.segments[0].start,
        transactions.segments[0].end,
        {
          from: alice
        });
      assert.equal(result, false)
    })

    it("should be failed to verified by invalid segment", async () => {
      const tx = transactions.tx
      const result = await this.transactionVerifier.verify(
        tx.getTxHash(),
        tx.merkleHash(),
        tx.getTxBytes(),
        tx.getSignatures(),
        0,
        ethers.constants.AddressZero,
        transactions.segments[1].start,
        transactions.segments[1].end,
        {
          from: alice
        });
      assert.equal(result, false)
    })    

  });
  
})
