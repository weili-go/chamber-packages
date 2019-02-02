@layer2/contracts


## Deploy

launch ganache.

```
ganache-cli --mnemonic 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
```

deploy RLP decoder and Plasma contracts.

```
node deploy.js http://127.0.0.1:8545 0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3
truffle migrate --network local
```
