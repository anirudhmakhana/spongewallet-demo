# frontend context

## stack

- next.js
- app router
- typescript
- tailwind
- shadcn/ui

## pages

- `/` — landing page plus API-key-based restore
- `/create` — single-step wallet + policy creation
- `/policy` — legacy redirect
- `/setup/[walletId]` — API key, Claude command, skill URL, smart account funding address, policy summary

## important product rules

- UI copy must describe USDC only
- UI copy must describe the wallet as a sponsored smart account
- setup page must say Pimlico sponsors user operations
- the displayed funding address is the smart account address
- skill URL should not embed the raw API key
- frontend never talks to chain providers directly

## session model

- the raw API key is shown once and stored in `sessionStorage`
- restore flow uses `GET /v1/me` with a saved API key
- `address` returned from the backend means smart account address
