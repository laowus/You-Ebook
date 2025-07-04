//关闭警告提示
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
const { app, BrowserWindow, ipcMain, Menu, dialog, Tray } = require("electron");
const isDevEnv = process.env["NODE_ENV"] === "dev";
const path = require("path");
const fs = require("fs");
const Store = require("electron-store");
const store = new Store();
const { createEpub } = require("./createEpub");
const { createTxt } = require("./createTxt");
const { initDatabase } = require("./dbtool");
let resourcesRoot = path.resolve(app.getAppPath());
let publicRoot = path.join(__dirname, "../../public");
const dbHandle = require("./ipcHandlers/dbHandle");
const fileHandle = require("./ipcHandlers/fileHandle");
if (!isDevEnv) {
  resourcesRoot = path.dirname(resourcesRoot);
  publicRoot = path.join(__dirname, "../../dist");
}

let mainWin = null,
  tray = null;
let options = {
  width: 1050,
  height: 660,
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
    const windowWidth = parseInt(store.get("mainWindowWidth") || 1050);
    const windowHeight = parseInt(store.get("mainWindowHeight") || 660);
    const windowX = parseInt(store.get("mainWindowX"));
    const windowY = parseInt(store.get("mainWindowY"));
    const mainWindow = new BrowserWindow({
      ...options,
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
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
    const width = store.get("mainWindowWidth") || 1050;
    const height = store.get("mainWindowHeight") || 660;
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
      defaultPath: `${metaData.title}.epub`,
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
        console.log("Text", txtContent);
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

const txtToHtmlString = (txt, title) => {
  // 先按两个及以上换行符分割成段落
  const paragraphs = txt.split(/\n{2,}/);
  // 对每个段落处理，将单个换行符替换为 <br> 标签
  // 空格符号转义：将连续空格替换为 &nbsp;
  const htmlParagraphs = paragraphs.map((paragraph) => {
    // 转义空格
    const escapedParagraph = paragraph.replace(/ {2,}/g, (match) => {
      return "&nbsp;".repeat(match.length);
    });
    const lines = escapedParagraph.split("\n");
    return `<p>${lines.join("<br>")}</p>`;
  });
  // 合并所有段落
  const bodyContent = htmlParagraphs.join("");
  // 包裹完整的 HTML 结构
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  ${bodyContent}
</body>
</html>
`.trim();
};

// 监听重启程序请求
ipcMain.on("restart-app", () => {
  app.relaunch();
  app.exit();
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
      await createTxt(chapters, metaData, mainWin).then((txtContent) => {
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
