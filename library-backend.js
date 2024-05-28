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
    addBook: async (root, args) => {
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
    editAuthor: async (root, args) => {
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
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})

  //  let authors = [
  //   {
  //     name: 'Robert Martin',
  //     id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
  //     born: 1952,
  //   },
  //   {
  //     name: 'Martin Fowler',
  //     id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
  //     born: 1963
  //   },
  //   {
  //     name: 'Fyodor Dostoevsky',
  //     id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
  //     born: 1821
  //   },
  //   { 
  //     name: 'Joshua Kerievsky', // birthyear not known
  //     id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  //   },
  //   { 
  //     name: 'Sandi Metz', // birthyear not known
  //     id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  //   },
  // ]
  
  // let books = [
  //   {
  //     title: 'Clean Code',
  //     published: 2008,
  //     author: 'Robert Martin',
  //     id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
  //     genres: ['refactoring']
  //   },
  //   {
  //     title: 'Agile software development',
  //     published: 2002,
  //     author: 'Robert Martin',
  //     id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
  //     genres: ['agile', 'patterns', 'design']
  //   },
  //   {
  //     title: 'Refactoring, edition 2',
  //     published: 2018,
  //     author: 'Martin Fowler',
  //     id: "afa5de00-344d-11e9-a414-719c6709cf3e",
  //     genres: ['refactoring']
  //   },
  //   {
  //     title: 'Refactoring to patterns',
  //     published: 2008,
  //     author: 'Joshua Kerievsky',
  //     id: "afa5de01-344d-11e9-a414-719c6709cf3e",
  //     genres: ['refactoring', 'patterns']
  //   },  
  //   {
  //     title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
  //     published: 2012,
  //     author: 'Sandi Metz',
  //     id: "afa5de02-344d-11e9-a414-719c6709cf3e",
  //     genres: ['refactoring', 'design']
  //   },
  //   {
  //     title: 'Crime and punishment',
  //     published: 1866,
  //     author: 'Fyodor Dostoevsky',
  //     id: "afa5de03-344d-11e9-a414-719c6709cf3e",
  //     genres: ['classic', 'crime']
  //   },
  //   {
  //     title: 'Demons',
  //     published: 1872,
  //     author: 'Fyodor Dostoevsky',
  //     id: "afa5de04-344d-11e9-a414-719c6709cf3e",
  //     genres: ['classic', 'revolution']
  //   },
  // ]