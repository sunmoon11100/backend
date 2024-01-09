import { logErrServer, logServer } from '@expresso/helpers/Formatter'
import { createClient } from 'redis'
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from './env'
import { promisify } from 'util'

const optConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
}

const clientRedis = createClient(optConfig)

// client connect
clientRedis.on('connect', function () {
  const msgType = `Redis`
  const message = `Connection has been established successfully.`

  console.log(logServer(msgType, message))
})

// client error
clientRedis.on('error', function (err) {
  const errType = `Redis Error:`
  const message = `Something went wrong ${err}`

  console.log(logErrServer(errType, message))
})

export const redisGetAsync = promisify(clientRedis.get).bind(clientRedis)
export const redisSetAsync = promisify(clientRedis.set).bind(clientRedis)

export default clientRedis
