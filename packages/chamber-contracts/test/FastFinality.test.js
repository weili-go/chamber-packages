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
const EscrowVerifier = artifacts.require("EscrowVerifier")
const ERC721 = artifacts.require("ERC721")
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

  const tokenId = 0

  beforeEach(async () => {
    this.erc721 = await ERC721.new()
    this.standardVerifier = await StandardVerifier.new({ from: operator })
    this.multisigVerifier = await MultisigVerifier.new({ from: operator })
    this.escrowVerifier = await EscrowVerifier.new({ from: operator })
    this.transactionVerifier = await TransactionVerifier.new(
      this.standardVerifier.address,
      this.multisigVerifier.address,
      this.escrowVerifier.address,
      {
        from: operator
      })
    this.rootChain = await RootChain.new(
      this.transactionVerifier.address,
      this.erc721.address,
      {
        from: operator
      })
    this.fastFinality = await FastFinality.new(
      this.rootChain.address,
      this.transactionVerifier.address,
      this.erc721.address,
      {
        from: operator
      })
    const getTokenAddressResult = await this.fastFinality.getTokenAddress.call()
    this.ffToken = await ERC721.at(getTokenAddressResult)
  })

  describe('depositAndMintToken', () => {

    it('should success to deposit and withdraw', async () => {
      const result = await this.fastFinality.depositAndMintToken(
        7 * 24 * 60 * 60,
        {
          from: operator,
          value: utils.parseEther('1')
        }
      )
      const merchantId = result.logs[0].args._merchantId.toString()
      await this.ffToken.approve(merchant, merchantId, {
        from: operator
      })
      await this.ffToken.transferFrom(operator, merchant, merchantId, {
        from: merchant
      })
      increaseTime(8 * 24 * 60 * 60)
      await this.fastFinality.withdrawAndBurnToken(
        merchantId,
        {
          from: operator
        }
      )

    })

  })


  describe('dispute', () => {

    beforeEach(async () => {
      const result = await this.fastFinality.depositAndMintToken(
        8 * 7 * 24 * 60 * 60,
        {
        from: operator,
        value: utils.parseEther('2')
      })
      const merchantId = result.logs[0].args._merchantId.toString()
      await this.ffToken.approve(bob, merchantId, {
        from: operator
      })
      await this.ffToken.transferFrom(operator, bob, merchantId, {
        from: bob
      })
    })

    it('should success to dispute and finalizeDispute', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0][1]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        tx.getTxBytes(),
        tx.getSignatures(),
        operatorSig,
        1,
        tokenId,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          value: BOND,
          from: bob
        })

      increaseTime(15 * 24 * 60 * 60)
      
      await this.fastFinality.finalizeDispute(
        0,
        tx.getTxHash(),
        {
          from: bob
        })

    });
    
    it('should failed to finalizeDispute', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0][1]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        tx.getTxBytes(),
        tx.getSignatures(),
        operatorSig,
        1,
        tokenId,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          value: BOND,
          from: bob
        })

      await assertRevert(this.fastFinality.finalizeDispute(
        0,
        tx.getTxHash(),
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

      const tx = Scenario3.blocks[0].signedTransactions[0][1]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        tx.getTxBytes(),
        tx.getSignatures(),
        operatorSig,
        1,
        tokenId,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          value: BOND,
          from: bob
        })
    });

    it('should be success to challenge', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0][1]
      await this.fastFinality.challenge(
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        2 * 100 + 1,
        tokenId,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator,
          gas: '500000'
        })
    });

    it('should be failed to challenge', async () => {
      const invalidTx = Scenario3.blocks[1].signedTransactions[0][1]

      await assertRevert(this.fastFinality.challenge(
        invalidTx.getTxBytes(),
        invalidTx.getProofAsHex(),
        invalidTx.getSignatures(),
        2 * 100 + 1,
        tokenId,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator,
          gas: '500000'
        }))
    })

    it('should be success to secondDispute', async () => {
      const tx = Scenario3.blocks[0].signedTransactions[0][1]
      const secondDisputeTx = Scenario3.blocks[1].signedTransactions[0][1]
      await this.fastFinality.challenge(
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        2 * 100 + 1,
        tokenId,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator
        })
      await this.fastFinality.secondDispute(
        tx.getTxBytes(),
        secondDisputeTx.getTxBytes(),
        secondDisputeTx.getProofAsHex(),
        secondDisputeTx.getSignatures(),
        4 * 100 + 1,
        tokenId,
        Scenario3.segments[2].start,
        Scenario3.segments[2].end,
        {
          from: operator
        });
      const dispute = await this.fastFinality.getDispute(
        tx.getTxHash(),
        {
          from: operator
        });
      assert.equal(dispute[3], STATE_SECOND_DISPUTED);

    })

  })

})
