const { ipcMain } = require("electron");
const { getChap } = require("./dbtool");

// 修改 generateTxt 函数，使其返回 Promise
const generateTxt = async (chapters, metadata, mainWin) => {
  let localTxtContent = "";
  for (const chapter of chapters) {
    const result = await getChap(metadata.bookId, chapter.href);
    // 发送进度信息给渲染进程
    if (mainWin && mainWin.webContents) {
      mainWin.webContents.send("showtip", chapter.label);
    }
    const content = result.success
      ? chapter.label + "\n" + result.data.content
      : "";
    localTxtContent += content;

    if (chapter.subitems) {
      // 递归调用并等待结果
      const subContent = await generateTxt(chapter.subitems, metadata);
      localTxtContent += subContent;
    }
  }
  ipcMain.emit("hidetip");
  return localTxtContent;
};

const createTxt = async (chapters, metadata, mainWin) => {
  // 检查 chapters 是否为空
  if (!chapters || chapters.length === 0) {
    console.log("chapters 数组为空");
    return "";
  }

  try {
    // 等待 generateTxt 执行完成
    const txtContent = await generateTxt(chapters, metadata, mainWin);
    return txtContent;
  } catch (err) {
    console.error("转换过程中出现错误:", err);
    throw err;
  }
};

module.exports = {
  createTxt,
};
