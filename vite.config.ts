import { defineConfig, type Plugin } from 'vite'
import * as fs from 'fs'
import * as path from 'path'

const BUILDINGS_DIR = './buildings'

/**
 * Vite plugin to handle /api/buildings endpoints.
 */
function buildingsApiPlugin(): Plugin {
  return {
    name: 'buildings-api',
    configureServer(server) {
      // Ensure buildings directory exists
      const buildingsPath = path.resolve(BUILDINGS_DIR)
      if (!fs.existsSync(buildingsPath)) {
        fs.mkdirSync(buildingsPath, { recursive: true })
      }
      console.log(`[buildings-api] Storage path: ${buildingsPath}`)

      server.middlewares.use((req, res, next) => {
        const url = req.url || ''

        // Only handle /api/buildings routes
        if (!url.startsWith('/api/buildings')) {
          return next()
        }

        console.log(`[buildings-api] ${req.method} ${url}`)

        // List all buildings: GET /api/buildings
        if (url === '/api/buildings' && req.method === 'GET') {
          try {
            const files = fs.readdirSync(buildingsPath)
              .filter(f => f.endsWith('.json'))

            const summaries = files.map(f => {
              const filePath = path.join(buildingsPath, f)
              const content = fs.readFileSync(filePath, 'utf-8')
              const data = JSON.parse(content)
              return {
                name: data.name || f.replace('.json', ''),
                planeCount: data.planes?.length || 0
              }
            })

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(summaries))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to list buildings' }))
          }
          return
        }

        // Individual building operations: /api/buildings/:name
        const match = url.match(/^\/api\/buildings\/([^/]+)$/)
        if (match) {
          const name = decodeURIComponent(match[1])
          const filePath = path.join(buildingsPath, `${name}.json`)
          console.log(`[buildings-api] File path: ${filePath}`)

          // GET - Load building
          if (req.method === 'GET') {
            try {
              if (!fs.existsSync(filePath)) {
                res.statusCode = 404
                res.end(JSON.stringify({ error: 'Building not found' }))
                return
              }
              const content = fs.readFileSync(filePath, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(content)
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to load building' }))
            }
            return
          }

          // PUT - Save building
          if (req.method === 'PUT') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                // Validate JSON
                JSON.parse(body)
                fs.writeFileSync(filePath, body, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true }))
              } catch (err) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Invalid JSON' }))
              }
            })
            return
          }

          // DELETE - Delete building
          if (req.method === 'DELETE') {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to delete building' }))
            }
            return
          }
        }

        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [buildingsApiPlugin()]
})
