const DataLoader = require('dataloader')
const Author = require('../models/author')

const batchAuthors = async (authorIds) => {
    // Find authors by id
    const authors = await Author.find({ _id: { $in: authorIds } });
    // Map authors by (key)id and (value)author object
    const authorMap = {};
    authors.forEach(author => {
      authorMap[author._id] = author;
    });
    // Return authors as an array
    return authorIds.map(id => authorMap[id]);
};

const authorLoader = new DataLoader(batchAuthors)

module.exports = authorLoader