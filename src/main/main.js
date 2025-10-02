//关闭警告提示
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  Tray,
  shell,
} = require("electron");
const isDevEnv = process.env["NODE_ENV"] === "dev";
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const archiver = require("archiver"); // 需要安装: npm install archiver
const unzipper = require("unzipper"); // 需要安装: npm install unzipper
const bookDataDir = path.join(app.getPath("userData"), "bookdata");
const epubDir = path.join(app.getPath("userData"), "bookdata", "epub");
const Store = require("electron-store");
const store = new Store();
const { createEpub } = require("./createEpub");
const { createTxt } = require("./createTxt");
const { createHtml } = require("./createHtml");

const { initDatabase } = require("./dbtool");
let resourcesRoot = path.resolve(app.getAppPath());
let publicRoot = path.join(__dirname, "../../public");
const dbHandle = require("./ipcHandlers/dbHandle");
const { closeDatabase } = require("./dbtool");
const fileHandle = require("./ipcHandlers/fileHandle");
if (!isDevEnv) {
  resourcesRoot = path.dirname(resourcesRoot);
  publicRoot = path.join(__dirname, "../../dist");
}

let mainWin = null,
  tray = null;
let options = {
  width: 1200,
  height: 900,
  frame: false,
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
    webSecurity: false,
  },
};

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", (event, argv, workingDir) => {
    if (mainWin) {
      if (!mainWin.isVisible()) mainWin.show();
      mainWin.focus();
    }
  });
}
dbHandle();
fileHandle();

const startup = () => {
  init();
};

//创建浏览窗口
const createWindow = () => {
  if (!mainWin) {
    // 从 electron-store 中获取窗口大小和位置
    const windowWidth = parseInt(store.get("mainWindowWidth") || 1200);
    const windowHeight = parseInt(store.get("mainWindowHeight") || 900);
    const windowX = parseInt(store.get("mainWindowX"));
    const windowY = parseInt(store.get("mainWindowY"));
    const mainWindow = new BrowserWindow({
      ...options,
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
      icon: path.join(publicRoot, "/images/logo.png"),
    });
    if (isDevEnv) {
      mainWindow.loadURL("http://localhost:4000/");
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile("dist/index.html");
    }

    tray = new Tray(path.join(publicRoot, "/images/logo.png"));
    tray.setToolTip("You-Ebook");
    let contextMenu = generateContextMenu();
    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => {
      mainWindow.show();
    });
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });
    // 监听窗口大小改变事件
    mainWindow.on("resize", () => {
      if (!mainWindow.isDestroyed()) {
        if (!mainWindow.isMaximized()) {
          let bounds = mainWindow.getBounds();
          store.set({
            mainWindowWidth: bounds.width,
            mainWindowHeight: bounds.height,
          });
        } else {
          console.log("当前为大化状态，不保存窗口大小和位置");
        }
      }
    });
    // 监听窗口移动事件
    mainWindow.on("move", () => {
      if (!mainWindow.isDestroyed()) {
        if (!mainWindow.isMaximized()) {
          let bounds = mainWindow.getBounds();
          store.set({
            mainWindowX: bounds.x,
            mainWindowY: bounds.y,
          });
        }
      }
    });
    return mainWindow;
  }
  return mainWin;
};

ipcMain.on("window-min", (event) => {
  const webContent = event.sender;
  const win = BrowserWindow.fromWebContents(webContent);
  win.hide();
});

ipcMain.on("window-max", (event) => {
  const webContent = event.sender;
  const win = BrowserWindow.fromWebContents(webContent);
  if (win.isMaximized()) {
    const width = store.get("mainWindowWidth") || 1200;
    const height = store.get("mainWindowHeight") || 900;
    const x = store.get("mainWindowX") || mainWin.getPosition()[0];
    const y = store.get("mainWindowY") || mainWin.getPosition()[1];
    if (width && height) {
      win.setSize(width, height);
      if (x && y) {
        win.setPosition(x, y);
      }
    }
  } else {
    win.maximize();
  }
});

ipcMain.on("window-close", (event) => {
  // const webContent = event.sender;
  // const win = BrowserWindow.fromWebContents(webContent);
  app.quit();
});

ipcMain.on("open-data-dir", (event, dataDir) => {
  if (dataDir) {
    shell.openPath(dataDir);
  }
});

const sendToRenderer = (channel, args) => {
  try {
    if (mainWin) mainWin.webContents.send(channel, args);
  } catch (error) {}
};
// 动态生成上下文菜单
const generateContextMenu = () => {
  return Menu.buildFromTemplate([
    {
      label: "打开主界面",
      icon: path.join(publicRoot, "/images/app.png"),
      click: () => {
        mainWin.show();
      },
    },
    { type: "separator" }, // 添加分隔线

    {
      label: "退出",
      icon: path.join(publicRoot, "/images/quit.png"),
      click: function () {
        app.quit();
      },
    },
  ]);
};
const initWindowBounds = (win) => {
  store.get("mainWindowWidth") ||
    store.set("mainWindowWidth", win.getSize()[0]);
  store.get("mainWindowHeight") ||
    store.set("mainWindowHeight", win.getSize()[1]);
  store.get("mainWindowX") || store.set("mainWindowX", win.getPosition()[0]);
  store.get("mainWindowY") || store.set("mainWindowY", win.getPosition()[1]);
};

ipcMain.on("export-epub", async (event, { chapters, metaData }) => {
  try {
    // 弹出保存对话框
    const { filePath } = await dialog.showSaveDialog({
      title: "保存 EPUB 文件",
      defaultPath: `${metaData.author} - ${metaData.title}.epub`,
      filters: [
        { name: "EPUB 文件", extensions: ["epub"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });

    if (!filePath) {
      event.sender.send("export-epub-reply", {
        success: false,
        message: "用户取消保存",
      });
    } else {
      await createEpub(chapters, metaData, mainWin).then((epubContent) => {
        if (mainWin && mainWin.webContents) {
          mainWin.webContents.send("hidetip");
        }
        fs.writeFile(filePath, epubContent, (err) => {
          if (err) {
            event.sender.send("export-epub-reply", {
              success: false,
              message: "文件写入失败,请重试或者检查文件!",
            });
          } else {
            event.sender.send("export-epub-reply", {
              success: true,
              message: metaData.title + ".epub 导出成功!",
            });
          }
        });
      });
    }
  } catch (error) {
    event.sender.send("export-epub-reply", {
      success: false,
      message: "文件写入失败,请重试或者检查文件!",
    });
  }
});

ipcMain.on("export-txt", async (event, { chapters, metaData }) => {
  try {
    // 弹出保存对话框
    const { filePath } = await dialog.showSaveDialog({
      title: "保存 Txt 文件",
      defaultPath: `${metaData.title}.txt`,
      filters: [
        { name: "Txt 文件", extensions: ["txt"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });

    if (!filePath) {
      event.sender.send("export-txt-reply", {
        success: false,
        message: "用户取消保存",
      });
    } else {
      await createTxt(chapters, metaData, mainWin).then((txtContent) => {
        if (mainWin && mainWin.webContents) {
          mainWin.webContents.send("hidetip");
        }
        fs.writeFile(filePath, txtContent, (err) => {
          if (err) {
            event.sender.send("export-txt-reply", {
              success: false,
              message: "文件写入失败,请重试或者检查文件!",
            });
          } else {
            event.sender.send("export-txt-reply", {
              success: true,
              message: metaData.title + ".txt 导出成功!",
            });
          }
        });
      });
      return { success: true, filePath };
    }
  } catch (error) {
    event.sender.send("export-txt-reply", {
      success: false,
      message: "文件写入失败,请重试或者检查文件!",
    });
  }
});

// 解压epub文件到指定目录
ipcMain.on("unzip-epub", (event, { epubPath, destDir }) => {
  try {
    extract(epubPath, destDir, (err) => {
      if (err) {
        event.sender.send("unzip-epub-reply", {
          success: false,
          message: "文件解压失败,请重试或者检查文件!",
        });
      } else {
        event.sender.send("unzip-epub-reply", {
          success: true,
          message: "文件解压成功!",
        });
      }
    });
  } catch (error) {
    event.sender.send("unzip-epub-reply", {
      success: false,
      message: "文件解压失败,请重试或者检查文件!",
    });
  }
});

const txtToHtmlString = (txt, title) => {
  // 去除多余的空行
  const cleanTxt = txt.replace(/\n{3,}/g, "\n\n");

  // 将文本按换行符分割成行
  const lines = cleanTxt.split("\n");

  // 处理每一行：
  // 1. 跳过空行
  // 2. 转义空格
  // 3. 用 <p> 标签包裹每一行
  const htmlLines = lines
    .map((line) => {
      // 跳过空行
      if (!line.trim()) return "";

      // 转义空格：将连续空格替换为 &nbsp;
      const escapedLine = line.replace(/ {2,}/g, (match) => {
        return "&nbsp;".repeat(match.length);
      });

      // 用 <p> 标签包裹每一行
      return `<p>${escapedLine}</p>`;
    })
    .filter((line) => line !== ""); // 过滤掉空字符串

  // 合并所有带标签的行
  const bodyContent = htmlLines.join("");

  // 包裹完整的 HTML 结构
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      margin: 20px;
      color: #333;
    }
    p {
      margin: 8px 0;
      text-align: justify;
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
};

// 监听重启程序请求
ipcMain.on("restart-app", () => {
  app.relaunch();
  app.exit();
});

ipcMain.on("clear-data", (event) => {
  // 清除数据,删除
  // 加入数据库有连接，则先关闭数据库连接
  closeDatabase();

  if (fs.existsSync(bookDataDir)) {
    fs.rmSync(bookDataDir, { recursive: true, force: true });
    event.sender.send("clear-data-reply", {
      success: true,
      message: "数据清除成功!",
    });
  } else {
    event.sender.send("clear-data-reply", {
      success: false,
      message: "数据清除失败,请重试或者检查文件!",
    });
  }
});

ipcMain.on("export-html", async (event, { chapters, metaData }) => {
  try {
    // 弹出保存对话框
    const { filePath } = await dialog.showSaveDialog({
      title: "保存 Html 文件",
      defaultPath: `${metaData.title}.html`,
      filters: [
        { name: "Html 文件", extensions: ["html"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });

    if (!filePath) {
      event.sender.send("export-html-reply", {
        success: false,
        message: "用户取消保存",
      });
    } else {
      await createHtml(chapters, metaData, mainWin).then((txtContent) => {
        txtContent = txtToHtmlString(txtContent, metaData.title);
        if (mainWin && mainWin.webContents) {
          mainWin.webContents.send("hidetip");
        }
        fs.writeFile(filePath, txtContent, (err) => {
          if (err) {
            event.sender.send("export-html-reply", {
              success: false,
              message: "文件写入失败,请重试或者检查文件!",
            });
          } else {
            const imagesDirBook = path.join(
              epubDir,
              `${metaData.bookId}`,
              "images"
            );
            //加入存在图片文件夹，则复制图片
            if (fs.existsSync(imagesDirBook)) {
              const destDir = path.dirname(filePath);
              const destImagesDir = path.join(destDir, "images");
              console.log(imagesDirBook, "复制图片到:", destImagesDir);
              copyDirectorySync(imagesDirBook, destImagesDir);
            }
            event.sender.send("export-html-reply", {
              success: true,
              message: metaData.title + ".html 导出成功!",
            });
          }
        });
      });
      return { success: true, filePath };
    }
  } catch (error) {
    event.sender.send("export-html-reply", {
      success: false,
      message: "文件写入失败,请重试或者检查文件!",
    });
  }
});

function copyDirectorySync(srcDir, destDir) {
  try {
    // 确保目标目录存在
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // 读取源目录中的所有文件和子目录
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    // 遍历所有条目
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        // 如果是目录，递归复制
        copyDirectorySync(srcPath, destPath);
      } else {
        // 如果是文件，直接复制
        fs.copyFileSync(srcPath, destPath);
      }
    }
    console.log(`成功复制目录: ${srcDir} -> ${destDir}`);
  } catch (error) {
    console.error(`复制目录失败: ${error.message}`);
    throw error;
  }
}

// 备份数据
ipcMain.on("backup-data", async (event, dataDir) => {
  try {
    // 获取当前日期时间，用于生成备份文件名
    const timestamp = new Date().getTime();
    const defaultBackupPath = path.join(
      app.getPath("documents"),
      `you-ebook-backup-${timestamp}.zip`
    );

    // 弹出保存对话框，让用户选择备份位置
    const { filePath } = await dialog.showSaveDialog({
      title: "备份数据",
      defaultPath: defaultBackupPath,
      filters: [
        { name: "数据文件", extensions: ["zip"] },
        { name: "所有文件", extensions: ["*"] },
      ],
      parent: mainWin,
      modal: true,
    });

    if (!filePath) {
      event.sender.send("backup-database-reply", {
        success: false,
        message: "用户取消备份",
      });
      return;
    }

    const output = fs.createWriteStream(filePath);

    // 创建archiver实例
    const archive = archiver("zip", {
      zlib: { level: 9 }, // 设置压缩级别
    });

    // 监听事件
    output.on("close", () => {
      console.log(`压缩完成，总大小: ${archive.pointer()} 字节`);
      event.sender.send("backup-data-reply", {
        success: true,
        message: `备份成功！文件已保存至：${filePath}`,
        backupFilePath: filePath,
      });
    });

    archive.on("error", (err) => {
      console.error("压缩过程中出错:", err);
      event.sender.send("backup-data-reply", {
        success: false,
        message: `备份失败：${err.message}`,
      });
    });

    // 管道连接
    archive.pipe(output);
    archive.directory(dataDir, "");
    archive.finalize();

    // 备份完成后发送成功消息
    event.sender.send("backup-data-reply", {
      success: true,
      message: `数据备份成功，保存至：${filePath}`,
      backupPath: filePath,
    });
  } catch (error) {
    console.error("备份数据时出错：", error);
    event.sender.send("backup-data-reply", {
      success: false,
      message: `备份失败：${error.message}`,
    });
  }
});

// 恢复数据
// 在恢复数据功能中添加重试机制和错误处理
ipcMain.on("restore-data", async (event, dataDir) => {
  try {
    // 打开文件对话框选择备份文件
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: "备份文件", extensions: ["zip"] }],
    });

    if (!filePaths || filePaths.length === 0) {
      event.sender.send("restore-data-reply", {
        success: false,
        message: "未选择备份文件",
      });
      return;
    }

    const backupFilePath = filePaths[0];

    // 尝试多次解锁和删除操作
    let maxRetries = 3;
    let retryCount = 0;
    let isSuccessful = false;

    while (retryCount < maxRetries && !isSuccessful) {
      try {
        // 检查目标目录是否存在，不存在则创建
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // 先删除目标目录下的所有文件（添加重试逻辑）
        const deleteWithRetry = (path) => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 5;

            const tryDelete = () => {
              attempts++;
              try {
                if (fs.existsSync(path)) {
                  fs.unlinkSync(path);
                  resolve();
                } else {
                  resolve();
                }
              } catch (err) {
                if (
                  attempts < maxAttempts &&
                  (err.code === "EBUSY" || err.code === "EPERM")
                ) {
                  // 短暂延迟后重试
                  setTimeout(tryDelete, 500);
                } else {
                  reject(err);
                }
              }
            };

            tryDelete();
          });
        };

        // 解压备份文件到目标目录
        const zip = new AdmZip(backupFilePath);
        zip.extractAllTo(dataDir, true); // true 表示覆盖现有文件

        isSuccessful = true;
      } catch (err) {
        retryCount++;
        console.error(`恢复数据时出错（第${retryCount}次尝试）：`, err);

        if (retryCount >= maxRetries) {
          throw err; // 达到最大重试次数后抛出错误
        }

        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    event.sender.send("restore-data-reply", {
      success: true,
      message: "数据恢复成功！",
    });
  } catch (err) {
    console.error("恢复数据时出错：", err);
    event.sender.send("restore-data-reply", {
      success: false,
      message: `数据恢复失败：${err.message}`,
    });
  }
});

const init = () => {
  app.whenReady().then(async () => {
    await initDatabase();
    mainWin = createWindow();
    initWindowBounds(mainWin);
  });

  app.on("activate", (event) => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWin = createWindow();
    }
  });

  app.on("window-all-closed", (event) => {
    if (!isDevEnv) {
      app.quit();
    }
  });

  app.on("before-quit", (event) => {
    sendToRenderer("app-quit");
  });
};

//启动应用
startup();
