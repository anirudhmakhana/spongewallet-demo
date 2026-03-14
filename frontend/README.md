# SpongeWallet Frontend

Next.js 14 App Router frontend for creating and configuring agent wallets. All chain interactions go through the backend REST API — the frontend never touches a private key or connects to a node directly.

---

## Directory structure

```
frontend/
├── app/
│   ├── layout.tsx                      # Root layout — Toaster provider, global font
│   ├── page.tsx                        # / — Landing page
│   ├── create/
│   │   └── page.tsx                    # /create — Wallet + policy creation form
│   ├── policy/
│   │   └── page.tsx                    # /policy — Redirects to /create (deprecated flow)
│   └── setup/
│       └── [walletId]/
│           └── page.tsx                # /setup/:walletId — Post-creation setup page
├── components/
│   └── ui/                             # shadcn/ui components (Button, Card, Input, etc.)
├── .env.local (or .env)                # NEXT_PUBLIC_BACKEND_URL
└── package.json
```

---

## Environment

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

All pages fall back to `http://localhost:3001` if the variable is not set. For production, set this to your deployed backend URL.

---

## Page-by-page flow

### `/` — Landing page (`app/page.tsx`)

Static page. No API calls. Just a headline, three bullet points explaining what SpongeWallet does, and a single CTA button linking to `/create`.

---

### `/create` — Create page (`app/create/page.tsx`)

The entire wallet setup happens here in one form submission.

**Form fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Wallet name | text input | empty | Optional label stored server-side |
| Expires in | native `<select>` | 24 hours | Converted to `expiresAt` ms at submit time |
| Max transactions | number input | 10 | Total sends the agent can make |
| Max per tx ETH | text input | 0.01 | Per-send ceiling |
| Allowed recipients | textarea | empty | Newline-separated Ethereum addresses |

**Client-side validation (before the API call):**

```typescript
// At least one recipient
if (recipients.length === 0) → toast.error

// Each address matches 0x + 40 hex chars
/^0x[0-9a-fA-F]{40}$/.test(addr) → toast.error if fails

// maxTransactions is a positive integer
parseInt(value, 10) >= 1 → toast.error if fails

// maxAmountPerTxEth is a parseable decimal
parseFloat(value) not NaN → toast.error if fails
```

**Submit flow:**

```typescript
// 1. Calculate absolute expiry from relative selection
const expiresAt = Date.now() + expiresInMs   // e.g. Date.now() + 86400000

// 2. Single POST to create wallet + policy + API key atomically
const res = await fetch(`${BACKEND_URL}/v1/wallets`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: name || undefined,
    expiresAt,
    maxTransactions: maxTx,
    maxAmountPerTxEth,
    allowedRecipients: recipients
  })
})

// 3. Destructure the one-time response
const { walletId, address, apiKey } = await res.json()

// 4. Persist to sessionStorage — apiKey survives navigation within the tab
//    but disappears on tab close, preventing long-term exposure
sessionStorage.setItem(`apiKey_${walletId}`, apiKey)
sessionStorage.setItem(`address_${walletId}`, address)

// 5. Navigate to setup page
router.push(`/setup/${walletId}`)
```

If the backend returns an error, the JSON `.error` field is surfaced as a toast. The loading state on the button prevents double-submission.

---

### `/policy` — Policy page (`app/policy/page.tsx`)

Replaced with a `useEffect` redirect to `/create`. This route previously handled the second step of a 3-step flow (wallet → policy → api-key). With the unified endpoint, it's obsolete. The redirect exists to avoid 404s if any bookmarks or old links point here.

---

### `/setup/[walletId]` — Setup page (`app/setup/[walletId]/page.tsx`)

The payoff page. Shown immediately after wallet creation. Five cards.

**Data loading:**

```typescript
useEffect(() => {
  // API key from sessionStorage — set by /create on success
  const storedKey = sessionStorage.getItem(`apiKey_${walletId}`)
  setApiKey(storedKey)

  // Wallet + policy from backend (public endpoint, no auth needed)
  fetch(`${BACKEND_URL}/v1/wallets/${walletId}`)
    .then(r => r.json())
    .then(data => setWalletData(data))
}, [walletId])
```

**URL construction (done in render, not useEffect):**

```typescript
const claudeCommand =
  `claude mcp add --transport http spongewallet ${BACKEND_URL}/mcp` +
  ` --header "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}"`

const skillUrl =
  `${BACKEND_URL}/skills/openclaw.md?walletId=${walletId}&apiKey=${apiKey || 'YOUR_API_KEY'}`

const openclawCommand = `/install ${skillUrl}`
```

**Five cards in order:**

**Card 1 — API Key**
- Yellow warning banner above: "shown only once"
- Monospace `<code>` block in green with the raw API key
- `CopyButton` copies to clipboard
- If `apiKey` is null (session lost), shows a yellow warning to go back and regenerate

**Card 2 — Connect Claude Code (hero)**
- Purple ring border to draw attention
- Shows the full `claude mcp add --transport http ...` command
- Large "Copy Command" button below the code block
- "Run this once" badge in header

**Card 3 — skill.md File**
- Clickable link to the skill file URL (opens in new tab)
- Shows the OpenClaw `/install` command in an orange code block
- Copy button for the `/install` command

**Card 4 — Fund Your Wallet**
- Wallet address in monospace with copy button
- "Base Sepolia only" red badge
- Basescan link: `https://sepolia.basescan.org/address/{address}`

**Card 5 — Spending Policy**
- 3-column grid: Expiry (localized date string), Remaining Transactions, Max per Tx ETH
- Allowed recipients rendered as `<Badge>` components (monospace, secondary variant)

**`CopyButton` component:**

```typescript
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return <Button ...>{copied ? 'Copied!' : (label || 'Copy')}</Button>
}
```

Stateless per instance. Each button manages its own `copied` flag with a 2-second reset.

---

## Key design decisions

**sessionStorage for the API key**

The raw API key is written to `sessionStorage` immediately after creation and read on the setup page. This gives a secure-enough one-time display: the key is accessible within the same browser tab for the duration of the session, but never sent to a database or stored in localStorage (which persists across sessions). When the tab is closed, it's gone — which matches the "shown once" security model.

**Single API call for wallet creation**

The old 3-step flow (create wallet → POST policy → POST api-key) was replaced with a single `POST /v1/wallets` call that does all three atomically. If policy creation or API key generation fails, the whole request fails — no orphaned wallets without policies.

**No chain interaction in the frontend**

The frontend is a pure REST client. It never imports viem, ethers, or any wallet library. All ETH reads and writes go through the backend API. This keeps the attack surface small — a compromised frontend cannot steal private keys or bypass policy limits.

**`use(params)` for dynamic segments**

```typescript
export default function SetupPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params)
  ...
}
```

Next.js 14 passes dynamic route params as a Promise in App Router. `use()` unwraps it synchronously within the render.

---

## Running the frontend

```bash
npm install
npm run dev
# http://localhost:3000
```

For production:

```bash
npm run build
npm start
```

Optionally set `NEXT_PUBLIC_BACKEND_URL` in `.env.local` if your backend is not on `localhost:3001`.
