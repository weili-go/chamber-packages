contract StandardVerifier():
  def verifyTransfer(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfTransfer(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifySplit(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfSplit(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifyMerge(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfMerge(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant


contract MultisigVerifier():
  def verifySwap(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def verifySwapForceInclude(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _tBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _start: uint256,
    _end: uint256,
    _hasSig: uint256
  ) -> bool: constant
  def getTxoHashOfSwap(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifyMultisig2(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfMultisig2(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant

contract EscrowVerifier():
  def verify(
    _label: uint256,
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHash(
    _label: uint256,
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant

stdverifier: address
multisigverifier: address
escrowverifier: address

@private
@constant
def decodeBaseTx(_tBytes: bytes[1024]) -> (uint256, bytes[1024]):
  # label, body
  txList = RLPList(_tBytes, [
    uint256, bytes])
  return txList[0], txList[1]

@private
@constant
def getOwnState(
  owner: address,
  start: uint256,
  end: uint256,
  blkNum: uint256
) -> (bytes32):
  return sha3(
      concat("own",
        convert(owner, bytes32),
        convert(start, bytes32),
        convert(end, bytes32),
        convert(blkNum, bytes32)
      )
    )

@public
@constant
def getDepositHash(
  _tBytes: bytes[1024]
) -> (bytes32):
  label: uint256
  body: bytes[1024]
  (label, body) = self.decodeBaseTx(_tBytes)
  if label == 5:
    txList = RLPList(body, [
      address, address, uint256, uint256])
    return sha3(
            concat(
              convert(txList[0], bytes32),
              convert(txList[1], bytes32),
              convert(txList[2], bytes32),
              convert(txList[3], bytes32)
            )
          )

@private
@constant
def verifyDepositTx(
  _tBytes: bytes[1024],
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  # depositor, token, start, end
  txList = RLPList(_tBytes, [
    address, address, uint256, uint256])
  assert _start == txList[2]
  assert _end == txList[3]
  if _owner != ZERO_ADDRESS:
    assert _owner == txList[0]
  return True

@private
@constant
def getDepositTxoHash(
  _tBytes: bytes[1024],
  _blkNum: uint256
) -> bytes32:
  # depositor, token, start, end
  txList = RLPList(_tBytes, [
    address, address, uint256, uint256])
  return self.getOwnState(txList[0], txList[2], txList[3], _blkNum)

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
  _txBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> bool:
  label: uint256
  body: bytes[1024]
  (label, body) = self.decodeBaseTx(_txBytes)
  if label == 1:
    return StandardVerifier(self.stdverifier).verifyTransfer(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 2:
    return StandardVerifier(self.stdverifier).verifySplit(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 3:
    return StandardVerifier(self.stdverifier).verifyMerge(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 4:
    return MultisigVerifier(self.multisigverifier).verifySwap(_txHash, _merkleHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 5:
    return self.verifyDepositTx(body, _owner, _start, _end)
  elif label == 10:
    return MultisigVerifier(self.multisigverifier).verifyMultisig2(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label >= 20:
    return EscrowVerifier(self.escrowverifier).verify(label, _txHash, _merkleHash, body, _sigs, _outputIndex, _owner, _start, _end)
  return False

@public
@constant
def verifyForceInclude(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _start: uint256,
  _end: uint256,
  _hasSig: uint256
) -> bool:
  label: uint256
  body: bytes[1024]
  (label, body) = self.decodeBaseTx(_txBytes)
  if label == 4:
    return MultisigVerifier(self.multisigverifier).verifySwapForceInclude(
      _txHash, _merkleHash, body, _sigs, _outputIndex, _start, _end, _hasSig)
  return False

# @dev get hash of input state of the transaction
@public
@constant
def getTxoHash(
  _txBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> bytes32:
  label: uint256
  body: bytes[1024]
  (label, body) = self.decodeBaseTx(_txBytes)
  if label == 1:
    return StandardVerifier(self.stdverifier).getTxoHashOfTransfer(body, _index, _blkNum)
  elif label == 2:
    return StandardVerifier(self.stdverifier).getTxoHashOfSplit(body, _index, _blkNum)
  elif label == 3:
    return StandardVerifier(self.stdverifier).getTxoHashOfMerge(body, _index, _blkNum)
  elif label == 4:
    return MultisigVerifier(self.multisigverifier).getTxoHashOfSwap(body, _index, _blkNum)
  elif label == 5:
    return self.getDepositTxoHash(body, _blkNum)
  elif label == 10:
    return MultisigVerifier(self.multisigverifier).getTxoHashOfMultisig2(body, _index, _blkNum)
  elif label >= 20:
    return EscrowVerifier(self.escrowverifier).getTxoHash(label, body, _index, _blkNum)
  return sha3("txo")
