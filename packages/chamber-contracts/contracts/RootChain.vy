struct tokenListing:
  # amount is plasma amount * decimalOffset
  decimalOffset:  uint256
  # address of the ERC20, ETH is ZERO_ADDRESS
  tokenAddress: address

struct ChildChainBlock:
  root: bytes32
  blockTimestamp: timestamp

struct Exit:
  owner: address
  exitableAt: uint256
  txHash: bytes32
  extendedExitableAt: uint256
  utxoPos: uint256
  priority: uint256
  segment: uint256
  lowerExit: uint256
  hasSig: uint256
  challengeCount: uint256

struct Challenge:
  blkNum: uint256
  isAvailable: bool

struct exitableRange:
  start: uint256
  isAvailable: bool

contract ERC20:
  def transferFrom(_from: address, _to: address, _value: uint256) -> bool: modifying
  def transfer(_to: address, _value: uint256) -> bool: modifying

contract TransactionVerifier():
  def verify(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _hasSig: uint256,
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHash(
    _txBytes: bytes[496],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def doesRequireConfsig(
    _txBytes: bytes[496]
  ) -> bool: constant
  def getDepositHash(
    _txBytes: bytes[496]
  ) -> bytes32: constant

ListingEvent: event({_tokenId: uint256, _tokenAddress: address})
BlockSubmitted: event({_root: bytes32, _timestamp: timestamp, _blkNum: uint256})
Deposited: event({_depositer: indexed(address), _start: uint256, _end: uint256, _blkNum: uint256})
ExitStarted: event({_exitor: indexed(address), _exitId: uint256, exitableAt: uint256, _start: uint256, _end: uint256})
Challenged: event({_exitId: uint256})
ForceIncluded: event({_exitId: uint256})
FinalizedExit: event({_exitId: uint256, _start: uint256, _end: uint256})
ExitableMerged: event({_start: uint256, _end: uint256})

# management
operator: address
txverifier: address
childChain: map(uint256, ChildChainBlock)
currentChildBlock: uint256
totalDeposited: public(map(uint256, uint256))

# token types

listings: public(map(uint256, tokenListing))
listed: public(map(address, uint256))
listingNonce: public(uint256)

# exit

exitNonce: public(uint256)
# tokentype -> ( end -> start)
exitable: public(map(uint256, map(uint256, exitableRange)))
exits: map(uint256, Exit)
challenges: map(bytes32, Challenge)
removed: map(bytes32, bool)

# [end:start]
withdrawals: map(uint256, uint256)


# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48
MASK8BYTES: constant(uint256) = 2**64 - 1

EXIT_BOND: constant(wei_value) = as_wei_value(1, "finney")
CHALLENGE_BOND: constant(wei_value) = as_wei_value(1, "finney")
FORCE_INCLUDE_BOND: constant(wei_value) = as_wei_value(1, "finney")


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

# check transaction include deposit transaction
@public
@constant
def checkTransaction(
  _tokenId: uint256,
  _start: uint256,
  _end: uint256,
  _txHash: bytes32,
  _txBytes: bytes[496],
  _blkNum: uint256,
  _proof: bytes[512],
  _sigs: bytes[260],
  _outputIndex: uint256
) -> bool:
  root: bytes32 = self.childChain[_blkNum].root
  if _blkNum % 2 == 0:
    assert self.checkMembership(
      _start + _tokenId * TOTAL_DEPOSIT,
      _end + _tokenId * TOTAL_DEPOSIT,
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
    0,
    _outputIndex,
    ZERO_ADDRESS,
    _tokenId,
    _start,
    _end)

@private
@constant
def checkExitable(
  _tokenId: uint256,
  _start: uint256,
  _end: uint256,
  _exitableEnd: uint256
):
  assert _end <= TOTAL_DEPOSIT
  assert _end <= _exitableEnd
  assert _start >= self.exitable[_tokenId][_exitableEnd].start
  assert self.exitable[_tokenId][_exitableEnd].isAvailable

@private
def removeExitable(
  _tokenId: uint256,
  _newStart: uint256,
  _newEnd: uint256,
  _oldEnd: uint256
):
  oldStart: uint256 = self.exitable[_tokenId][_oldEnd].start
  # old start < new start
  if _newStart > oldStart:
    self.exitable[_tokenId][_newStart].start = oldStart
    self.exitable[_tokenId][_newStart].isAvailable = True
  # new end < old end
  if _newEnd < _oldEnd:
    self.exitable[_tokenId][_oldEnd].start = _newEnd
    self.exitable[_tokenId][_oldEnd].isAvailable = True
    self.exitable[_tokenId][_newEnd].start = _newStart
    self.exitable[_tokenId][_newEnd].isAvailable = False
  # new end >= old start
  else:
    # _newEnd is right most
    if _newEnd != self.totalDeposited[_tokenId]:
      self.exitable[_tokenId][_newEnd].isAvailable = False
    # _newEnd isn't right most
    else:
      self.exitable[_tokenId][_newEnd].start = _newEnd 

# @dev processDeposit
@private
def processDeposit(
  depositer: address,
  tokenId: uint256,
  amount: uint256
):
  self.currentChildBlock += (1 + (self.currentChildBlock % 2))
  start: uint256 = self.totalDeposited[tokenId]
  self.totalDeposited[tokenId] += amount
  end: uint256 = self.totalDeposited[tokenId]
  root: bytes32 = sha3(
                    concat(
                      convert(depositer, bytes32),
                      convert(tokenId, bytes32),
                      convert(start, bytes32),
                      convert(end, bytes32)
                    )
                  )
  oldStart: uint256 = self.exitable[tokenId][start].start
  clear(self.exitable[tokenId][start])
  self.exitable[tokenId][end].start = oldStart
  self.exitable[tokenId][end].isAvailable = True
  self.childChain[self.currentChildBlock] = ChildChainBlock({
      root: root,
      blockTimestamp: block.timestamp
  })
  log.Deposited(depositer, start, end, self.currentChildBlock)

# @dev processDepositFragment
@private
def processDepositFragment(
  depositer: address,
  tokenId: uint256,
  start: uint256,
  end: uint256,
  exitableEnd: uint256
):
  self.currentChildBlock += (1 + (self.currentChildBlock % 2))
  assert self.exitable[tokenId][exitableEnd].start == start
  assert self.exitable[tokenId][exitableEnd].isAvailable == False
  self.exitable[tokenId][exitableEnd].start = end
  self.exitable[tokenId][end].start = start
  self.exitable[tokenId][end].isAvailable = True
  root: bytes32 = sha3(
                    concat(
                      convert(depositer, bytes32),
                      convert(tokenId, bytes32),
                      convert(start, bytes32),
                      convert(end, bytes32)
                    )
                  )
  self.childChain[self.currentChildBlock] = ChildChainBlock({
      root: root,
      blockTimestamp: block.timestamp
  })
  log.Deposited(depositer, start, end, self.currentChildBlock)

@private
@constant
def parseSegment(
  segment: uint256
) -> (uint256, uint256, uint256):
  tokenId: uint256 = bitwise_and(shift(segment, -16 * 8), MASK8BYTES)
  start: uint256 = bitwise_and(shift(segment, -8 * 8), MASK8BYTES)
  end: uint256 = bitwise_and(segment, MASK8BYTES)
  return (tokenId, start, end)

@private
@constant
def checkSegment(
  segment1: uint256,
  segment2: uint256
) -> (uint256, uint256, uint256):
  tokenId1: uint256
  start1: uint256
  end1: uint256
  tokenId2: uint256
  start2: uint256
  end2: uint256
  (tokenId1, start1, end1) = self.parseSegment(segment1)
  (tokenId2, start2, end2) = self.parseSegment(segment2)
  assert tokenId1 == tokenId2 and start1 < end2 and start2 < end1
  return (tokenId1, start1, end1)

# @dev Constructor
@public
def __init__(_txverifierAddress: address):
  self.operator = msg.sender
  self.currentChildBlock = 1
  self.txverifier = _txverifierAddress
  self.listingNonce = 0
  self.exitNonce = 1

@public
def listToken(
  tokenAddress: address,
  denomination: uint256
):
  tokenId: uint256 = self.listingNonce
  self.listings[tokenId].decimalOffset = 0
  self.listings[tokenId].tokenAddress = tokenAddress
  self.listed[tokenAddress] = tokenId
  self.listingNonce += 1
  # init the new token exitable ranges
  self.exitable[tokenId][0].isAvailable = True
  log.ListingEvent(tokenId, tokenAddress)

@public
def setup():
  self.listToken(ZERO_ADDRESS, as_unitless_number(as_wei_value(1, "gwei")))

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
  # 1 in Plasma is 1 gwei
  decimalOffset: wei_value = as_wei_value(1, "gwei")
  assert (msg.value % decimalOffset == 0)
  self.processDeposit(
    msg.sender,
    0,
    as_unitless_number(msg.value / decimalOffset))

# @dev depositFragment
@public
@payable
def depositFragment(
  start: uint256,
  end: uint256,
  exitableEnd: uint256
):
  decimalOffset: wei_value = as_wei_value(1, "gwei")
  assert (msg.value % decimalOffset == 0)
  assert start + as_unitless_number(msg.value / decimalOffset) == end
  self.processDepositFragment(
    msg.sender,
    0,
    start,
    end,
    exitableEnd)

@public
def depositERC20(
  token: address,
  amount: uint256
):
  depositer: address = msg.sender
  passed: bool = ERC20(token).transferFrom(depositer, self, amount)
  tokenId: uint256 = self.listed[token]
  assert passed
  self.processDeposit(
    depositer,
    tokenId,
    amount)

# @dev exit
@public
@payable
def exit(
  _utxoPos: uint256,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260],
  _hasSig: uint256
):
  assert msg.value == EXIT_BOND
  exitableAt: uint256 = as_unitless_number(block.timestamp + 4 * 7 * 24 * 60 * 60)
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  priority: uint256 = blkNum
  txHash: bytes32 = sha3(_txBytes)
  if self.challenges[txHash].isAvailable and self.challenges[txHash].blkNum < priority:
    priority = self.challenges[txHash].blkNum
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(_segment)
  root: bytes32 = self.childChain[blkNum].root
  if blkNum % 2 == 0:
    assert self.checkMembership(
      start + tokenId * TOTAL_DEPOSIT,
      end + tokenId * TOTAL_DEPOSIT,
      txHash,
      TOTAL_DEPOSIT,
      root,
      _proof
    )
  else:
    # deposit transaction
    depositHash: bytes32 = TransactionVerifier(self.txverifier).getDepositHash(_txBytes)
    assert depositHash == root
  # verify signature, owner and segment
  assert TransactionVerifier(self.txverifier).verify(
    txHash,
    sha3(concat(txHash, root)),
    _txBytes,
    _sig,
    _hasSig,
    outputIndex,
    msg.sender,
    tokenId,
    start,
    end)
  exitId: uint256 = self.exitNonce
  self.exitNonce += 1
  self.exits[exitId] = Exit({
    owner: msg.sender,
    exitableAt: exitableAt,
    txHash: txHash,
    extendedExitableAt: 0,
    utxoPos: _utxoPos,
    priority: priority,
    segment: _segment,
    lowerExit: 0,
    challengeCount: 0,
    hasSig: _hasSig
  })
  if _hasSig > 0:
    self.removed[txHash] = True
  log.ExitStarted(msg.sender, exitId, exitableAt, start, end)

# @dev challenge
# @param _utxoPos is blknum and index of challenge tx
# @param _eInputPos if _eInputPos < 0 then it's spent challenge,
#     if _eInputPos >= 0 then it's double spend challenge and _eInputPos is input index
@public
def challenge(
  _exitId: uint256,
  _exitTxBytes: bytes[496],
  _utxoPos: uint256,
  _eInputPos: int128,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  txoIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  spentTxoHash: bytes32
  tokenId: uint256
  start: uint256
  end: uint256
  exit: Exit = self.exits[_exitId]
  exitBlkNum: uint256 = exit.utxoPos / 100
  exitIndex: uint256 = exit.utxoPos - exitBlkNum * 100
  (tokenId, start, end) = self.checkSegment(_segment, exit.segment)
  assert exit.txHash == sha3(_exitTxBytes)
  assert exit.exitableAt > as_unitless_number(block.timestamp)
  txHash: bytes32 = sha3(_txBytes)
  # check removed transaction sha3(_txBytes)
  assert not self.removed[txHash]
  self.checkTransaction(
    tokenId,
    start,
    end,
    txHash,
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
    if self.exits[exit.lowerExit].owner != ZERO_ADDRESS:
      self.exits[exit.lowerExit].challengeCount -= 1
      if as_unitless_number(block.timestamp) > self.exits[exit.lowerExit].exitableAt - 1 * 7 * 24 * 60 * 60:
        self.exits[exit.lowerExit].extendedExitableAt = as_unitless_number(block.timestamp + 1 * 7 * 24 * 60 * 60)
    if not TransactionVerifier(self.txverifier).doesRequireConfsig(_txBytes):
      self.challenges[txHash] = Challenge({
        blkNum: exitBlkNum,
        isAvailable: True
      })
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
  if exit.hasSig > 0:
    self.removed[sha3(_exitTxBytes)] = False
  self.exits[_exitId].owner = ZERO_ADDRESS
  clear(self.exits[_exitId])
  send(msg.sender, EXIT_BOND)
  log.Challenged(_exitId)

# @dev requestHigherPriorityExit
@public
def requestHigherPriorityExit(
  _parentExitId: uint256,
  _exitId: uint256
):
  parent: Exit = self.exits[_parentExitId]
  exit: Exit = self.exits[_exitId]
  assert parent.priority < exit.priority
  self.checkSegment(parent.segment, exit.segment)
  self.exits[_parentExitId].lowerExit = _exitId
  self.exits[_exitId].challengeCount += 1

@public
def includeSignature(
  _exitId: uint256,
  _utxoPos: uint256,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  txHash: bytes32 = sha3(_txBytes)
  exit: Exit = self.exits[_exitId]
  root: bytes32 = self.childChain[blkNum].root
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(_segment)
  self.checkTransaction(
    tokenId,
    start,
    end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    outputIndex
  )
  assert exit.hasSig > 0
  self.removed[txHash] = False
  send(msg.sender, FORCE_INCLUDE_BOND)
  log.ForceIncluded(_exitId)

# @dev finalizeExit
@public
def finalizeExit(
  _exitableEnd: uint256,
  _exitId: uint256
):
  exit: Exit = self.exits[_exitId]
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(exit.segment)
  # check _tokenId is correct
  self.checkExitable(
    tokenId,
    start,
    end,
    _exitableEnd,
  )
  self.removeExitable(
    tokenId,
    start,
    end,
    _exitableEnd
  )
  assert exit.exitableAt < as_unitless_number(block.timestamp) and exit.extendedExitableAt < as_unitless_number(block.timestamp)
  assert exit.challengeCount == 0
  if exit.hasSig == 0:
    if tokenId == 0:
      send(exit.owner, as_wei_value(end - start, "wei") + EXIT_BOND)
    else:
      ERC20(self.listings[tokenId].tokenAddress).transfer(exit.owner, end - start)
      send(exit.owner, EXIT_BOND)
  else:
    send(exit.owner, FORCE_INCLUDE_BOND)
  clear(self.exits[_exitId])
  log.FinalizedExit(_exitId, start, end)

@public
def challengeTooOldExit(
  _utxoPos: uint256,
  _exitId: uint256,
  _segment: uint256,
  _txBytes: bytes[496],
  _proof: bytes[512],
  _sig: bytes[260]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  exit: Exit = self.exits[_exitId]
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.checkSegment(_segment, exit.segment)
  txHash: bytes32 = sha3(_txBytes)
  # if tx is 12 weeks before
  assert self.childChain[blkNum].blockTimestamp  < as_unitless_number(block.timestamp) - 12 * 7 * 24 * 60 * 60
  assert blkNum > exit.priority
  self.checkTransaction(
    tokenId,
    start,
    end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sig,
    outputIndex
  )
  # break exit
  clear(self.exits[_exitId])

# @dev mergeExitable
@public
def mergeExitable(
  _segment1: uint256,
  _segment2: uint256
):
  tokenId1: uint256
  start1: uint256
  end1: uint256
  tokenId2: uint256
  start2: uint256
  end2: uint256
  (tokenId1, start1, end1) = self.parseSegment(_segment1)
  (tokenId2, start2, end2) = self.parseSegment(_segment2)
  assert tokenId1 == tokenId2 and end1 == start2
  assert self.exitable[tokenId1][end1].start == start1
  assert self.exitable[tokenId1][end2].start == start2
  assert self.exitable[tokenId1][end1].isAvailable == self.exitable[tokenId1][end2].isAvailable
  self.exitable[tokenId1][end2].start = start1
  clear(self.exitable[tokenId1][end1])
  log.ExitableMerged(start1, end2)

# @dev getExit
@public
@constant
def getExit(
  _exitId: uint256
) -> (address, uint256):
  exit: Exit = self.exits[_exitId]
  return (exit.owner, exit.challengeCount)
