import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Request, Response } from 'express'
import { authenticateBearer } from './authService'
import { getBalanceHandler, getBalanceTool } from '../mcp/tools/get_balance'
import { getTransactionHistoryHandler, getTransactionHistoryTool } from '../mcp/tools/get_transaction_history'
import { sendPaymentHandler, sendPaymentTool } from '../mcp/tools/send_payment'

export function createMcpApp() {
  return async (req: Request, res: Response): Promise<void> => {
    const authResult = await authenticateBearer(req.headers.authorization)

    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const server = new Server(
      { name: 'spongewallet-mcp', version: '2.0.0' },
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
      try {
        const { name, arguments: args } = request.params
        let result: unknown

        if (name === 'get_balance') {
          result = await getBalanceHandler(authResult.walletId)
        } else if (name === 'send_payment') {
          result = await sendPaymentHandler(authResult.walletId, args as { to: string; amountUsdc: string })
        } else if (name === 'get_transaction_history') {
          result = await getTransactionHistoryHandler(authResult.walletId, args as { limit?: number })
        } else {
          throw new Error(`Unknown tool: ${name}`)
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
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
