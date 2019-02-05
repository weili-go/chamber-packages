chamber-packages
=====

[![Build Status](https://travis-ci.org/cryptoeconomicslab/chamber-packages.svg?branch=master)](https://travis-ci.org/cryptoeconomicslab/chamber-packages)
[![Coverage Status](https://coveralls.io/repos/github/cryptoeconomicslab/chamber-packages/badge.svg?branch=master)](https://coveralls.io/github/cryptoeconomicslab/chamber-packages?branch=master)


## Overview

Layer2 modules for Plasma Chamber.

## How to test

Install dependencies.

```
npm i lerna -g
lerna bootstrap
```

Build and run tests.

```
yarn build
yarn test
```

## Features

### core
The core module of Plasma.
The definition of Transaction and Block.
Utilities for Plasma core logic.

### contracts
Vyper contract for deposit, submit, exit, challenge, withdraw and verification of application specific state transition.

### childchain
Child chain implementation using the core module.
Collect transactions, verify these, generate a block and submit.

### wallet
Wallet implementation.
Responsibilities of wallet are calculating UTXOs,
the interface of some methods for root chain(deposit, startExit, and challenge), and history verification.
