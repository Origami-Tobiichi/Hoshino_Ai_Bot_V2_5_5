const { exec } = require('child_process')
const { logger } = require('./colors')

const CONCURRENCY = 2

// 5 menit
const TIMEOUT = 300_000

let queue = []
let running = 0

function runNext() {
    while (running < CONCURRENCY && queue.length > 0) {
        const task = queue.shift()

        running++

        task.execute()
            .then(task.resolve)
            .catch(task.reject)
            .finally(() => {
                running--
                runNext()
            })
    }
}

function queueFFmpeg(command) {
    return new Promise((resolve, reject) => {

        const execute = () => new Promise((res, rej) => {

            console.log('[FFmpeg] Starting...')
            console.log('[FFmpeg] Command:', command)

            const child = exec(command, {
                maxBuffer: 50 * 1024 * 1024
            })

            let timedOut = false
            let stderr = ''

            const timer = setTimeout(() => {
                timedOut = true

                console.error(
                    `[FFmpeg] Timeout setelah ${TIMEOUT / 1000}s`
                )

                child.kill('SIGKILL')

            }, TIMEOUT)

            child.stderr?.on('data', (chunk) => {
                stderr += chunk

                if (stderr.length > 5000) {
                    stderr = stderr.slice(-5000)
                }
            })

            child.on('close', (code) => {

                clearTimeout(timer)

                if (timedOut) {
                    return rej(
                        new Error(
                            `FFmpeg timeout (${TIMEOUT / 1000}s)`
                        )
                    )
                }

                if (code !== 0) {
                    console.error('[FFmpeg] Error:', stderr)

                    return rej(
                        new Error(
                            `FFmpeg exit code ${code}: ${stderr.split('\n').pop()}`
                        )
                    )
                }

                console.log('[FFmpeg] Finished successfully')

                res()
            })

            child.on('error', (err) => {
                clearTimeout(timer)
                rej(err)
            })
        })

        queue.push({
            execute,
            resolve,
            reject
        })

        runNext()
    })
}

function getQueueStats() {
    return {
        running,
        queued: queue.length,
        concurrency: CONCURRENCY
    }
}

module.exports = {
    queueFFmpeg,
    getQueueStats,
    CONCURRENCY
}