# multisig
contract VerifierUtil():
  def ecrecoverSig(
    _txHash: bytes32,
    _sig: bytes[260],
    index: int128
  ) -> address: constant
  def parseSegment(
    segment: uint256
  ) -> (uint256, uint256, uint256): constant
  def encodeSegment(
    tokenId: uint256,
    start: uint256,
    end: uint256
  ) -> (uint256):constant
  def isContainSegment(
    segment: uint256,
    small: uint256
  ) -> (bool): constant

contract OwnStateVerifier():
  def encodeSpentEvidence(
    segment: uint256,
    blkNum: uint256,
    sigs: bytes[65]
  ) -> (bytes[129]): constant
  def encodeState(
    owner: address,
    segment: uint256,
    blkNum: uint256
  ) -> (bytes[256]): constant
  def decodeState(
    stateBytes: bytes[256]
  ) -> (address, uint256, uint256, uint256): constant

verifierUtil: public(address)
ownStateVerifier: public(address)

@private
@constant
def decodeSwap(
  _txBytes: bytes[496],
) -> (address, uint256, uint256, address, uint256, uint256):
  #  from1, segment1, blkNum1, from2, segment2, blkNum2
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    extract32(_txBytes, 64 + 16, type=uint256),
    extract32(_txBytes, 96 + 16, type=address),
    extract32(_txBytes, 128 + 16, type=uint256),
    extract32(_txBytes, 160 + 16, type=uint256))

# @dev Constructor
@public
def __init__(_verifierUtil: address, _ownStateVerifier: address):
  self.verifierUtil = _verifierUtil
  self.ownStateVerifier = _ownStateVerifier

# verify swap transactions can exit
@public
@constant
def isExitGamable(
  _label: uint256,
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _segment: uint256,
  _hasSig: uint256
) -> (bool):
  from1: address
  segment1: uint256
  blkNum1: uint256
  from2: address
  segment2: uint256
  blkNum2: uint256
  (from1, segment1, blkNum1, from2, segment2, blkNum2) = self.decodeSwap(_txBytes)
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert _owner == from2
    elif _outputIndex == 1:
      assert _owner == from1
  if _outputIndex == 0:
    assert VerifierUtil(self.verifierUtil).isContainSegment(segment1, _segment)
  elif _outputIndex == 1:
    assert VerifierUtil(self.verifierUtil).isContainSegment(segment2, _segment)
  check1: bool = VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, _sigs, 0) == from1
  check2: bool = VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, _sigs, 1) == from2
  assert check1 and check2
  if _hasSig == 0:
    assert VerifierUtil(self.verifierUtil).ecrecoverSig(_merkleHash, _sigs, 2) == from1 and VerifierUtil(self.verifierUtil).ecrecoverSig(_merkleHash, _sigs, 3) == from2
  elif _hasSig == 1:
    assert VerifierUtil(self.verifierUtil).ecrecoverSig(_merkleHash, _sigs, 2) == from1
  elif _hasSig == 2:
    assert VerifierUtil(self.verifierUtil).ecrecoverSig(_merkleHash, _sigs, 2) == from2
  return True

@public
@constant
def getOutput(
  _label: uint256,
  _txBytes: bytes[496],
  _txBlkNum: uint256,
  _index: uint256
) -> (bytes[256]):
  from1: address
  segment1: uint256
  blkNum1: uint256
  from2: address
  segment2: uint256
  blkNum2: uint256
  (from1, segment1, blkNum1, from2, segment2, blkNum2) = self.decodeSwap(_txBytes)
  if _index == 0:
    return OwnStateVerifier(self.ownStateVerifier).encodeState(from2, segment1, _txBlkNum)
  elif _index == 1:
    return OwnStateVerifier(self.ownStateVerifier).encodeState(from1, segment2, _txBlkNum)

@public
@constant
def getSpentEvidence(
  _label: uint256,
  _txBytes: bytes[496],
  _index: uint256,
  _sigs: bytes[260]
) -> (bytes[256]):
  # from, segment, blkNum, to
  from1: address
  segment1: uint256
  blkNum1: uint256
  from2: address
  segment2: uint256
  blkNum2: uint256
  (from1, segment1, blkNum1, from2, segment2, blkNum2) = self.decodeSwap(_txBytes)
  if _index == 0:
    return OwnStateVerifier(self.ownStateVerifier).encodeSpentEvidence(
      segment1,
      blkNum1,
      slice(_sigs, start=0, len=65)
    )
  elif _index == 1:
    return OwnStateVerifier(self.ownStateVerifier).encodeSpentEvidence(
      segment2,
      blkNum2,
      slice(_sigs, start=65, len=65)
    )
