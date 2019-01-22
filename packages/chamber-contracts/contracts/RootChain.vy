struct ChildChainBlock:
  root: bytes32
  blockTimestamp: timestamp

struct Exit:
  owner: address
  exitableAt: uint256
  utxoPos: uint256
  segment: uint256
  challengeCount: uint256

struct Challenge:
  owner: address
  exitTxHash: bytes32
  utxoPos: uint256
  status: uint256

contract TransactionVerifier():
  def verify(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[130],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHash(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def checkWithin(
    _start: uint256,
    _end: uint256,
    _txBytes: bytes[1024]
  ) -> bool: constant

BlockSubmitted: event({_root: bytes32, _timestamp: timestamp, _blkNum: uint256})
Deposited: event({_depositer: address, _start: uint256, _end: uint256, _blkNum: uint256})
ExitStarted: event({_txHash: bytes32, _exitor: address, exitableAt: uint256, _start: uint256, _end: uint256})
ChallengeStarted: event({_eTxHash: bytes32, _cTxHash: bytes32})
FinalizedExit: event({_eTxHash: bytes32, _start: uint256, _end: uint256})
Log: event({_a: bytes32})

operator: address
txverifier: address
childChain: map(uint256, ChildChainBlock)
currentChildBlock: uint256
totalDeposit: uint256
exits: map(bytes32, Exit)
challenges: map(bytes32, Challenge)
TOTAL_DEPOSIT: constant(uint256) = 2**48

@private
@constant
def checkMembership(
  _range: uint256,
  _leaf: bytes32,
  _totalAmount: uint256,
  _leftOffset: uint256,
  _rootHash: bytes32,
  _proof: bytes[512]
) -> bool:
  proofElement: bytes32
  currentAmount: uint256 = _range
  lastLeftAmount: uint256 = 0
  computedHash: bytes32 = _leaf

  for i in range(16):
    if (i * 41) >= len(_proof):
      break
    leftOrRight: uint256 = convert(slice(_proof, start=i * 41, len=1), uint256)
    amount: uint256 = convert(slice(_proof, start=i * 41 + 1, len=8), uint256)
    proofElement = extract32(_proof, i * 41 + 9, type=bytes32)
    if leftOrRight == 0:
      computedHash = sha3(concat(
        convert(currentAmount, bytes32), computedHash, convert(amount, bytes32), proofElement))
    else:
      computedHash = sha3(concat(
        convert(amount, bytes32), proofElement, convert(currentAmount, bytes32), computedHash))
      lastLeftAmount = currentAmount - _range
    currentAmount += amount
  return (computedHash == _rootHash) and (lastLeftAmount == _leftOffset) and (currentAmount == _totalAmount)

@private
@constant
def checkTransaction(
  _start: uint256,
  _end: uint256,
  _txHash: bytes32,
  _txBytes: bytes[1024],
  _blkNum: uint256,
  _proof: bytes[512],
  _sigs: bytes[130],
  _outputIndex: uint256
):
  root: bytes32 = self.childChain[_blkNum].root
  if _blkNum % 2 == 0:
    assert self.checkMembership(
      _end - _start,
      _txHash,
      TOTAL_DEPOSIT,
      _start,
      root,
      _proof
    ) == True
    assert TransactionVerifier(self.txverifier).verify(
      _txHash,
      _txBytes,
      _sigs,
      _outputIndex,
      ZERO_ADDRESS,
      _start,
      _end)
  else:
    # deposit transaction
    assert _txHash == root
    assert convert(slice(_txBytes, start=64, len=32), uint256) == _start
    assert convert(slice(_txBytes, start=96, len=32), uint256) == _end

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
def exit(
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[130]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  txHash: bytes32 = sha3(_txBytes)
  assert self.checkMembership(
    _end - _start,
    txHash,
    TOTAL_DEPOSIT,
    _start,
    root,
    _proof
  ) == True
  # verify signature, owner and segment
  assert TransactionVerifier(self.txverifier).verify(
    txHash,
    _txBytes,
    _sig,
    outputIndex,
    msg.sender,
    _start,
    _end)
  exitableAt: uint256 = as_unitless_number(block.timestamp + 4 * 7 * 24 * 60 * 60)
  self.exits[txHash] = Exit({
    owner: msg.sender,
    exitableAt: exitableAt,
    utxoPos: _utxoPos,
    segment: _start * (2 ** 32) + _end,
    challengeCount: 0
  })
  log.ExitStarted(txHash, msg.sender, exitableAt, _start, _end)

# @dev challenge
# @param _utxoPos is blknum and index of challenge tx
# @param _eInputPos if _eInputPos < 0 then it's spent challenge,
#     if _eInputPos >= 0 then it's double spend challenge and _eInputPos is input index
@public
def challenge(
  _exitTxBytes: bytes[1024],
  _utxoPos: uint256,
  _eInputPos: int128,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[130]
):
  exitTxHash: bytes32 = sha3(_exitTxBytes)
  blkNum: uint256 = _utxoPos / 100
  txoIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  spentTxoHash: bytes32
  exitBlkNum: uint256 = self.exits[exitTxHash].utxoPos / 100
  exitIndex: uint256 = self.exits[exitTxHash].utxoPos - exitBlkNum * 100
  assert self.checkMembership(
    _end - _start,
    sha3(_txBytes),
    TOTAL_DEPOSIT,
    _start,
    root,
    _proof
  )
  assert TransactionVerifier(self.txverifier).verify(
    sha3(_txBytes),
    _txBytes,
    _sig,
    0,
    ZERO_ADDRESS,
    _start,
    _end)
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
  self.exits[exitTxHash].owner = ZERO_ADDRESS

# @dev challengeBefore start challenge game
# @param _utxoPos is blknum and index of challenge tx
@public
def challengeBefore(
  _exitTxBytes: bytes[1024],
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _cTxHash: bytes32,
  _proof: bytes[512],
  _sig: bytes[130]
):
  exitTxHash: bytes32 = sha3(_exitTxBytes)
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  exit: Exit = self.exits[exitTxHash]
  exitSegmentStart: uint256 = exit.segment / (2 ** 32)
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * (2 ** 32)
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
  assert blkNum < (exit.utxoPos / 100)
  assert (_end > exitSegmentStart) and (_start < exitSegmentEnd)
  if self.challenges[_cTxHash].status == 0:
    assert _cTxHash == txHash
    self.challenges[_cTxHash] = Challenge({
      owner: msg.sender,
      exitTxHash: exitTxHash,
      utxoPos: _utxoPos,
      status: 1
    })
  elif self.challenges[_cTxHash].status == 2:
    assert self.challenges[_cTxHash].exitTxHash == exitTxHash
    self.challenges[_cTxHash].status = 3
  self.exits[exitTxHash].challengeCount += 1
  log.ChallengeStarted(exitTxHash, _cTxHash)

# @dev respond challenge
@public
def respondChallenge(
  _cTxBytes: bytes[1024],
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[130]
):
  cTxHash: bytes32 = sha3(_cTxBytes)
  blkNum: uint256 = _utxoPos / 100
  txoIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  challenge: Challenge = self.challenges[cTxHash]
  cBlkNum: uint256 = challenge.utxoPos / 100
  cOutputIndex: uint256 = challenge.utxoPos - cBlkNum * 100
  assert self.checkMembership(
    _end - _start,
    sha3(_txBytes),
    TOTAL_DEPOSIT,
    _start,
    root,
    _proof
  )
  assert TransactionVerifier(self.txverifier).verify(
    sha3(_txBytes),
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
  if challenge.status == 1:
    challenge.status = 2
  elif challenge.status == 3:
    challenge.status = 4
  self.exits[challenge.exitTxHash].challengeCount -= 1
  self.exits[challenge.exitTxHash].exitableAt = as_unitless_number(block.timestamp + 1 * 7 * 24 * 60 * 60)

# @dev finalizeExit
@public
def finalizeExit(
  _exitTxHash: bytes32
):
  exit: Exit = self.exits[_exitTxHash]
  exitSegmentStart: uint256 = exit.segment / (2 ** 32)
  exitSegmentEnd: uint256 = exit.segment - exitSegmentStart * (2 ** 32)
  assert exit.exitableAt < as_unitless_number(block.timestamp)
  assert exit.challengeCount == 0
  send(exit.owner, as_wei_value(exitSegmentEnd - exitSegmentStart, "wei"))
  self.exits[_exitTxHash].owner = ZERO_ADDRESS
  log.FinalizedExit(_exitTxHash, exitSegmentStart, exitSegmentEnd)

# @dev getExit
@public
@constant
def getExit(
  _exitTxHash: bytes32
) -> (address, uint256):
  exit: Exit = self.exits[_exitTxHash]
  return (exit.owner, exit.challengeCount)
