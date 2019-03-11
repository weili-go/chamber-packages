#
# Escrow State
#

contract VerifierUtil():
  def ecrecoverSig(
    _txHash: bytes32,
    _sig: bytes[260],
    index: int128
  ) -> address: constant
  def parseSegment(
    segment: uint256
  ) -> (uint256, uint256, uint256): constant
  def isContainSegment(
    segment: uint256,
    small: uint256
  ) -> (bool): constant

verifierUtil: public(address)

# evidence of escrow
@public
@constant
def encodeSpentEvidence(
  segment: uint256,
  blkNum: uint256,
  sigs: bytes[65]
) -> (bytes[129]):
  return concat(
    convert(segment, bytes32),
    convert(blkNum, bytes32),
    sigs
  )

@public
@constant
def decodeSpentEvidence(
  witnessBytes: bytes[129]
) -> (uint256, uint256, bytes[65]):
  return (
    extract32(witnessBytes, 32*0, type=uint256),
    extract32(witnessBytes, 32*1, type=uint256),
    slice(witnessBytes, start=32*2, len=65)
  )

# @dev Constructor
@public
def __init__(_verifierUtil: address):
  self.verifierUtil = _verifierUtil

@public
@constant
def decodeState(
  stateBytes: bytes[256]
) -> (address, uint256, uint256, address, address, uint256):
  # owner, segment, blkNum, to, ttp, timeout
  assert self == extract32(stateBytes, 0, type=address)
  return (
    extract32(stateBytes, 32*1, type=address),
    extract32(stateBytes, 32*2, type=uint256),
    extract32(stateBytes, 32*3, type=uint256),
    extract32(stateBytes, 32*4, type=address),
    extract32(stateBytes, 32*5, type=address),
    extract32(stateBytes, 32*6, type=uint256)
  )

# single owner state
@public
@constant
def isSpent(
  _txHash: bytes32,
  _stateBytes: bytes[256],
  _evidence: bytes[129],
  _timestamp: uint256
) -> (bool):
  # owner, segment, blkNum, to, ttp, timeout
  exitOwner: address
  exitSegment: uint256
  exitBlkNum: uint256
  exitTo: address
  exitTtp: address
  exitTimeout: uint256
  challengeSegment: uint256
  challengeBlkNum: uint256
  sigs: bytes[65]
  (exitOwner, exitSegment, exitBlkNum, exitTo, exitTtp, exitTimeout) = self.decodeState(_stateBytes)
  (challengeSegment, challengeBlkNum, sigs) = self.decodeSpentEvidence(_evidence)
  assert VerifierUtil(self.verifierUtil).isContainSegment(exitSegment, challengeSegment)
  signer: address = VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, sigs, 0)
  if signer == exitTtp: # unlock
    return True
  elif signer == exitOwner: # cancel
    return _timestamp >= exitTimeout
  assert challengeBlkNum == exitBlkNum
  return True

@public
@constant
def encodeState(
  owner: address,
  segment: uint256,
  blkNum: uint256,
  to: address,
  ttp: address,
  timeout: uint256
) -> (bytes[256]):
  return concat(
    convert(self, bytes32),
    convert(owner, bytes32),
    convert(segment, bytes32),
    convert(blkNum, bytes32),
    convert(to, bytes32),
    convert(ttp, bytes32),
    convert(timeout, bytes32)
  )
