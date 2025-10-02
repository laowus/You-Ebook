import { makeBook } from "./view.js";
import { storeToRefs } from "pinia";
import { useBookStore } from "../store/bookStore.js";
import EventBus from "../common/EventBus";
const AdmZip = window.require("adm-zip");
const path = window.require("path");
const fs = window.require("fs");
const { ipcRenderer } = window.require("electron");
const $ = document.querySelector.bind(document);

let bookId = 0;
const locales = "en";
const listFormat = new Intl.ListFormat(locales, {
  style: "short",
  type: "conjunction",
});

const formatLanguageMap = (x) => {
  if (!x) return "";
  if (typeof x === "string") return x;
  const keys = Object.keys(x);
  return x[keys[0]];
};

const formatOneContributor = (contributor) =>
  typeof contributor === "string"
    ? contributor
    : formatLanguageMap(contributor?.name);

const formatContributor = (contributor) =>
  Array.isArray(contributor)
    ? listFormat.format(contributor.map(formatOneContributor))
    : formatOneContributor(contributor);

/**
 * 保存封面到本地
 * @param {*} coverData string base64 格式
 * @param {*} coverPath string 保存路径
 * @returns void
 */
const saveCoverToLocal = (coverData, coverPath) => {
  return new Promise((resolve, reject) => {
    const base64Data = coverData.split(",")[1];
    const fileBuffer = Buffer.from(base64Data, "base64");
    fs.writeFile(coverPath, fileBuffer, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(coverPath);
      }
    });
  });
};

export const open = async (file) => {
  console.log("open=====", file);
  const { setToc, setMetaData, setFirst } = useBookStore();
  const { metaData, isFirst, toc } = storeToRefs(useBookStore());

  // 将整个处理过程封装在一个 Promise 中
  return new Promise(async (resolve, reject) => {
    try {
      // 1. 先解析书籍内容
      const book = await makeBook(file.path);
      console.log(book);

      // 2. 处理书籍元数据和章节插入
      if (isFirst.value) {
        let _metaData = {
          title: book.metadata.title,
          author: book.metadata.author.name,
          description: book.metadata.description,
          cover: book.metadata.cover,
          path: file.path,
        };

        // 插入书籍数据到数据库
        ipcRenderer.send("db-insert-book", _metaData);
        ipcRenderer.once("db-insert-book-response", async (event, res) => {
          const bookId = res.bookId;
          setMetaData({ ..._metaData, bookId: bookId });

          const coverDir = ipcRenderer.sendSync("get-cover-dir", "ping");
          let coverPath = "";
          if (book.metadata.cover) {
            coverPath = path.join(coverDir, `${bookId}.jpg`);
            //假如coverPath 存在就删除
            if (fs.existsSync(coverPath)) {
              fs.unlinkSync(coverPath);
            }
            await saveCoverToLocal(book.metadata.cover, coverPath);
          }

          // 3. 解压 EPUB 文件并处理图片
          let imageMap = null;
          if (file && file.path && file.path.endsWith(".epub")) {
            try {
              console.log("解压EPUB文件并处理图片", bookId);
              const epubDir = ipcRenderer.sendSync("get-epub-dir", `${bookId}`);
              // 调用修改后的unzipEpub函数，获取imageMap
              const result = await unzipEpub(file.path, epubDir, bookId);
              imageMap = result.imageMap;
              console.log(`EPUB 文件已解压到: ${result.extractPath}`);
            } catch (err) {
              console.error("解压 EPUB 文件失败:", err);
              // 解压失败不应阻止主流程
            }
          }

          // 插入章节，传入imageMap
          await insertChapter(book, bookId, imageMap);
          setFirst(false);

          // 继续原流程
          const firstChapter = ipcRenderer.sendSync("db-first-chapter", bookId);
          resolve(firstChapter.data);
          EventBus.emit("updateToc", firstChapter.data.id);
          EventBus.emit("hideTip");
        });
      } else {
        const bookId = metaData.value.bookId;
        // 3. 解压 EPUB 文件并处理图片
        let imageMap = null;
        if (file && file.path && file.path.endsWith(".epub")) {
          try {
            console.log("解压EPUB文件并处理图片", bookId);
            const epubDir = ipcRenderer.sendSync("get-epub-dir", `${bookId}`);
            // 调用修改后的unzipEpub函数，获取imageMap
            const result = await unzipEpub(file.path, epubDir, bookId);
            imageMap = result.imageMap;
            console.log(`EPUB 文件已解压到: ${result.extractPath}`);
          } catch (err) {
            console.error("解压 EPUB 文件失败:", err);
            // 解压失败不应阻止主流程
          }
        }

        await insertChapter(book, bookId, imageMap);
        // 继续原流程
        EventBus.emit("hideTip");
        EventBus.emit("updateToc", book.toc[0].href);
        resolve();
      }
    } catch (error) {
      reject(error);
      console.error("处理书籍时出错:", error);
    }
  });
};
/**
 *
 * @param {*} epubPath epub 文件路径
 * @param {*} extractPath 解压路径
 * @param {*} bookId 书籍id 用于生成图片文件夹名
 * @returns
 */
const unzipEpub = (epubPath, extractPath, bookId) => {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip(epubPath);
      const zipEntries = zip.getEntries();

      // 创建图片目录
      const imagesDir = path.join(extractPath, "images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // 存储原始图片路径和重命名后的路径的映射
      const imageMap = new Map();

      // 解压并处理图片文件
      zipEntries.forEach((entry) => {
        // 检查是否为图片文件
        const ext = path.extname(entry.entryName).toLowerCase();
        const imageExtensions = [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
          ".bmp",
          ".webp",
          ".svg",
        ];

        if (imageExtensions.includes(ext) && !entry.isDirectory) {
          // 生成唯一的文件名，避免冲突
          const uniqueName = `${generateCustomShortId()}${ext}`;
          const targetPath = path.join(imagesDir, uniqueName);

          // 保存文件
          fs.writeFileSync(targetPath, entry.getData());

          // 记录原始路径和新路径的映射
          imageMap.set(entry.entryName, "images/" + uniqueName);
          console.log(
            `已提取并重命名图片: ${entry.entryName} -> ${path.join(
              "images",
              uniqueName
            )}`
          );
        }
        // else if (!entry.isDirectory) {
        //   // 处理非图片文件，但不重命名
        //   const targetPath = path.join(extractPath, entry.entryName);
        //   const targetDir = path.dirname(targetPath);
        //   if (!fs.existsSync(targetDir)) {
        //     fs.mkdirSync(targetDir, { recursive: true });
        //   }
        //   fs.writeFileSync(targetPath, entry.getData());
        // }
      });

      resolve({ extractPath, imageMap });
    } catch (err) {
      reject(err);
    }
  });
};

const generateCustomShortId = () => {
  // 获取时间戳的后8位
  const timestamp = Date.now().toString().slice(-8);
  // 生成随机数
  const random = Math.random().toString(36).substring(2, 8);
  return timestamp + random;
};

// 修改getTextFromHTML函数，添加图片路径映射参数并保留格式标签
const getTextFromHTML = (htmlString, imageMap = null) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // 定义需要保留的格式标签
  const preserveTags = [
    "B",
    "STRONG", // 加粗
    "I",
    "EM", // 斜体
    "U", // 下划线
    "BR",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6", // 结构标签
    "UL",
    "OL",
    "LI", // 列表
    "IMG", // 图片（已保留）
  ];

  // 递归处理节点，保留指定的标签和图片
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    } else if (node.nodeName === "IMG") {
      // 获取原始src属性
      let src = node.getAttribute("src");
      if (src && imageMap && imageMap.size > 0) {
        // 查找对应的新路径
        // 由于路径格式可能不同，我们需要进行模糊匹配
        let found = false;
        for (let [originalPath, newPath] of imageMap.entries()) {
          if (src.includes(path.basename(originalPath))) {
            console.log(`替换图片路径: ${src} -> ${newPath}`);
            node.setAttribute("src", newPath);
            found = true;
            break;
          }
        }
        if (!found) {
          console.log(`未找到匹配的图片路径: ${src}`);
        }
      }
      // 不再直接返回outerHTML，而是手动构建带自闭合符号的标签
      let imgHtml = `<img`;
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        imgHtml += ` ${attr.name}="${attr.value}"`;
      }
      imgHtml += ` />`;
      console.log("修改后的图片", imgHtml);
      return imgHtml;
    } else if (node.nodeName === "BR") {
      return "\n";
    } else if (node.nodeName === "P") {
      // 处理p标签：替换为换行符
      let result = "\n";
      for (let child of node.childNodes) {
        result += processNode(child);
      }
      result += "\n";
      return result;
    } else if (node.nodeName === "DIV") {
      // 处理div标签：去掉标签但保留内容
      let result = "";
      for (let child of node.childNodes) {
        result += processNode(child);
      }
      return result;
    } else if (preserveTags.includes(node.nodeName)) {
      // 对于其他需要保留的格式标签，保留标签结构
      let result = `<${node.nodeName.toLowerCase()}`;

      // 保留所有属性
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        // 跳过已经处理过的src属性
        if (!(node.nodeName === "IMG" && attr.name === "src")) {
          result += ` ${attr.name}="${attr.value}"`;
        }
      }

      result += ">";

      // 处理子节点
      for (let child of node.childNodes) {
        result += processNode(child);
      }

      // 添加结束标签
      if (!["BR"].includes(node.nodeName)) {
        result += `</${node.nodeName.toLowerCase()}>`;
      }

      return result;
    } else {
      let result = "";
      // 遍历子节点
      for (let child of node.childNodes) {
        result += processNode(child);
      }
      return result;
    }
  }

  return processNode(doc.body) || "";
};

const iCTip = (text) => {
  EventBus.emit("showTip", text);
};

// 修改insertChapter函数，添加imageMap参数
const insertChapter = async (book, bookId, imageMap = null) => {
  // [href, content]
  const insertTocItem = async (item, parentid = null) => {
    const res = await book.resolveHref(item.href);
    // 等待 createDocument 完成
    const doc = await book.sections[res.index].createDocument();
    // 调用修改后的getTextFromHTML函数，传入imageMap
    const str = getTextFromHTML(doc.documentElement.outerHTML, imageMap);

    // 封装发送请求和监听响应为一个 Promise
    await new Promise((resolve, reject) => {
      const successListener = (res) => {
        item.href = res.id;
        resolve(res);
      };
      EventBus.on("addChapterRes", successListener);
      const chapterData = {
        label: item.label,
        href: item.href,
        content: str,
        bookId: bookId,
      };
      EventBus.emit("addChapter", {
        href: parentid,
        chapter: chapterData,
      });
    });

    if (item.subitems) {
      parentid = item.href;
      for (const subitem of item.subitems) {
        await insertTocItem(subitem, parentid);
      }
    }
  };

  // 使用 entries() 方法获取索引和元素
  for (const [index, tocItem] of book.toc.entries()) {
    iCTip(
      "导入 " + tocItem.label + " (" + (index + 1) + "/" + book.toc.length + ")"
    );
    await insertTocItem(tocItem, null);
  }
};
