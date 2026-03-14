import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { Request, Response } from 'express'
import { db } from '../db/schema'
import bcrypt from 'bcryptjs'
import { getBalanceTool, getBalanceHandler } from '../mcp/tools/get_balance'
import { sendPaymentTool, sendPaymentHandler } from '../mcp/tools/send_payment'
import { getTransactionHistoryTool, getTransactionHistoryHandler } from '../mcp/tools/get_transaction_history'

interface ApiKeyRow {
  id: string
  walletId: string
  keyHash: string
  createdAt: number
}

async function authenticateBearer(
  authHeader: string | undefined
): Promise<{ walletId: string; apiKey: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const apiKey = authHeader.slice(7)

  // API key format: "{walletId}.{secret}" — extract walletId to avoid full table scan
  const dotIndex = apiKey.indexOf('.')
  if (dotIndex === -1) return null
  const walletId = apiKey.slice(0, dotIndex)

  const stmt = db.prepare('SELECT * FROM api_keys WHERE walletId = ?')
  const rows = stmt.all(walletId) as ApiKeyRow[]

  for (const row of rows) {
    const matches = await bcrypt.compare(apiKey, row.keyHash)
    if (matches) {
      return { walletId: row.walletId, apiKey }
    }
  }

  return null
}

export function createMcpApp() {
  return async (req: Request, res: Response): Promise<void> => {
    const authResult = await authenticateBearer(req.headers.authorization)

    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const { walletId, apiKey } = authResult

    const server = new Server(
      { name: 'spongewallet-mcp', version: '1.0.0' },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [getBalanceTool, sendPaymentTool, getTransactionHistoryTool],
      }
    })

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        let result: unknown

        if (name === 'get_balance') {
          result = await getBalanceHandler(walletId, args as Record<string, unknown>)
        } else if (name === 'send_payment') {
          result = await sendPaymentHandler(walletId, apiKey, args as { to: string; amountEth: string })
        } else if (name === 'get_transaction_history') {
          result = await getTransactionHistoryHandler(walletId, args as { limit?: number })
        } else {
          throw new Error(`Unknown tool: ${name}`)
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    })

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })

    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  }
}
