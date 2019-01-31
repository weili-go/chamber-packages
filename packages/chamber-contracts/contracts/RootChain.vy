struct ChildChainBlock:
  root: bytes32
  blockTimestamp: timestamp

struct Exit:
  owner: address
  exitableAt: uint256
  utxoPos: uint256
  priority: uint256
  segment: uint256
  challengeCount: uint256

struct Challenge:
  owner: address
  exitHash: bytes32
  cTxHash: bytes32
  utxoPos: uint256
  segment: uint256
  status: uint256

contract TransactionVerifier():
  def verify(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def verifyForceInclude(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _start: uint256,
    _end: uint256,
    _hasSig: uint256
  ) -> bool: constant
  def getTxoHash(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def decodeDepositTx(
    _tBytes: bytes[1024],
    _blkNum: uint256
  ) -> bytes32: constant
  def getDepositHash(
    _tBytes: bytes[1024]
  ) -> bytes32: constant

BlockSubmitted: event({_root: bytes32, _timestamp: timestamp, _blkNum: uint256})
Deposited: event({_depositer: address, _start: uint256, _end: uint256, _blkNum: uint256})
ExitStarted: event({_txHash: bytes32, _exitor: address, exitableAt: uint256, _start: uint256, _end: uint256})
ChallengeStarted: event({_eTxHash: bytes32, _cTxHash: uint256})
Responded: event({_eTxHash: bytes32, _cTxHash: uint256})
ForceIncluded: event({_cTxHash: uint256})
FinalizedExit: event({_eTxHash: bytes32, _start: uint256, _end: uint256})
Log: event({_a: bytes32})

operator: address
txverifier: address
childChain: map(uint256, ChildChainBlock)
currentChildBlock: uint256
totalDeposit: uint256
exits: map(bytes32, Exit)
challenges: map(uint256, Challenge)
removed: map(bytes32, bool)
# [end:start]
withdrawals: map(uint256, uint256)

TOTAL_DEPOSIT: constant(uint256) = 2**48

EXIT_BOND: constant(wei_value) = as_wei_value(1, "finney")
CHALLENGE_BOND: constant(wei_value) = as_wei_value(1, "finney")
FORCE_INCLUDE_BOND: constant(wei_value) = as_wei_value(1, "finney")

STATUS_CHALLENGED: constant(uint256) = 1
STATUS_RESPONDED: constant(uint256) = 2
STATUS_CHALLENGED2: constant(uint256) = 3
STATUS_RESPONDED2: constant(uint256) = 4
STATUS_FORCE_INCLUDE: constant(uint256) = 5
STATUS_FORCE_INCLUDE_FINALIZED: constant(uint256) = 6
STATUS_FORCE_INCLUDE_CHALLENGED: constant(uint256) = 7

@private
@constant
def checkMembership(
  _start: uint256,
  _end: uint256,
  _leaf: bytes32,
  _totalAmount: uint256,
  _rootHash: bytes32,
  _proof: bytes[512]
) -> bool:
  currentAmount: uint256 = _end - _start
  currentLeft: uint256 = 0
  currentRight: uint256 = _totalAmount
  computedHash: bytes32 = _leaf
  proofElement: bytes32

  for i in range(16):
    if (i * 41) >= len(_proof):
      break
    leftOrRight: uint256 = convert(slice(_proof, start=i * 41, len=1), uint256)
    amount: uint256 = convert(slice(_proof, start=i * 41 + 1, len=8), uint256)
    proofElement = extract32(_proof, i * 41 + 9, type=bytes32)
    if leftOrRight == 0:
      currentRight -= amount
      computedHash = sha3(concat(
        convert(currentAmount, bytes32), computedHash, convert(amount, bytes32), proofElement))
    else:
      currentLeft += amount
      computedHash = sha3(concat(
        convert(amount, bytes32), proofElement, convert(currentAmount, bytes32), computedHash))
    currentAmount += amount
  return (computedHash == _rootHash) and (currentLeft <= _start) and (_end <= currentRight) and (currentAmount == _totalAmount)

@public
@constant
def checkTransaction(
  _start: uint256,
  _end: uint256,
  _txHash: bytes32,
  _txBytes: bytes[1024],
  _blkNum: uint256,
  _proof: bytes[512],
  _sigs: bytes[260],
  _outputIndex: uint256
) -> bool:
  root: bytes32 = self.childChain[_blkNum].root
  if _blkNum % 2 == 0:
    assert self.checkMembership(
      _start,
      _end,
      _txHash,
      TOTAL_DEPOSIT,
      root,
      _proof
    )
  else:
    # deposit transaction
    depositHash: bytes32 = TransactionVerifier(self.txverifier).getDepositHash(_txBytes)
    assert depositHash == root
  return TransactionVerifier(self.txverifier).verify(
    _txHash,
    sha3(concat(_txHash, root)),
    _txBytes,
    _sigs,
    _outputIndex,
    ZERO_ADDRESS,
    _start,
    _end)

# @dev Constructor
@public
def __init__(_txverifierAddress: address):
  self.operator = msg.sender
  self.currentChildBlock = 1
  self.totalDeposit = 0
  self.txverifier = _txverifierAddress

# @dev submit plasma block
@public
def submit(_root: bytes32):
  assert msg.sender == self.operator
  self.currentChildBlock += (2 - (self.currentChildBlock % 2))
  # 2 + 2 = 4
  # 3 + 1 = 4
  self.childChain[self.currentChildBlock] = ChildChainBlock({
      root: _root,
      blockTimestamp: block.timestamp
  })
  log.BlockSubmitted(_root, block.timestamp, self.currentChildBlock)


# @dev deposit
@public
@payable
def deposit():
  # 2 + 1 = 3
  # 3 + 2 = 5
  self.currentChildBlock += (1 + (self.currentChildBlock % 2))
  start: uint256 = self.totalDeposit
  self.totalDeposit += as_unitless_number(msg.value)
  root: bytes32 = sha3(
                    concat(
                      convert(msg.sender, bytes32),
                      convert(ZERO_ADDRESS, bytes32),
                      convert(start, bytes32),
                      convert(self.totalDeposit, bytes32)
                    )
                  )
  self.childChain[self.currentChildBlock] = ChildChainBlock({
      root: root,
      blockTimestamp: block.timestamp
  })
  log.Deposited(msg.sender, start, self.totalDeposit, self.currentChildBlock)

# @dev exit
@public
@payable
def exit(
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  txHash: bytes32 = sha3(_txBytes)
  assert msg.value == EXIT_BOND
  assert self.checkMembership(
    _start,
    _end,
    txHash,
    TOTAL_DEPOSIT,
    root,
    _proof
  )
  # verify signature, owner and segment
  assert TransactionVerifier(self.txverifier).verify(
    txHash,
    sha3(concat(txHash, root)),
    _txBytes,
    _sig,
    outputIndex,
    msg.sender,
    _start,
    _end)
  exitHash: bytes32 = TransactionVerifier(self.txverifier).getTxoHash(_txBytes, outputIndex, blkNum)
  exitableAt: uint256 = as_unitless_number(block.timestamp + 4 * 7 * 24 * 60 * 60)
  self.exits[exitHash] = Exit({
    owner: msg.sender,
    exitableAt: exitableAt,
    utxoPos: _utxoPos,
    priority: blkNum,
    segment: _start * TOTAL_DEPOSIT + _end,
    challengeCount: 0
  })
  log.ExitStarted(exitHash, msg.sender, exitableAt, _start, _end)

# @dev sendParentOfExit
#     send parent transaction of the exiting transaction and update priority of exit
@public
def sendParentOfExit(
  _challengeId: uint256,
  _exitHash: bytes32,
  _exitTxBytes: bytes[1024],
  _inputIndex: uint256,
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  txHash: bytes32 = sha3(_txBytes)
  self.checkTransaction(
    _start,
    _end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    outputIndex
  )
  exit: Exit = self.exits[_exitHash]
  exitSegmentStart: uint256 = exit.segment / TOTAL_DEPOSIT
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * TOTAL_DEPOSIT
  assert (exitSegmentStart <= _start) and (_end <= exitSegmentEnd)
  spentTxoHash: bytes32 = TransactionVerifier(self.txverifier).getTxoHash(_txBytes, outputIndex, blkNum)
  assert spentTxoHash == TransactionVerifier(self.txverifier).getTxoHash(_exitTxBytes, _inputIndex, 0)
  self.exits[_exitHash].priority = blkNum
  # if already challenge-game started, check block number
  challenge: Challenge = self.challenges[_challengeId]
  assert challenge.exitHash == _exitHash
  if challenge.utxoPos > _utxoPos and (challenge.status == STATUS_CHALLENGED or challenge.status == STATUS_CHALLENGED2):
    self.challenges[_challengeId].status = STATUS_RESPONDED2
    self.exits[_exitHash].challengeCount -= 1

# @dev
# @param _exitHash hash of the exiting transaction
# @param _segment uint256 format of a segment which is already withdrawn
@public
def challengeByWithdrawal(
  _exitHash: bytes32,
  _segment: uint256
):
  exit: Exit = self.exits[_exitHash]
  exitSegmentStart: uint256 = exit.segment / TOTAL_DEPOSIT
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * TOTAL_DEPOSIT
  start: uint256 = _segment / TOTAL_DEPOSIT
  end: uint256 = _segment - start * TOTAL_DEPOSIT
  # challenge by older withdrawal
  assert exit.utxoPos > self.withdrawals[_segment]
  assert (end > exitSegmentStart) and (start < exitSegmentEnd)
  # break exit procedure
  self.exits[_exitHash].owner = ZERO_ADDRESS
  send(msg.sender, EXIT_BOND)

# @dev challenge
# @param _utxoPos is blknum and index of challenge tx
# @param _eInputPos if _eInputPos < 0 then it's spent challenge,
#     if _eInputPos >= 0 then it's double spend challenge and _eInputPos is input index
@public
def challenge(
  _exitHash: bytes32,
  _exitTxBytes: bytes[1024],
  _utxoPos: uint256,
  _eInputPos: int128,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  txoIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  spentTxoHash: bytes32
  exitBlkNum: uint256 = self.exits[_exitHash].utxoPos / 100
  exitIndex: uint256 = self.exits[_exitHash].utxoPos - exitBlkNum * 100
  exitSegmentStart: uint256 = self.exits[_exitHash].segment / TOTAL_DEPOSIT
  exitSegmentEnd: uint256 = self.exits[_exitHash].segment - exitSegmentStart * TOTAL_DEPOSIT
  assert exitSegmentStart >= _start and _end <= exitSegmentEnd
  # check removed transaction sha3(_txBytes)
  assert not self.removed[sha3(_txBytes)]
  self.checkTransaction(
    _start,
    _end,
    sha3(_txBytes),
    _txBytes,
    blkNum,
    _proof,
    _sig,
    0
  )
  if _eInputPos < 0:
    # spent challenge
    # get output hash
    spentTxoHash = TransactionVerifier(self.txverifier).getTxoHash(
      _exitTxBytes,
      exitIndex,
      exitBlkNum)
    assert blkNum > exitBlkNum
  else:
    # double spent challenge
    # get input hash
    spentTxoHash = TransactionVerifier(self.txverifier).getTxoHash(
      _exitTxBytes,
      convert(_eInputPos + 10, uint256),
      exitBlkNum)
    assert blkNum < exitBlkNum
  assert spentTxoHash == TransactionVerifier(self.txverifier).getTxoHash(_txBytes, txoIndex, blkNum)
  # break exit procedure
  self.exits[_exitHash].owner = ZERO_ADDRESS
  send(msg.sender, EXIT_BOND)

# @dev challengeBefore start challenge game
# @param _utxoPos is blknum and index of challenge tx
@public
@payable
def challengeBefore(
  _exitHash: bytes32,
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _challengeId: uint256,
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  exit: Exit = self.exits[_exitHash]
  exitSegmentStart: uint256 = exit.segment / TOTAL_DEPOSIT
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * TOTAL_DEPOSIT
  txHash: bytes32 = sha3(_txBytes)
  # check removed transaction
  assert not self.removed[txHash]
  assert msg.value == CHALLENGE_BOND
  self.checkTransaction(
    _start,
    _end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    outputIndex
  )
  assert blkNum < exit.priority
  assert exitSegmentStart >= _start and _end <= exitSegmentEnd
  if self.challenges[_challengeId].status == 0:
    self.challenges[_challengeId] = Challenge({
      owner: msg.sender,
      exitHash: _exitHash,
      cTxHash: sha3(txHash),
      utxoPos: _utxoPos,
      status: STATUS_CHALLENGED,
      segment: (_start) * TOTAL_DEPOSIT + (_end)
    })
  elif self.challenges[_challengeId].status == STATUS_RESPONDED:
    assert self.challenges[_challengeId].owner == msg.sender
    assert self.challenges[_challengeId].exitHash == _exitHash
    self.challenges[_challengeId].status = STATUS_CHALLENGED2
  else:
    assert False
  self.exits[_exitHash].challengeCount += 1
  log.ChallengeStarted(_exitHash, _challengeId)

# @dev respond challenge
@public
def respondChallenge(
  _challengeId: uint256,
  _cTxBytes: bytes[1024],
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  txoIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  challenge: Challenge = self.challenges[_challengeId]
  cBlkNum: uint256 = challenge.utxoPos / 100
  cOutputIndex: uint256 = challenge.utxoPos - cBlkNum * 100
  cSegmentStart: uint256 = challenge.segment / TOTAL_DEPOSIT
  cSegmentEnd: uint256 = challenge.segment - cSegmentStart * TOTAL_DEPOSIT
  txHash: bytes32 = sha3(_txBytes)
  # check removed transaction
  assert not self.removed[txHash]
  assert cSegmentStart >= _start and _end <= cSegmentEnd
  assert self.checkMembership(
    _start,
    _end,
    txHash,
    TOTAL_DEPOSIT,
    root,
    _proof
  )
  assert TransactionVerifier(self.txverifier).verify(
    txHash,
    sha3(concat(txHash, root)),
    _txBytes,
    _sig,
    0,
    ZERO_ADDRESS,
    _start,
    _end)
  assert TransactionVerifier(self.txverifier).getTxoHash(
    _cTxBytes,
    cOutputIndex,
    cBlkNum) == TransactionVerifier(self.txverifier).getTxoHash(_txBytes, txoIndex, blkNum)
  assert blkNum > cBlkNum
  # change challenge status
  if challenge.status == STATUS_CHALLENGED:
    self.challenges[_challengeId].status = STATUS_RESPONDED
  elif challenge.status == STATUS_CHALLENGED2:
    self.challenges[_challengeId].status = STATUS_RESPONDED2
    # exitor gets bond
    send(msg.sender, CHALLENGE_BOND)
  elif challenge.status == STATUS_FORCE_INCLUDE:
    self.challenges[_challengeId].status = STATUS_FORCE_INCLUDE_CHALLENGED
    self.removed[challenge.cTxHash] = False
    send(msg.sender, FORCE_INCLUDE_BOND)
  else:
    assert False
  self.exits[challenge.exitHash].challengeCount -= 1
  self.exits[challenge.exitHash].exitableAt = as_unitless_number(block.timestamp + 1 * 7 * 24 * 60 * 60)
  log.Responded(challenge.exitHash, _challengeId)

# @dev finalizeExit
@public
def finalizeExit(
  _exitHash: bytes32
):
  exit: Exit = self.exits[_exitHash]
  exitSegmentStart: uint256 = exit.segment / TOTAL_DEPOSIT
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * TOTAL_DEPOSIT
  assert self.withdrawals[exit.segment] == 0
  assert exit.exitableAt < as_unitless_number(block.timestamp)
  assert exit.challengeCount == 0
  send(exit.owner, as_wei_value(exitSegmentEnd - exitSegmentStart, "wei") + EXIT_BOND)
  self.exits[_exitHash].owner = ZERO_ADDRESS
  self.withdrawals[exit.segment] = exit.utxoPos
  log.FinalizedExit(_exitHash, exitSegmentStart, exitSegmentEnd)

# @dev finalizeChallenge
#     challenger gets Challenge bond and exit bond
@public
def finalizeChallenge(
  _challengeId: uint256
):
  challenge: Challenge = self.challenges[_challengeId]
  exit: Exit = self.exits[challenge.exitHash]
  assert exit.exitableAt < as_unitless_number(block.timestamp)
  assert exit.challengeCount > 0
  assert challenge.status == STATUS_CHALLENGED or challenge.status == STATUS_CHALLENGED2
  send(challenge.owner, EXIT_BOND + CHALLENGE_BOND)
  self.exits[challenge.exitHash].owner = ZERO_ADDRESS

# @dev forceIncludeRequest starts special challenge game
#     forceIncludeRequest cancel any exits of sub segments unless challenge by spent of output.
#     The transaction forceIncluded will be removed from plasma block if someone don't show remain signatures.
@public
@payable
def forceIncludeRequest(
  _exitHash: bytes32,
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _challengeId: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260],
  hasSig: uint256
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  exit: Exit = self.exits[_exitHash]
  exitSegmentStart: uint256 = exit.segment / TOTAL_DEPOSIT
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * TOTAL_DEPOSIT
  txHash: bytes32 = sha3(_txBytes)
  root: bytes32 = self.childChain[blkNum].root
  assert msg.value == FORCE_INCLUDE_BOND
  assert self.checkMembership(
    _start,
    _end,
    txHash,
    TOTAL_DEPOSIT,
    root,
    _proof
  ) == True
  assert TransactionVerifier(self.txverifier).verifyForceInclude(
    txHash,
    sha3(concat(txHash, root)),
    _txBytes,
    _sig,
    outputIndex,
    _start,
    _end,
    hasSig)
  assert blkNum < (exit.utxoPos / 100)
  assert exitSegmentStart >= _start and _end <= exitSegmentEnd
  assert self.challenges[_challengeId].status == 0
  self.challenges[_challengeId] = Challenge({
    owner: msg.sender,
    exitHash: _exitHash,
    cTxHash: txHash,
    utxoPos: _utxoPos,
    status: STATUS_FORCE_INCLUDE,
    segment: _start * TOTAL_DEPOSIT + _end
  })
  self.removed[txHash] = True
  self.exits[_exitHash].challengeCount += 1
  log.ChallengeStarted(_exitHash, _challengeId)

@public
def includeSignature(
  _challengeId: uint256,
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  txHash: bytes32 = sha3(_txBytes)
  challenge: Challenge = self.challenges[_challengeId]
  root: bytes32 = self.childChain[blkNum].root
  self.checkTransaction(
    _start,
    _end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    outputIndex
  )
  assert challenge.status == STATUS_FORCE_INCLUDE
  self.challenges[_challengeId].status = STATUS_FORCE_INCLUDE_FINALIZED
  self.removed[challenge.cTxHash] = False
  send(challenge.owner, FORCE_INCLUDE_BOND)
  log.ForceIncluded(_challengeId)

@public
def challengeTooOldExit(
  _utxoPos: uint256,
  _exitHash: bytes32,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  exit: Exit = self.exits[_exitHash]
  exitSegmentStart: uint256 = exit.segment / TOTAL_DEPOSIT
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * TOTAL_DEPOSIT
  txHash: bytes32 = sha3(_txBytes)
  # if tx is 12 weeks before
  assert self.childChain[blkNum].blockTimestamp  < as_unitless_number(block.timestamp) - 12 * 7 * 24 * 60 * 60
  assert blkNum > exit.priority
  assert exitSegmentStart >= _start and _end <= exitSegmentEnd
  self.checkTransaction(
    _start,
    _end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    outputIndex
  )
  # break exit
  self.exits[_exitHash].owner = ZERO_ADDRESS

@public
def respondTooOldChallenge(
  _utxoPos: uint256,
  _challengeId: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  challenge: Challenge = self.challenges[_challengeId]
  cSegmentStart: uint256 = challenge.segment / TOTAL_DEPOSIT
  cSegmentEnd: uint256 = challenge.segment - cSegmentStart * TOTAL_DEPOSIT
  txHash: bytes32 = sha3(_txBytes)
  # if tx is 12 weeks before
  assert self.childChain[blkNum].blockTimestamp  < as_unitless_number(block.timestamp) - 12 * 7 * 24 * 60 * 60
  assert blkNum > (challenge.utxoPos / 100)
  assert cSegmentStart >= _start and _end <= cSegmentEnd
  assert challenge.status == STATUS_CHALLENGED or challenge.status == STATUS_CHALLENGED2
  self.checkTransaction(
    _start,
    _end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    outputIndex
  )
  self.challenges[_challengeId].status = STATUS_RESPONDED2
  self.exits[challenge.exitHash].challengeCount -= 1

# @dev getExit
@public
@constant
def getExit(
  _exitHash: bytes32
) -> (address, uint256):
  exit: Exit = self.exits[_exitHash]
  return (exit.owner, exit.challengeCount)
