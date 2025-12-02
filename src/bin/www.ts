#!/usr/bin/env node

/**
 * Module dependencies.
 */
import app from '../app.js'
import debug from 'debug'
import http from 'node:http'

const logger = debug('ex-gen-app:server')
/**
 * Get port from environment and store in Express.
 */
const port = await normalizePort(process.env.PORT || '3000')
app.set('port', port)

/**
 * Create HTTP server.
 */
const server = http.createServer(app)

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port)
server.on('error', onError)
server.on('listening', onListening)

/**
 * Normalize a port into a number, string, or false.
 */
async function normalizePort(val: string) {
    const port = parseInt(val, 10)

    if (isNaN(port)) {
        // named pipe
        return val
    }

    if (port >= 0) {
        return port
    }

    return false
}

/**
 * Event listener for HTTP server "error" event.
 */
async function onError<T extends Object>(error: T & Error) {
    if ('syscall' in error && error.syscall !== 'listen') {
        throw error
    }

    const bind = typeof port === 'string'
        ? `Pipe ${port}`
        : `Port ${port}`

    // handle specific listen errors with friendly messages
    switch ('code' in error && error.code || '') {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`)
            process.exit(1)
            break
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`)
            process.exit(1)
            break
        default:
            throw error
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */
async function onListening() {
    const addr = server.address()
    const bind = typeof addr === 'string'
        ? `Pipe ${addr}`
        : `Port ${addr?.port}`
    logger(`Listening on ${bind}`)
}