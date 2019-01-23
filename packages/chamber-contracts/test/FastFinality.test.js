const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')
const {
  duration,
  increaseTime,
} = require('./helpers/increaseTime')
const {
  assertRevert
} = require('./helpers/assertRevert');

const FastFinality = artifacts.require("FastFinality")
const RootChain = artifacts.require("RootChain")
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const {
  utils
} = require('ethers')
const BigNumber = utils.BigNumber

const {
  constants
} = require('@layer2/core')

const {
  Scenario3
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const BOND = constants.EXIT_BOND

contract("FastFinality", ([alice, bob, operator, merchant, user5, admin]) => {

  beforeEach(async () => {
    await deployRLPdecoder(alice)
    this.standardVerifier = await StandardVerifier.new({ from: operator })
    this.multisigVerifier = await MultisigVerifier.new({ from: operator })
    this.transactionVerifier = await TransactionVerifier.new(
      this.standardVerifier.address,
      this.multisigVerifier.address,
      {
        from: operator
      })
    this.rootChain = await RootChain.new(
      this.transactionVerifier.address,
      {
        from: operator
      })
    this.fastFinality = await FastFinality.new(
      this.rootChain.address,
      this.transactionVerifier.address,
      {
        from: operator
      })

  })

  describe('deposit', () => {

    it('should success to deposit', async () => {
      await this.fastFinality.deposit({
        value: utils.parseEther('2'),
        from: operator
      })
    })

  })

  describe('buyBandwidth', () => {

    it('should success to buy bandwidth', async () => {
      await this.fastFinality.deposit({
        value: utils.parseEther('2'),
        from: operator
      })
      await this.fastFinality.buyBandwidth({
        value: utils.parseEther('1'),
        from: merchant
      })
    })

  })


  describe('dispute', () => {

    beforeEach(async () => {
      await this.fastFinality.deposit({
        value: utils.parseEther('1'),
        from: operator
      })
    })

    it('should success to dispute and finalizeDispute', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        tx.toHex(),
        tx.getSignatures(),
        operatorSig,
        1,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          value: BOND,
          from: bob
        })

      increaseTime(15 * 24 * 60 * 60)
      
      await this.fastFinality.finalizeDispute(
        tx.hash(),
        {
          from: bob
        })

    });
    
    it('should failed to finalizeDispute', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        tx.toHex(),
        tx.getSignatures(),
        operatorSig,
        1,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          value: BOND,
          from: bob
        })

      await assertRevert(this.fastFinality.finalizeDispute(
        tx.hash(),
        {
          from: bob
        }))

    })

  })

  describe('challenge', () => {

    const STATE_FIRST_DISPUTED = 1;
    const STATE_CHALLENGED = 2;
    const STATE_SECOND_DISPUTED = 3;

    beforeEach(async () => {
      const submit = async (root) => {
        await this.rootChain.submit(
          root,
          {
            from: operator
          });
      }
      await submit(Scenario3.blocks[0].block.getRoot())
      await submit(Scenario3.blocks[1].block.getRoot())

      const tx = Scenario3.blocks[0].signedTransactions[0]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        tx.toHex(),
        tx.getSignatures(),
        operatorSig,
        1,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          value: BOND,
          from: bob
        })
    });

    it('should be success to challenge', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0]
      await this.fastFinality.challenge(
        tx.toHex(),
        tx.getProofs(),
        tx.getSignatures(),
        2 * 100 + 1,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator,
          gas: '500000'
        })
    });

    it('should be failed to challenge', async () => {
      const invalidTx = Scenario3.blocks[1].signedTransactions[0]

      await assertRevert(this.fastFinality.challenge(
        invalidTx.toHex(),
        invalidTx.getProofs(),
        invalidTx.getSignatures(),
        2 * 100 + 1,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator,
          gas: '500000'
        }))
    })

    it('should be success to secondDispute', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0]
      const secondDisputeTx = Scenario3.blocks[1].signedTransactions[0]
      await this.fastFinality.challenge(
        tx.toHex(),
        tx.getProofs(),
        tx.getSignatures(),
        2 * 100 + 1,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator
        })
      await this.fastFinality.secondDispute(
        tx.toHex(),
        secondDisputeTx.toHex(),
        secondDisputeTx.getProofs(),
        secondDisputeTx.getSignatures(),
        4 * 100 + 1,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator
        });
      const dispute = await this.fastFinality.getDispute(
        tx.hash(),
        {
          from: operator
        });
      assert.equal(dispute[3], STATE_SECOND_DISPUTED);

    })

  })

})
