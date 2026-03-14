# frontend context

## location
/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/frontend

## stack
- next.js 14 + app router + typescript + tailwind + shadcn/ui
- shadcn components: Card, Button, Input, Label, Badge, Toast, Textarea

## pages
/ → landing: explain spongewallet, base sepolia only, for AI agents
/create → POST /v1/wallets → redirect to /policy?walletId=x
/policy → POST /v1/wallets/:id/policy then POST /v1/wallets/:id/api-keys → store apiKey in sessionStorage → redirect to /setup/:walletId
/setup/[walletId] → THE MONEY PAGE: api key shown once, MCP URL, claude mcp add command, openclaw skill url, policy summary

## setup page — 6 required cards
1. API Key — monospace, copy button, "Save this — never shown again" warning badge
2. MCP URL — monospace: http://localhost:3001/mcp
3. Claude Code command — dark code block with copy:
   claude mcp add --transport http spongewallet http://localhost:3001/mcp --header "Authorization: Bearer {apiKey}"
4. OpenClaw — instruction + copy:
   Tell your OpenClaw: /install http://localhost:3001/skills/openclaw.md?walletId={walletId}&apiKey={apiKey}
5. Policy summary — expiry, remaining tx, max per tx, recipients as badges
6. Wallet — address with copy + basescan link

## design rules
- dark theme throughout
- monospace font for addresses, keys, code blocks (font-mono)
- yellow warning banner on setup page for api key visibility
- loading states on all async actions
- error handling with toast notifications
- use shadcn components throughout

## important
- api key shown ONCE — retrieved from sessionStorage on setup page
- frontend NEVER touches chain directly
- all data from backend REST APIs at http://localhost:3001
- validate ethereum addresses on policy page (0x + 40 hex chars)
