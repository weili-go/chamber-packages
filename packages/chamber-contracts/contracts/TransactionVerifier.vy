contract StandardVerifier():
  def verifyTransfer(
    _txHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfTransfer(
    _txBytes: bytes[496],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifySplit(
    _txHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfSplit(
    _txBytes: bytes[496],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifyMerge(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfMerge(
    _txBytes: bytes[496],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant


contract MultisigVerifier():
  def verifySwap(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def verifySwapForceInclude(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256,
    _hasSig: uint256
  ) -> bool: constant
  def getTxoHashOfSwap(
    _txBytes: bytes[496],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifyMultisig2(
    _txHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfMultisig2(
    _txBytes: bytes[496],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant

contract EscrowVerifier():
  def verify(
    _label: uint256,
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256,
    _timestamp: uint256
  ) -> bool: constant
  def getTxoHash(
    _label: uint256,
    _txBytes: bytes[496],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant

stdverifier: address
multisigverifier: address
escrowverifier: address

# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48

@public
@constant
def decodeBaseTx(_txBytes: bytes[496]) -> (uint256, uint256):
  # label, maxBlock
  return (convert(slice(_txBytes, start=0, len=8), uint256),
          convert(slice(_txBytes, start=8, len=8), uint256))

@private
@constant
def getOwnState(
  owner: address,
  tokenId: uint256,
  start: uint256,
  end: uint256,
  blkNum: uint256
) -> (bytes32):
  return sha3(
      concat("own",
        convert(owner, bytes32),
        convert(tokenId, bytes32),
        convert(start, bytes32),
        convert(end, bytes32),
        convert(blkNum, bytes32)
      )
    )

# @dev decodeDeposit
# error occurred if it's @private
@public
@constant
def decodeDeposit(
  _txBytes: bytes[496]
) -> (address, uint256, uint256, uint256):
  # depositor, token, start, end
  segment: uint256 = extract32(_txBytes, 64 + 16, type=uint256)
  start: uint256 = segment / TOTAL_DEPOSIT
  end: uint256 = segment - start * TOTAL_DEPOSIT
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    start,
    end)

@public
@constant
def getDepositHash(
  _txBytes: bytes[496]
) -> (bytes32):
  #label: uint256
  #maxBlock: uint256
  #(label, maxBlock) = self.decodeBaseTx(_txBytes)
  depositor: address
  token: uint256
  start: uint256
  end: uint256
  (depositor, token, start, end) = self.decodeDeposit(_txBytes)
  return sha3(
          concat(
            convert(depositor, bytes32),
            convert(token, bytes32),
            convert(start, bytes32),
            convert(end, bytes32)
          )
        )

@public
@constant
def verifyDepositTx(
  _txBytes: bytes[496],
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256
) -> (bool):
  depositor: address
  token: uint256
  start: uint256
  end: uint256
  (depositor, token, start, end) = self.decodeDeposit(_txBytes)
  assert _tokenId == token and _start >= start and _end <= end
  if _owner != ZERO_ADDRESS:
    assert _owner == depositor
  return True

@public
@constant
def getDepositTxoHash(
  _txBytes: bytes[496],
  _blkNum: uint256
) -> bytes32:
  depositor: address
  token: uint256
  start: uint256
  end: uint256
  (depositor, token, start, end) = self.decodeDeposit(_txBytes)
  return self.getOwnState(depositor, token, start, end, _blkNum)

# @dev Constructor
@public
def __init__(_stdverifier: address, _multisig: address, _escrow: address):
  self.stdverifier = _stdverifier
  self.multisigverifier = _multisig
  self.escrowverifier = _escrow

# @dev verify the transaction is signed correctly
@public
@constant
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
  _end: uint256,
  _timestamp: uint256
) -> bool:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if _hasSig > 0:
    if label == 5:
      return MultisigVerifier(self.multisigverifier).verifySwapForceInclude(
        _txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _tokenId, _start, _end, _hasSig)
  else:
    if label == 1:
      return StandardVerifier(self.stdverifier).verifyTransfer(_txHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end)
    elif label == 2:
      return StandardVerifier(self.stdverifier).verifySplit(_txHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end)
    elif label == 3:
      return StandardVerifier(self.stdverifier).verifyMerge(_txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end)
    elif label == 4:
      return self.verifyDepositTx(_txBytes, _owner, _tokenId, _start, _end)
    elif label == 5:
      return MultisigVerifier(self.multisigverifier).verifySwap(_txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end)
    elif label == 10:
      return MultisigVerifier(self.multisigverifier).verifyMultisig2(_txHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end)
    elif label >= 20:
      return EscrowVerifier(self.escrowverifier).verify(label, _txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end, _timestamp)
  return False

# @dev get hash of input state of the transaction
@public
@constant
def getTxoHash(
  _txBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> bytes32:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if label == 1:
    return StandardVerifier(self.stdverifier).getTxoHashOfTransfer(_txBytes, _index, _blkNum)
  elif label == 2:
    return StandardVerifier(self.stdverifier).getTxoHashOfSplit(_txBytes, _index, _blkNum)
  elif label == 3:
    return StandardVerifier(self.stdverifier).getTxoHashOfMerge(_txBytes, _index, _blkNum)
  elif label == 4:
    return self.getDepositTxoHash(_txBytes, _blkNum)
  elif label == 5:
    return MultisigVerifier(self.multisigverifier).getTxoHashOfSwap(_txBytes, _index, _blkNum)
  elif label == 10:
    return MultisigVerifier(self.multisigverifier).getTxoHashOfMultisig2(_txBytes, _index, _blkNum)
  elif label >= 20:
    return EscrowVerifier(self.escrowverifier).getTxoHash(label, _txBytes, _index, _blkNum)
  return sha3("txo")

@public
@constant
def doesRequireConfsig(
  _txBytes: bytes[496]
) -> bool:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if label == 1:
    return False
  elif label == 2:
    return False
  elif label == 3:
    return True
  elif label == 4:
    return False
  elif label == 5:
    return True
  elif label == 10:
    return True
  elif label >= 20:
    return True
  return False