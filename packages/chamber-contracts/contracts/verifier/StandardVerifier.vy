#
# Library
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
  ) -> (bytes[256]): constant
  def encodeState(
    owner: address,
    segment: uint256,
    blkNum: uint256
  ) -> (bytes[256]): constant
  def decodeState(
    stateBytes: bytes[256]
  ) -> (address, uint256, uint256): constant


verifierUtil: public(address)
ownStateVerifier: public(address)

#
# private functions
#

# @dev decode transfer tx
@public
@constant
def decodeTransfer(
  _txBytes: bytes[496],
) -> (address, uint256, uint256, address):
  # from, segment, blkNum, to
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    extract32(_txBytes, 64 + 16, type=uint256),
    extract32(_txBytes, 96 + 16, type=address))

# verify that transfer tx can exit
@private
@constant
def isExitGamableTransfer(
  _txHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _segment: uint256
) -> (bool):
  # from, start, end, blkNum, to1, to2, offset
  _from: address
  segment: uint256
  blkNum: uint256
  to: address
  (_from, segment, blkNum, to) = self.decodeTransfer(_txBytes)
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert(_owner == to)
  assert VerifierUtil(self.verifierUtil).isContainSegment(segment, _segment)
  assert VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, _sigs, 0) == _from
  return True

# merge
@private
@constant
def isExitGamableMerge(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _segment: uint256
) -> (bool):
  # from, start, offset, end, blkNum1, blkNum2, to
  _from: address
  segment: uint256
  offset: uint256
  to: address
  (_from, segment, offset, to) = self.decodeTransfer(_txBytes)
  if _owner != ZERO_ADDRESS:
    assert(_owner == to)
  assert VerifierUtil(self.verifierUtil).isContainSegment(segment, _segment)
  assert VerifierUtil(self.verifierUtil).ecrecoverSig(_merkleHash, _sigs, 1) == _from
  assert VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, _sigs, 0) == _from
  return True

@public
@constant
def getOutputOfTransfer(
  _txBytes: bytes[496],
  _txBlkNum: uint256,
  _index: uint256
) -> (bytes[256]):
  _from: address
  segment: uint256
  blkNum: uint256
  to: address
  (_from, segment, blkNum, to) = self.decodeTransfer(_txBytes)
  return OwnStateVerifier(self.ownStateVerifier).encodeState(to, segment, _txBlkNum)

@private
@constant
def getOutputOfMerge(
  _txBytes: bytes[496],
  _txBlkNum: uint256,
  _index: uint256
) -> (bytes[256]):
  _from: address
  segment: uint256
  offset: uint256
  to: address
  (_from, segment, offset, to) = self.decodeTransfer(_txBytes)
  return OwnStateVerifier(self.ownStateVerifier).encodeState(to, segment, _txBlkNum)

@private
@constant
def getSpentEvidenceOfTransfer(
  _txBytes: bytes[496],
  _index: uint256,
  _sigs: bytes[65]
) -> (bytes[256]):
  # from, segment, blkNum, to
  _from: address
  segment: uint256
  to: address
  blkNum: uint256
  (_from, segment, blkNum, to) = self.decodeTransfer(_txBytes)
  return OwnStateVerifier(self.ownStateVerifier).encodeSpentEvidence(
    segment,
    blkNum,
    _sigs
  )

@private
@constant
def getSpentEvidenceOfMerge(
  _txBytes: bytes[496],
  _index: uint256,
  _sigs: bytes[65]
) -> (bytes[256]):
  # from, start, offset, end, blkNum1, blkNum2, to
  _from: address
  segment: uint256
  offset: uint256
  to: address
  (_from, segment, offset, to) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = VerifierUtil(self.verifierUtil).parseSegment(segment)
  blkNum: uint256
  witnessSegment: uint256
  if _index == 0:
    blkNum = extract32(_txBytes, 128 + 16, type=uint256)
    witnessSegment = VerifierUtil(self.verifierUtil).encodeSegment(tokenId, start, offset)
  elif _index == 1:
    blkNum = extract32(_txBytes, 160 + 16, type=uint256)
    witnessSegment = VerifierUtil(self.verifierUtil).encodeSegment(tokenId, offset, end)
  else:
    assert False
  return OwnStateVerifier(self.ownStateVerifier).encodeSpentEvidence(
    witnessSegment,
    blkNum,
    _sigs
  )

# @dev Constructor
@public
def __init__(_verifierUtil: address, _ownStateVerifier: address):
  self.verifierUtil = _verifierUtil
  self.ownStateVerifier = _ownStateVerifier

# verify standard transactions can exit
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
  if _label == 1:
    return self.isExitGamableTransfer(_txHash, _txBytes, _sigs, _outputIndex, _owner, _segment)
  elif _label == 2:
    return self.isExitGamableMerge(_txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _segment)

@public
@constant
def getOutput(
  _label: uint256,
  _txBytes: bytes[496],
  _txBlkNum: uint256,
  _index: uint256
) -> (bytes[256]):
  if _label == 1:
    return self.getOutputOfTransfer(_txBytes, _txBlkNum, _index)
  elif _label == 2:
    return self.getOutputOfMerge(_txBytes, _txBlkNum, _index)

@public
@constant
def getSpentEvidence(
  _label: uint256,
  _txBytes: bytes[496],
  _index: uint256,
  _sigs: bytes[260]
) -> (bytes[256]):
  sigs: bytes[65] = slice(_sigs, start=0, len=65)
  if _label == 1:
    return self.getSpentEvidenceOfTransfer(_txBytes, _index, sigs)
  elif _label == 2:
    return self.getSpentEvidenceOfMerge(_txBytes, _index, sigs)
