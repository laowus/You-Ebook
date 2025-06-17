const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { ensureDirectoryExists } = require('../common');
const dataPath = path.join(app.getPath("userData"), "bookdata");
const bookDir = path.join(dataPath, "book");
const coverDir = path.join(dataPath, "cover");

const fileHandle = () => {
    // 获取书籍保存路径
    ipcMain.on("get-book-dir", (event, arg) => {
        ensureDirectoryExists(bookDir);
        event.returnValue = bookDir;
    });
    // 获取封面保存路径
    ipcMain.on("get-cover-dir", (event, arg) => {
        ensureDirectoryExists(coverDir);
        event.returnValue = coverDir ;
    });

}

module.exports = fileHandle;
