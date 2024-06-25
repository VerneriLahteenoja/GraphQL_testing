const DataLoader = require('dataloader')
const Book = require('../models/book')

const batchBooks = async (authorIds) => {
  console.log(authorIds)
  const books = await Book.find({ author: { $in: authorIds } });
  // Initialize bookcountmap
  const booksMap = {}
  authorIds.forEach(id => {
    booksMap[id] = 0;
  });
  console.log(booksMap)

  books.forEach(book => {
    if (book.author in booksMap) {
        booksMap[book.author] += 1;
    }
  });
  return authorIds.map(authorId => booksMap[authorId]);
};

const bookCountLoader = new DataLoader(batchBooks)

module.exports = bookCountLoader