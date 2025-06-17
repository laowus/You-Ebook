const { ipcMain } = require("electron");
const {
  insertBook,
  getBooks,
  insertChapter,
  getFirstChapter,
  getChapter,
  getChapters,
  updateChapter,
  updateToc,
} = require("../dbtool.js");

const dbHandle = () => {
  ipcMain.on("db-insert-book", (event, book) => {
    console.log("db-insert-book", book);
    insertBook(book, event);
  });
  ipcMain.on("db-get-books", (event) => {
    getBooks(event);
  });
  ipcMain.on("db-update-toc", (event, book) => {
    updateToc(book, event);
  });
  ipcMain.on("db-insert-chapter", (event, chapter) => {
    insertChapter(chapter, event);
  });
  ipcMain.on("db-first-chapter", (event, bookId) => {
    getFirstChapter(bookId, event);
  });
  ipcMain.on("db-get-chapter", (event, bookId, href) => {
    getChapter(bookId, href, event);
  });
  ipcMain.on("db-get-chapters", (event, bookId) => {
    getChapters(bookId, event);
  });

  ipcMain.on("db-update-chapter", (event, chapter) => {
    console.log("db-update-chapter", chapter);
    updateChapter(chapter, event);
  });
};

module.exports = dbHandle;
