const { getChap } = require("./dbtool");

// 修改 generateTxt 函数，使其返回 Promise
const generateTxt = async (chapters, metadata) => {
  let localTxtContent = "";
  for (const chapter of chapters) {
    const result = await getChap(metadata.bookId, chapter.href);
    // 打印 getChap 函数的返回结果
    console.log("getChap result:", result);
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
  return localTxtContent;
};

const createTxt = async (chapters, metadata) => {
  // 检查 chapters 是否为空
  if (!chapters || chapters.length === 0) {
    console.log("chapters 数组为空");
    return "";
  }

  try {
    // 等待 generateTxt 执行完成
    const txtContent = await generateTxt(chapters, metadata);
    return txtContent;
  } catch (err) {
    console.error("转换过程中出现错误:", err);
    throw err;
  }
};

module.exports = {
  createTxt,
};
