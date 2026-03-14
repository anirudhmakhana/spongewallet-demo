# frontend context

## stack
- next.js + app router + typescript + tailwind + shadcn/ui

## pages
- `/` — landing page for gasless USDC wallet
- `/create` — single-step wallet + policy creation
- `/policy` — legacy redirect
- `/setup/[walletId]` — api key, Claude command, skill URL, wallet address, policy summary

## important
- UI copy must describe USDC only
- setup page must say Gelato sponsors gas
- skill URL should not embed the raw API key
- frontend never talks to chain providers directly
