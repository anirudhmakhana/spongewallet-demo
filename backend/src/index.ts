import express from 'express'
import cors from 'cors'
import { initDb } from './db/schema'
import { config } from './config'
import walletsRouter from './routes/wallets'
import paymentsRouter from './routes/payments'
import skillsRouter from './routes/skills'
import { createMcpApp } from './services/mcpService'

const app = express()
app.use(cors())
app.use(express.json())

initDb()

app.use('/v1', walletsRouter)
app.use('/v1', paymentsRouter)
app.use('/', skillsRouter)

// MCP endpoint
app.post('/mcp', createMcpApp())

app.listen(config.port, () => {
  console.log(`SpongeWallet backend running on port ${config.port}`)
})

export default app
