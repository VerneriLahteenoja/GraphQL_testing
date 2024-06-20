const DataLoader = require('dataloader')
const Book = require('../models/book')

const batchBooks = async (bookIds) => {
    const books = await Book.find({ _id: { $in: bookIds } })
    const bookMap = books.reduce((acc, book) => {
        acc[book._id] = book;
    }, {});
    return bookIds.map(id => bookMap[id])
};

const bookLoader = new DataLoader(batchBooks);

module.exports = bookLoader;