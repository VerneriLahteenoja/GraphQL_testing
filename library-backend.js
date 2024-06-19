const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/lib/use/ws')

const { ApolloServer } = require('@apollo/server')
const { expressMiddleware } = require('@apollo/server/express4')
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer')
const { makeExecutableSchema } = require('@graphql-tools/schema')

const express = require('express')
const cors = require('cors')
const http = require('http')
const jwt = require('jsonwebtoken')

const mongoose = require('mongoose')
mongoose.set('strictQuery', false)

const User = require('./models/user')

const typeDefs = require('./schemas/schema')
const resolvers = require('./resolvers/resolvers')
const authorLoader = require('./loaders/authorLoader')

require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI
console.log('connecting to MongoDB')

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connecting to MongoDB', error.message)
  })

const start = async () => {
  const app = express()
  const httpServer = http.createServer(app)
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/', // path is the same that express serves
  })

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const serverCleanup = useServer({ schema }, wsServer)

  const server = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer }), // Drain the server on shutdown "gracefully"
    {
      async serverWillStart() { // Handles WebSocket shutdown <https://www.apollographql.com/docs/apollo-server/data/subscriptions/>
        return {
          async drainServer() {
            await serverCleanup.dispose()
          }
        }
      }
    }
    ]
  })

  await server.start() // Start with await to make sure GraphQL server runs before express starts
  
  app.use(
    '/',
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Handle authorization header, sets currentUser to context
        const auth = req ? req.headers.authorization : null
        if (auth && auth.startsWith('Bearer ')) {
          const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET)
          const currentUser = await User.findById(decodedToken.id)
          // Set dataloaders to context
          return { currentUser, authorLoader }
        }
        return { authorLoader }
      }
    })
  )

  const PORT = 4000
  httpServer.listen(PORT, () => 
  console.log(`Server running on http://localhost:${PORT}`))
}
start()
