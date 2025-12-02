import 'express-session'
import 'passport'

declare module 'express-session' {
  interface SessionData {
    messages: string[]
  }
}

declare global {
  namespace Express {
    interface User {
      id: string
      name: string
    }
  }
}

declare module 'passport' {
  interface AuthenticateOptions {
    badRequestMessage?: string | undefined
  }
}