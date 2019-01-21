const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const ethers = require('ethers')
const BigNumber = ethers.utils.BigNumber

const {
  Scenario1
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract("TransactionVerifier", ([alice, bob, operator, user4, user5, admin]) => {

  beforeEach(async () => {
    await deployRLPdecoder(admin)
    this.standardVerifier = await StandardVerifier.new({ from: operator })
    this.multisigVerifier = await MultisigVerifier.new({ from: operator })
    this.transactionVerifier = await TransactionVerifier.new(
      this.standardVerifier.address,
      this.multisigVerifier.address,
      {
        from: operator
      })
  });

  describe("TransferTransaction", () => {

    it("should be verified", async () => {
      const tx = Scenario1.signedTransactions[0]
      const result = await this.transactionVerifier.verify(
        tx.tx.hash(),
        tx.tx.encode(),
        tx.getSignatures(),
        0,
        ethers.constants.AddressZero,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        {
          from: alice
        });
      assert.equal(result, true)
    })
  });
  
})
