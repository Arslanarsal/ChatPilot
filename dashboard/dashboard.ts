import 'dotenv/config'

import express from 'express'
import { ConnectionOptions, Queue } from 'bullmq'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

const port = 3001

const connection = {
    url: process.env.REDIS_URL,
} as ConnectionOptions

const repliesQueue = new Queue('replies', { connection })
// const remindersQueue = new Queue('reminders', { connection })

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
    //   queues: [new BullMQAdapter(repliesQueue), new BullMQAdapter(remindersQueue)],
    queues: [new BullMQAdapter(repliesQueue)],
    serverAdapter: serverAdapter,
})

const app = express()

function basicAuthMiddleWare(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        const err: any = new Error('You are not authenticated!')
        res.setHeader('WWW-Authenticate', 'Basic')

        err.status = 401
        return next(err)
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64')
        .toString()
        .split(':')
    const user = auth[0]
    const password = auth[1]

    if (password === 'ramp4theWin!') {
        next()
    } else {
        const err: any = new Error('You are not authenticated!')
        res.setHeader('WWW-Authenticate', 'Basic')
        err.status = 401
        return next(err)
    }
}

app.use(basicAuthMiddleWare)

app.use('/admin/queues', serverAdapter.getRouter())

app.listen(port, () => {
    console.log(`Dashboard http://localhost:${port}/admin/queues`)
})
