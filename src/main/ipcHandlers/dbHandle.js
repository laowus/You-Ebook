const { ipcMain } = require("electron");
const {
  insertBook,
  getBooks,
  delBook,
  updateBook,
  getBook,
  insertChapter,
  getFirstChapter,
  getChapter,
  getChapters,
  updateChapter,
  updateToc,
  resetTables, // 导出重置表函数
} = require("../dbtool.js");

const dbHandle = () => {
  ipcMain.on("db-reset-tables", (event) => {
    resetTables(event); // 调用重置表函数
  });
  ipcMain.on("db-insert-book", (event, book) => {
    insertBook(book, event);
  });
  ipcMain.on("db-get-books", (event) => {
    getBooks(event);
  });
  ipcMain.on("db-update-book", (event, book) => {
    updateBook(book, event);
  });
  ipcMain.on("db-del-book", (event, bookId) => {
    delBook(event, bookId);
  });
  ipcMain.on("db-get-book", (event, bookId) => {
    getBook(event, bookId);
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
    updateChapter(chapter, event);
  });

};

module.exports = dbHandle;
