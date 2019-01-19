struct ChildChainBlock:
  root: bytes32
  blockTimestamp: timestamp

struct Exit:
  owner: address
  exitableAt: uint256
  utxoPos: uint256

struct Challenge:
  owner: address
  token: address
  amount: uint256

contract TransactionVerifier():
  def verify(
    _txBytes: bytes[1024],
    _sigs: bytes[65]
  ) -> bool: constant
  def getInputHash(
    _txBytes: bytes[1024],
    _inputIndex: uint256
  ) -> bytes32: constant
  def getOutputHash(
    _txBytes: bytes[1024],
    _outputIndex: uint256
  ) -> bytes32: constant
  def verifyOwner(
    _txBytes: bytes[1024],
    _outputIndex: uint256,
    _address: address
  ) -> bool: constant
  def checkWithin(
    _start: uint256,
    _end: uint256,
    _txBytes: bytes[1024]
  ) -> bool: constant

BlockSubmitted: event({_root: bytes32, _timestamp: timestamp, _blkNum: uint256})
Deposited: event({_depositer: address, _start: uint256, _end: uint256, _blkNum: uint256})
ExitStarted: event({_txHash: bytes32, _exitor: address, exitableAt: uint256, _start: uint256, _end: uint256})

operator: address
txverifier: address
childChain: map(uint256, ChildChainBlock)
currentChildBlock: uint256
totalDeposit: uint256
exits: map(bytes32, Exit)

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

# @dev Constructor
@public
def __init__(_txverifierAddress: address):
  self.operator = msg.sender
  self.currentChildBlock = 1
  self.totalDeposit = 0
  self.txverifier = create_with_code_of(_txverifierAddress)

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
  _sig: bytes[65]
):
  blkNum: uint256 = _utxoPos / 100
  outputIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  txHash: bytes32 = sha3(_txBytes)
  assert self.checkMembership(
    _end - _start,
    txHash,
    self.totalDeposit,
    _start,
    root,
    _proof
  ) == True
  assert TransactionVerifier(self.txverifier).verify(
    _txBytes,
    _sig)
  assert TransactionVerifier(self.txverifier).verifyOwner(
    _txBytes,
    outputIndex,
    msg.sender)
  exitableAt: uint256 = as_unitless_number(block.timestamp + 4 * 7 * 24 * 60 * 60)
  self.exits[txHash] = Exit({
    owner: msg.sender,
    exitableAt: exitableAt,
    utxoPos: _utxoPos
  })
  log.ExitStarted(txHash, msg.sender, exitableAt, _start, _end)

# @dev challenge
@public
def challenge(
  _exitTxBytes: bytes[1024],
  _utxoPos: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[65]
):
  exitTxHash: bytes32 = sha3(_exitTxBytes)
  blkNum: uint256 = _utxoPos / 100
  txoIndex: uint256 = _utxoPos - blkNum * 100
  root: bytes32 = self.childChain[blkNum].root
  assert self.checkMembership(
    _end - _start,
    sha3(_txBytes),
    self.totalDeposit,
    _start,
    root,
    _proof
  ) == True
  assert TransactionVerifier(self.txverifier).verify(
    _txBytes,
    _sig)
  spentTxoHash: bytes32
  if txoIndex < 10:
    # spent challenge
    spentTxoHash = TransactionVerifier(self.txverifier).getOutputHash(
      _exitTxBytes,
      txoIndex)
    assert blkNum > (self.exits[exitTxHash].utxoPos / 100)
  else:
    # double spent challenge
    spentTxoHash = TransactionVerifier(self.txverifier).getInputHash(
      _exitTxBytes,
      txoIndex - 10)
    assert blkNum < (self.exits[exitTxHash].utxoPos / 100)
  assert spentTxoHash == TransactionVerifier(self.txverifier).getInputHash(_txBytes, 0)
  self.exits[exitTxHash].owner = ZERO_ADDRESS
