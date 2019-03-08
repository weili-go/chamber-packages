const {
  duration,
  increaseTime,
} = require('./helpers/increaseTime')
const {
  assertRevert
} = require('./helpers/assertRevert');

const FastFinality = artifacts.require("FastFinality")
const RootChain = artifacts.require("RootChain")
const Checkpoint = artifacts.require("Checkpoint")
const CustomVerifier = artifacts.require("CustomVerifier")
const VerifierUtil = artifacts.require("VerifierUtil")
const OwnStateVerifier = artifacts.require("OwnStateVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const SwapVerifier = artifacts.require("SwapVerifier")
const ERC721 = artifacts.require("ERC721")
const {
  utils
} = require('ethers')
const BigNumber = utils.BigNumber

const {
  constants,
  DepositTransaction
} = require('@layer2/core')

const {
  Scenario3,
  testAddresses
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
    this.checkpoint = await Checkpoint.new({ from: operator })
    this.verifierUtil = await VerifierUtil.new({ from: operator })
    this.ownStateVerifier = await OwnStateVerifier.new(
      this.verifierUtil.address, { from: operator })
    this.standardVerifier = await StandardVerifier.new(
      this.verifierUtil.address,
      this.ownStateVerifier.address,
      { from: operator })
    this.swapVerifier = await SwapVerifier.new(
      this.verifierUtil.address,
      this.ownStateVerifier.address,
      { from: operator })
    this.customVerifier = await CustomVerifier.new(
      this.verifierUtil.address,
      this.ownStateVerifier.address,
      {
        from: operator
      })
    await this.customVerifier.addVerifier(this.standardVerifier.address, {from: operator})
    await this.customVerifier.addVerifier(this.swapVerifier.address, {from: operator})
    this.rootChain = await RootChain.new(
      this.customVerifier.address,
      this.erc721.address,
      this.checkpoint.address,
      {
        from: operator
      })
    this.fastFinality = await FastFinality.new(
      this.rootChain.address,
      this.customVerifier.address,
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

    const prevBlkNum = utils.bigNumberify(5)
    const prevOutput = new DepositTransaction(testAddresses.AliceAddress, Scenario3.segments[0])
                            .getOutput().withBlkNum(prevBlkNum)

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
      const tx = Scenario3.blocks[0].transactions[0]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        prevOutput.getBytes(),
        prevBlkNum,
        tx.getTxBytes(),
        tx.getSignatures(),
        operatorSig,
        1,
        tokenId,
        Scenario3.segments[0].start,
        Scenario3.segments[0].end,
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
      Scenario3.blocks[0].block.setSuperRoot(constants.ZERO_HASH)
      const tx = Scenario3.blocks[0].block.getSignedTransactionWithProof(
        Scenario3.blocks[0].transactions[0].hash())[0]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        prevOutput.getBytes(),
        prevBlkNum,
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
    const prevBlkNum = utils.bigNumberify(5)
    const prevOutput = new DepositTransaction(testAddresses.AliceAddress, Scenario3.segments[0])
                            .getOutput().withBlkNum(prevBlkNum)

    beforeEach(async () => {
      const submit = async (block) => {
        const result = await this.rootChain.submit(
          block.getRoot(),
          {
            from: operator
          });
        block.setBlockTimestamp(utils.bigNumberify(result.logs[0].args._timestamp.toString()))
        block.setSuperRoot(result.logs[0].args._superRoot)
      }
      await submit(Scenario3.blocks[0].block)
      await submit(Scenario3.blocks[1].block)

      const tx = Scenario3.blocks[0].transactions[0]
      const operatorSig = Scenario3.blocks[0].operatorSignes[0]

      await this.fastFinality.dispute(
        prevOutput.getBytes(),
        prevBlkNum,
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
      const tx = Scenario3.blocks[0].block.getSignedTransactionWithProof(
        Scenario3.blocks[0].transactions[0].hash())[0]
      await this.fastFinality.challenge(
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        2 * 100 + 1,
        tokenId,
        Scenario3.segments[0].start,
        Scenario3.segments[0].end,
        {
          from: operator,
          gas: '500000'
        })
    });

    it('should be failed to challenge', async () => {
      const invalidTx = Scenario3.blocks[1].block.getSignedTransactionWithProof(
        Scenario3.blocks[1].transactions[0].hash())[0]
      
      await assertRevert(this.fastFinality.challenge(
        invalidTx.getTxBytes(),
        invalidTx.getProofAsHex(),
        invalidTx.getSignatures(),
        2 * 100 + 1,
        tokenId,
        Scenario3.segments[1].start,
        Scenario3.segments[1].end,
        {
          from: operator,
          gas: '500000'
        }))
    })

    it('should be success to secondDispute', async () => {
      const tx = Scenario3.blocks[0].block.getSignedTransactionWithProof(
        Scenario3.blocks[0].transactions[0].hash())[0]
      const secondDisputeTx = Scenario3.blocks[1].block.getSignedTransactionWithProof(
        Scenario3.blocks[1].transactions[0].hash())[0]
      await this.fastFinality.challenge(
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        2 * 100 + 1,
        tokenId,
        Scenario3.segments[0].start,
        Scenario3.segments[0].end,
        {
          from: operator
        })
      await this.fastFinality.secondDispute(
        prevOutput.getBytes(),
        prevBlkNum,
        tx.getTxBytes(),
        secondDisputeTx.getTxBytes(),
        secondDisputeTx.getProofAsHex(),
        secondDisputeTx.getSignatures(),
        4 * 100 + 1,
        tokenId,
        Scenario3.segments[0].start,
        Scenario3.segments[0].end,
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
