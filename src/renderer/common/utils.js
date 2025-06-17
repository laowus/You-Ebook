const { webUtils } = window.require("electron");
const chardet = require("chardet");
const iconv = require("iconv-lite");
const fs = require("fs/promises");

const getFileExtension = (file) => {
  const fileName = file.name;
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex === -1
    ? ""
    : fileName.slice(lastDotIndex + 1).toLowerCase();
};

export const parseFile = (file) => {
  const filePath = webUtils.getPathForFile(file);
  const ext = getFileExtension(file);
  // 为 file 对象添加 path 属性
  Object.defineProperty(file, "path", {
    value: filePath,
    writable: false,
    enumerable: true,
    configurable: false,
  });
  // 为 file 对象添加 ext 属性
  Object.defineProperty(file, "ext", {
    value: ext,
    writable: false,
    enumerable: true,
    configurable: false,
  });
  return file;
};

// 定义一个函数来提取 HTML 字符串中的纯文本
export const getTextFromHTML = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  return doc.body.textContent || "";
};

export const readTxtFile = async (filePath) => {
  try {
    const detectedEncoding = await detectEncoding(filePath);
    const buffer = await fs.readFile(filePath);
    return iconv.decode(buffer, detectedEncoding);
  } catch (err) {
    throw new Error(`读取文件 ${filePath} 时出错: ${err.message}`);
  }
};
// 检测文件编码
const detectEncoding = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const detectedEncoding = chardet.detect(buffer);
  return detectedEncoding || "utf8";
};
