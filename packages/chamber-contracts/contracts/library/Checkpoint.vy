# Checkpoint

struct Checkpoint:
  owner: address
  blkNum: uint256
  segment: uint256
  isAvailable: bool
  finalizeAt: uint256
  challengeCount: uint256

struct CheckpointChallenge:
  checkpointId: uint256
  owner: address

contract RootChain():
  def getFinalizedExit(
    _exitId: uint256
  ) -> (uint256, uint256): constant

rootchain: address
checkpoints: map(uint256, Checkpoint)
checkpointChallenges: map(uint256, CheckpointChallenge)
checkpointNonce: uint256
checkpointChallengeNonce: uint256

MASK8BYTES: constant(uint256) = 2 ** 64
EXIT_PERIOD_SECONDS: constant(uint256) = 4 * 7 * 24 * 60 * 60

# @dev from https://github.com/LayerXcom/plasma-mvp-vyper
@public
@constant
def ecrecoverSig(message: bytes32, sigs: bytes[65]) -> address:
  if len(sigs) != 65:
    return ZERO_ADDRESS
  # ref. https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d
  # The signature format is a compact form of:
  # {bytes32 r}{bytes32 s}{uint8 v}
  r: uint256 = extract32(sigs, 0, type=uint256)
  s: uint256 = extract32(sigs, 32, type=uint256)
  v: int128 = convert(slice(sigs, start=64, len=1), int128)
  # Version of signature should be 27 or 28, but 0 and 1 are also possible versions.
  # geth uses [0, 1] and some clients have followed. This might change, see:
  # https://github.com/ethereum/go-ethereum/issues/2053
  if v < 27:
    v += 27
  if v in [27, 28]:
    return ecrecover(message, convert(v, uint256), r, s)
  return ZERO_ADDRESS

@private
@constant
def parseSegment(
  segment: uint256
) -> (uint256, uint256, uint256):
  tokenId: uint256 = bitwise_and(shift(segment, -16), MASK8BYTES)
  start: uint256 = bitwise_and(shift(segment, -8), MASK8BYTES)
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
def __init__():
  self.checkpointNonce = 1
  self.checkpointChallengeNonce = 1

@public
def setRootChain(_rootchain: address):
  self.rootchain = _rootchain

@private
@constant
def decodePermission(
  _permission: bytes[128]
) -> (address, uint256, uint256):
  assert sha3("checkpoint") == extract32(_permission, 0, type=bytes32)
  return (
    # target
    extract32(_permission, 32*1, type=address),
    # blkNum
    extract32(_permission, 32*2, type=uint256),
    # segment
    extract32(_permission, 32*3, type=uint256)
  )

@private
@constant
def verifyCheckpointPermittion(
  _checkpointId: uint256,
  _permission: bytes[128],
  _sigs: bytes[65],
  _allower: address
) -> bool:
  target: address
  blkNum: uint256
  segment: uint256
  assert self.ecrecoverSig(sha3(_permission), _sigs) == _allower
  checkpoint: Checkpoint = self.checkpoints[_checkpointId]
  (target, blkNum, segment) = self.decodePermission(_permission)
  assert checkpoint.owner == target
  assert checkpoint.blkNum == blkNum
  assert checkpoint.segment == segment
  return True

@public
def requestCheckpoint(
  blkNum: uint256,
  segment: uint256
):
  self.checkpoints[self.checkpointNonce] = Checkpoint({
    owner: msg.sender,
    blkNum: blkNum,
    segment: segment,
    finalizeAt: as_unitless_number(block.timestamp) + 3 * EXIT_PERIOD_SECONDS,
    isAvailable: False,
    challengeCount: 0
  })
  self.checkpointNonce += 1

@public
def challengeCheckpoint(
  _checkpointId: uint256,
  _exitId: uint256
):
  exitBlkNum: uint256
  exitSegment: uint256
  (exitBlkNum, exitSegment) = RootChain(self.rootchain).getFinalizedExit(_exitId)
  assert exitBlkNum < self.checkpoints[_checkpointId].blkNum
  self.checkSegment(self.checkpoints[_checkpointId].segment, exitSegment)
  self.checkpoints[_checkpointId].challengeCount += 1
  if(self.checkpoints[_checkpointId].challengeCount > 10):
    clear(self.checkpoints[_checkpointId])
  self.checkpointChallenges[self.checkpointChallengeNonce] = CheckpointChallenge({
    checkpointId: _checkpointId,
    owner: msg.sender
  })
  self.checkpointChallengeNonce += 1

@public
def respondChallengeCheckpoint(
  _checkpointChallengeId: uint256,
  _allow: bytes[32],
  _sigs: bytes[65]
):
  checkpointId: uint256 = self.checkpointChallenges[_checkpointChallengeId].checkpointId
  assert self.verifyCheckpointPermittion(checkpointId, _allow, _sigs, msg.sender)
  self.checkpoints[checkpointId].challengeCount -= 1
  clear(self.checkpointChallenges[_checkpointChallengeId])

@public
def finalizeCheckpoint(
  _checkpointId: uint256
):
  assert self.checkpoints[_checkpointId].finalizeAt < as_unitless_number(block.timestamp)
  assert self.checkpoints[_checkpointId].challengeCount == 0
  assert self.checkpoints[_checkpointId].blkNum > 0
  self.checkpoints[_checkpointId].isAvailable = True

@public
def getCheckpoint(
  _checkpointId: uint256
) -> (uint256, uint256):
  checkpoint: Checkpoint = self.checkpoints[_checkpointId]
  assert checkpoint.isAvailable
  return (checkpoint.blkNum, checkpoint.segment)
