const { ipcMain, app, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { ensureDirectoryExists } = require("../common");
const dataPath = path.join(app.getPath("userData"), "bookdata");
const bookDir = path.join(dataPath, "book");
const coverDir = path.join(dataPath, "cover");
const epubDir = path.join(dataPath, "epub");

const fileHandle = () => {
  // 获取书籍保存路径
  ipcMain.on("get-book-dir", (event, arg) => {
    ensureDirectoryExists(bookDir);
    event.returnValue = bookDir;
  });

  ipcMain.on("get-data-dir", (event, arg) => {
    ensureDirectoryExists(dataPath);
    event.returnValue = dataPath;
  });
  // 获取封面保存路径
  ipcMain.on("get-cover-dir", (event, arg) => {
    ensureDirectoryExists(coverDir);
    event.returnValue = coverDir;
  });

  // 获取解压epub文件目录
  ipcMain.on("get-epub-dir", (event, bookId) => {
    const epubDirBook = path.join(epubDir, bookId);
    console.log("get-epub-dir", epubDirBook);
    ensureDirectoryExists(epubDirBook);
    event.returnValue = epubDirBook;
  });

  // 获取解压epub文件目录
  // \ 替换为 /
  ipcMain.on("get-image-dir", (event, bookId) => {
    const epubDirBook = path.join(epubDir, bookId);
    const imageDirBook = path.join(epubDirBook, "images");
    console.log("cur-image-dir", imageDirBook);
    ensureDirectoryExists(imageDirBook);
    event.returnValue = imageDirBook;
  });

  ipcMain.handle("select-image", async (event, bookId) => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif"] }],
      properties: ["openFile"],
    });

    if (result.canceled) return null;
    const epubDirBook = path.join(epubDir, bookId);
    const imageDirBook = path.join(epubDirBook, "images");
    console.log("select-image", imageDirBook);
    ensureDirectoryExists(imageDirBook);

    const timestamp = Date.now();
    //获取文件的扩展名
    const ext = path.extname(result.filePaths[0]);
    //生成新的文件名
    const destFileName = `img_${timestamp}${ext}`;
    // 新文件路径
    const destPath = path.join(imageDirBook, destFileName);
    // 复制文件到新路径
    try {
      // 复制文件到新路径
      fs.copyFileSync(result.filePaths[0], destPath);
      console.log("图片复制成功，文件名:", destFileName);
      // 复制成功后返回文件名
      return destFileName;
    } catch (error) {
      console.error("图片复制失败:", error);
      // 抛出错误以便渲染进程捕获
      throw new Error("图片复制失败: " + error.message);
    }
  });
};

module.exports = fileHandle;
