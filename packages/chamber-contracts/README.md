@layer2/contracts


## Deploy

launch ganache.

```
ganache-cli --mnemonic 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
```

deploy RLP decoder and Plasma contracts.
And please note RootChain address.

>   RootChain: 0xaa588d3737b611bafd7bd713445b314bd453a5c8


```
$ node scripts/deploy.js http://127.0.0.1:8545 0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3

deployed RLP decoder!!
Migrations 0xF12b5dd4EAD5F743C6BaA640B0216200e89B60Da
StandardVerifier 0xf25186B5081Ff5cE73482AD761DB0eB0d25abfBF
EscrowVerifier 0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F
MultisigVerifier 0x9FBDa871d559710256a2502A2517b794B482Db40
TransactionVerifier 0x2C2B9C9a4a25e24B174f26114e8926a9f2128FE4
RootChain 0x30753E4A8aad7F8597332E813735Def5dD395028
FastFinality 0xFB88dE099e13c3ED21F80a7a1E49f8CAEcF10df6
deployed contracts!!
```
