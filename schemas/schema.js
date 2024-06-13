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
    favoriteBooks: [Book!]!
    booksByGenre(genre: String!): [Book!]!
    bookCount: Int
    authorCount: Int
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author]
    allGenres: [String!]!
  }
`

module.exports = typeDefs