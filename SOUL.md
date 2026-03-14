# SOUL.md

This repo is no longer the original local-key ETH prototype.

## Current architecture

- Turnkey manages wallet keys and signing
- the app stores only wallet metadata and bcrypt-hashed API keys
- Base Sepolia USDC is the only supported asset
- Gelato sponsors gas for relay submission
- policy enforcement remains server-side

## Intentional constraints

- no `ethers`
- no multi-chain support
- no ETH sends
- no ERC-4337
- no paymaster/account-abstraction path

## Trust model

This is still a managed wallet system. Turnkey reduces raw key exposure, but the backend remains the control plane that decides whether a transfer is allowed and when to submit it.
