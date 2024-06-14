const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')

const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

const Author = require('../models/author')
const Book = require('../models/book')
const User = require('../models/user')


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
      allGenres: async (root, args) => {
        const books = await Book.find({})
        const genres = books.reduce((acc, book) => {
          return acc.concat(book.genres)
        }, [])
        return [...new Set(genres)] 
      },
      me: (root, args, context) => {
        return context.currentUser
      },
      favoriteBooks: async (root, args, context) => {
        if (!context.currentUser) {
          throw new GraphQLError('Not authenticated', {
            extensions: {
              code: 'FORBIDDEN'
            }
          })
        }
        const user = context.currentUser
        return Book.find({ genres: user.favoriteGenre }).populate('author', { name: 1, _id: 1, born: 1 })
      },
      booksByGenre: async (root, args) => {
        return Book.find({ genres: args.genre }).populate('author', { name: 1, _id: 1, born: 1 })
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
        pubsub.publish('AUTHOR_ADDED', { authorAdded: author })
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
    },
    Subscription: {
      authorAdded: {
        subscribe: () => pubsub.asyncIterator('AUTHOR_ADDED')
      }
    }
}

module.exports = resolvers