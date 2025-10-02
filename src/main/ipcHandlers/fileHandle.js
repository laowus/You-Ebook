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

  ipcMain.on("get-cover-path", (event, bookId) => {
    const coverPath = path.join(coverDir, `${bookId}.jpg`);
    //判断是否真实存在封面图片
    if (fs.existsSync(coverPath)) {
      event.returnValue = coverPath;
    } else {
      event.returnValue = "";
    }
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
  // 设置封面图片 把图片复制到封面目录，并命名为 bookId.jpg
  ipcMain.handle("set-cover", async (event, cover, bookId) => {
    console.log("set-cover", cover, bookId);
    const coverPath = path.join(coverDir, `${bookId}.jpg`);
    try {
      // 确保封面目录存在
      await ensureDirectoryExists(coverDir);
      // 先尝试删除已存在的封面文件（如果有）
      try {
        fs.unlinkSync(coverPath);
      } catch (err) {
        // 忽略文件不存在的错误
        if (err.code !== "ENOENT") {
          console.warn("删除旧封面时出现非文件不存在的错误:", err);
        }
      }

      // 复制选中的图片文件到coverPath
      fs.copyFileSync(cover, coverPath);
      console.log("封面图片复制成功，路径:", coverPath);

      // 返回成功信息和封面路径
      return {
        success: true,
        coverPath: coverPath,
      };
    } catch (error) {
      console.error("封面图片复制失败:", error);
      throw new Error("封面图片复制失败: " + error.message);
    }
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
    await ensureDirectoryExists(imageDirBook);

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
