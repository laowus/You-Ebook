const path = require("path");
const { app, ipcMain } = require("electron");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const bookData = path.join(app.getPath("userData"), "bookdata");

let db;

// 获取数据库文件路径
const getDatabasePath = () => {
  ensureDirectoryExists(bookData);
  return path.join(bookData, "database.db");
};
// 封装的函数，判断文件夹是否存在，不存在则创建
const ensureDirectoryExists = (dirPath) => {
  fs.access(dirPath, fs.constants.F_OK, (err) => {
    if (err) {
      // 文件夹不存在，创建它
      fs.mkdir(dirPath, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
          console.error("Error creating folder:", mkdirErr);
        } else {
          console.log("Folder created successfully:", dirPath);
        }
      });
    } else {
      // 文件夹存在
      console.log("Folder already exists:", dirPath);
    }
  });
};
const initDatabase = () => {
  const dbPath = getDatabasePath();
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 检查数据库文件是否存在
      fs.access(dbPath, fs.constants.F_OK, (err) => {
        if (err) {
          console.log("Database file does not exist. Creating a new one.");
          db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              console.error(err.message);
              reject(err);
            } else {
              console.log("Connected to the SQLite database.");
              createTable();
              resolve();
            }
          });
        } else {
          console.log("Database file already exists.");
          db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              console.error(err.message);
              reject(err);
            } else {
              console.log("Connected to the existing SQLite database.");
              resolve();
            }
          });
        }
      });
    }, 1000); // 等待1秒
  });
};

// 重置所有表的函数
const resetTables = (event) => {
  console.log("resetTables 数据初始化");
  db.serialize(() => {
    // 删除 ee_book 表
    db.run("DROP TABLE IF EXISTS ee_book", (err) => {
      if (err) {
        console.error("删除 ee_book 表失败:", err.message);
        event.reply("db-reset-tables-response", {
          success: false,
          error: err.message,
        });
        return;
      }
      // 删除 ee_chapter 表
      db.run("DROP TABLE IF EXISTS ee_chapter", (err) => {
        if (err) {
          console.error("删除 ee_chapter 表失败:", err.message);
          event.reply("db-reset-tables-response", {
            success: false,
            error: err.message,
          });
          return;
        }
        // 重新创建表
        createTable();
        // 重置自增主键
        db.run(
          'DELETE FROM sqlite_sequence WHERE name IN ("ee_book", "ee_chapter")',
          (err) => {
            if (err) {
              console.error("重置自增主键失败:", err.message);
              event.reply("db-reset-tables-response", {
                success: false,
                error: err.message,
              });
            } else {
              console.log("清除所有数据并重置自增主键成功.");
              event.reply("db-reset-tables-response", { success: true });
            }
          }
        );
      });
    });
  });
};

// 创建数据库表
const createTable = () => {
  db.run(
    ` CREATE TABLE ee_book (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            author TEXT,
            description TEXT,
            cover TEXT,
            toc TEXT,
            isDel INTEGER,
            createTime TEXT,
            updateTime TEXT )
    `,
    (err) => {
      if (err) {
        console.error(err.message);
      }
      console.log("Table ee_books created.");
    }
  );
  db.run(
    `CREATE TABLE ee_chapter (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bookId INTEGER,
            label TEXT,
            href TEXT,
            content TEXT,
            createTime TEXT,
            updateTime TEXT)
    `,
    (err) => {
      if (err) {
        console.error(err.message);
      }
      console.log("Table ee_chapter created.");
    }
  );
};

const insertBook = (book, event) => {
  db.run(
    ` INSERT INTO ee_book (title, author, description, cover, isDel, createTime, updateTime)
     VALUES (? , ?, ?, ?, 0, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
    [book.title, book.author, book.description, book.cover],
    function (err) {
      if (err) {
        console.error(err.message);
        event.reply("db-insert-book-response", { success: false });
      } else {
        event.reply("db-insert-book-response", {
          success: true,
          bookId: this.lastID,
        });
      }
    }
  );
};

const updateBook = (book, event) => {
  db.run(
    `UPDATE ee_book SET title = ?, author = ?, description = ?, cover = ?, updateTime = datetime('now', 'localtime') WHERE id = ?`,
    [book.title, book.author, book.description, book.cover, book.id],
    function (err) {
      if (err) {
        console.error(err.message);
        event.reply("db-update-book-response", { success: false });
      } else {
        event.reply("db-update-book-response", { success: true });
      }
    }
  );
};
const delBook = (event, bookId) => {
  db.run(`UPDATE ee_book SET isDel = 1 WHERE id = ?`, [bookId], (err) => {
    if (err) {
      console.error(err.message);
      event.reply("db-del-book-response", { success: false });
    } else {
      event.reply("db-del-book-response", { success: true });
    }
  });
};

const getBooks = (event) => {
  db.all(`SELECT * FROM ee_book WHERE isDel = 0`, (err, rows) => {
    if (err) {
      console.error("Error in getBooks query:", err.message);
      event.returnValue = { success: false, error: err.message };
    } else {
      event.returnValue = { success: true, data: rows };
    }
  });
};

const insertChapter = (chapter, event) => {
  db.run(
    `
    INSERT INTO ee_chapter (bookId, label, href, content, createTime, updateTime)
     VALUES (? , ?, ?, ?,  datetime('now', 'localtime'), datetime('now', 'localtime'))`,
    [chapter.bookId, chapter.label, chapter.href, chapter.content],
    function (err) {
      if (err) {
        console.error(err.message);
        event.reply("db-insert-chapter-response", { success: false }); // 发送失败响应
      } else {
        event.reply("db-insert-chapter-response", {
          success: true,
          id: this.lastID,
        }); // 发送成功响应
      }
    }
  );
};

const getChapters = (bookId, event) => {
  db.get(
    `SELECT id, label, href FROM ee_chapter WHERE bookId =? `,
    [bookId],
    (err, rows) => {
      if (err) {
        console.error(err.message);
        event.returnValue = { success: false };
      } else {
        event.returnValue = { success: true, data: rows };
      }
    }
  );
};

const getFirstChapter = (bookId, event) => {
  db.get(
    `SELECT * FROM ee_chapter WHERE bookId = ? ORDER BY id ASC LIMIT 1`,
    [bookId],
    (err, rows) => {
      if (err) {
        console.error(err.message);
        event.returnValue = { success: false };
      } else {
        event.returnValue = { success: true, data: rows };
      }
    }
  );
};

const getChapter = (bookId, href, event) => {
  db.get(
    `SELECT * FROM ee_chapter WHERE bookId =? AND id =? `,
    [bookId, href],
    (err, rows) => {
      if (err) {
        console.error(err.message);
        event.returnValue = { success: false };
      } else {
        event.returnValue = { success: true, data: rows };
      }
    }
  );
};

const getChap = (bookId, href) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ee_chapter WHERE bookId =? AND id =? `,
      [bookId, href],
      (err, rows) => {
        if (err) {
          console.error(err.message);
          reject({ success: false });
        } else {
          resolve({ success: true, data: rows });
        }
      }
    );
  });
};

const updateChapter = (chapter, event) => {
  db.run(
    `UPDATE ee_chapter SET content = ?,label =?, updateTime = datetime('now', 'localtime') WHERE bookId = ? AND href = ?`,
    [chapter.content, chapter.label, chapter.bookId, chapter.href],
    (err) => {
      if (err) {
        event.returnValue = { success: false };
      } else {
        event.returnValue = { success: true, data: this.lastID };
      }
    }
  );
};

const updateToc = (book, event) => {
  db.run(
    `UPDATE ee_book SET toc =?, updateTime = datetime('now', 'localtime') WHERE id = ?`,
    [JSON.stringify(book.toc), book.id],
    (err) => {
      if (err) {
        event.returnValue = { success: false };
      } else {
        event.returnValue = { success: true, data: this.lastID };
      }
    }
  );
};

//导出
module.exports = {
  initDatabase,
  insertBook,
  updateBook,
  delBook,
  getBooks,
  getChapters,
  insertChapter,
  getFirstChapter,
  getChapter,
  getChap,
  updateChapter,
  updateToc,
  resetTables, // 导出重置表函数
};
