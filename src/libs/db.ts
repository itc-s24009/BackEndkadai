import {PrismaMariaDb} from '@prisma/adapter-mariadb'
import {PrismaClient} from 'db'

const url = String(process.env.DATABASE_URL)
const params = url.match(
  /^mysql:\/\/(?<user>.+?):(?<password>.+?)@(?<host>.+?):(?<port>\d+)\/(?<database>.+?)$/
)?.groups || {}

const adapter = new PrismaMariaDb({
  user: params.user,
  password: params.password,
  host: params.host,
  port: Number(params.port),
  database: params.database,
  connectionLimit: 5
})
const prisma = new PrismaClient({adapter})

export default prisma
