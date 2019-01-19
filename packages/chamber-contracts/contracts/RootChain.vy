struct ChildChainBlock:
  root: bytes32
  blockTimestamp: timestamp

struct Exit:
  owner: address
  token: address
  amount: uint256

struct Challenge:
  owner: address
  token: address
  amount: uint256

BlockSubmitted: event({_root: bytes32, _timestamp: timestamp, _blkNum: uint256})
Deposited: event({_depositer: address, _start: uint256, _end: uint256, _blkNum: uint256})
ExitStarted: event({_exitor: address, _start: uint256, _end: uint256})
Check: event({_root: bytes32, _root2: bytes32})
Check1: event({_root: uint256})

operator: address
childChain: map(uint256, ChildChainBlock)
currentChildBlock: uint256
totalDeposit: uint256


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
def __init__():
  self.operator = msg.sender
  self.currentChildBlock = 1
  self.totalDeposit = 0

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
  _blkNum: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[65]
):
  root: bytes32 = self.childChain[_blkNum].root
  assert self.checkMembership(
    _end - _start,
    sha3(_txBytes),
    self.totalDeposit,
    _start,
    root,
    _proof
  ) == True
  log.ExitStarted(msg.sender, _start, _end)

# @dev challenge
@public
def challenge(
  _blkNum: uint256,
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sig: bytes[65]
):
  root: bytes32 = self.childChain[_blkNum].root
  assert self.checkMembership(
    _end - _start,
    sha3(_txBytes),
    self.totalDeposit,
    _start,
    root,
    _proof
  ) == True
