const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')

const mongoose = require('mongoose')
mongoose.set('strictQuery', false)

const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')

require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI
console.log('connecting to MongoDB')

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connecting to MongoDB', error)
  })

const typeDefs = `
  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String]!
    id: ID!
  }

  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ) : Book

    addAuthor(
      name: String!
      born: Int
      bookCount: Int
    ) : Author

    editAuthor(
      name: String!
      setBornTo: Int!
    ) : Author

    createUser(
      username: String!
      favoriteGenre: String!
    ) : User

    login(
      username: String!
      password: String!
    ) : Token
  }

  type Query {
    me: User
    bookCount: Int
    authorCount: Int
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author]
  }
`

const resolvers = {
  Query: {
    bookCount: async () => Book.countDocuments(),
    authorCount: async () => Author.countDocuments(),
    allBooks: async (root, args) => {
      return Book.find({}).populate('author', { name: 1, _id: 1, born: 1 })
    },
    allAuthors: async (root, args) => {
      return Author.find({})
    },
    me: (root, args, context) => {
      return context.currentUser
    }
  },
  Author: {
    name: (root) => root.name,
    born: (root) => root.born,
    id: (root) => root.id,
    bookCount: async (root) => {
      const booksByAuthor = await Book.find({ author: root.id }).exec()
      return (
        booksByAuthor.length
    )}
  },
  Mutation: {
    createUser: async (root, args) => {
      const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
      return user.save()
        .catch(error => {
          throw new GraphQLError('Creating user failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              error
            }
          })
        })
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })
      if (!user || args.password !== 'secret') {
        throw new GraphQLError('wrong credentials', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        })
      }
      const userForToken = {
        username: user.username,
        id: user._id
      }
      return { value: jwt.sign(userForToken, process.env.JWT_SECRET )}
    },
    addBook: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'FORBIDDEN'
          }
        })
      }
      const authorExists = await Author.findOne({ name: args.author })
      if (authorExists) {
        const newBook = new Book({ ...args, author: authorExists._id })
        try {
          await newBook.save()
        } catch (error) {
          throw new GraphQLError('Adding book failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.title,
              error
            }
          })
        }
        return newBook.populate('author', { name: 1, _id: 1, born: 1, bookCount: 1 })
      } else {
        console.log('no existing author, adding new...')
        const newAuthor = new Author({ name: args.author, born: args.born || null })
        const newBook = new Book({ ...args, author: newAuthor._id })
        try {
          await newAuthor.save()
        } catch (error) {
          throw new GraphQLError('Adding new author failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.author,
              error
            }
          })
        }
        console.log('new author added')
        try {
          await newBook.save()
        } catch (error) {
          throw new GraphQLError('Adding book failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.title,
              error
            }
          })
        }
        return newBook.populate('author', { name: 1, _id: 1, born: 1, bookCount: 1 })
      }
    },
    addAuthor: async (root, args) => {
      const author = new Author({ ...args, born: args.born || null })
      try {
        author.save()
      } catch (error) {
        throw new GraphQLError('Adding author failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.name,
            error
          }
        })
      }
      return author
    },
    editAuthor: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'FORBIDDEN'
          }
        })
      }
      console.log(args)
      const author = await Author.findOne({ name: args.name })
      author.born = args.setBornTo
      try {
        author.save()
      } catch (error) {
        throw new GraphQLError('Editing author failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args,
            error
          }
        })
      }
      return author
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },

  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.startsWith('Bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      )
      const currentUser = await User
        .findById(decodedToken.id)
      return { currentUser }
    }
  },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})
