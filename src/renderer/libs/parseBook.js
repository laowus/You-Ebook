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
      const timestamp = Date.now();
      // 1. 先解析书籍内容
      const book = await makeBook(file.path);
      console.log(book);

      // 2. 处理书籍元数据和章节插入
      if (isFirst.value) {
        const coverDir = ipcRenderer.sendSync("get-cover-dir", "ping");
        let coverPath = "";
        if (book.metadata.cover) {
          coverPath = path.join(coverDir, timestamp + ".jpg");
          await saveCoverToLocal(book.metadata.cover, coverPath);
        }
        let _metaData = {
          title: book.metadata.title,
          author: book.metadata.author.name,
          description: book.metadata.description,
          cover: coverPath,
          path: file.path,
        };

        // 插入书籍数据到数据库
        ipcRenderer.send("db-insert-book", _metaData);
        ipcRenderer.once("db-insert-book-response", async (event, res) => {
          const bookId = res.bookId;
          setMetaData({ ..._metaData, bookId: bookId });

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
          const uniqueName = `img_${bookId}_${Date.now()}_${Math.floor(
            Math.random() * 1000
          )}${ext}`;
          const targetPath = path.join(imagesDir, uniqueName);

          // 保存文件
          fs.writeFileSync(targetPath, entry.getData());

          // 记录原始路径和新路径的映射
          imageMap.set(entry.entryName, path.join("images", uniqueName));
          console.log(
            `已提取并重命名图片: ${entry.entryName} -> ${uniqueName}`
          );
        } else if (!entry.isDirectory) {
          // 处理非图片文件，但不重命名
          const targetPath = path.join(extractPath, entry.entryName);
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, entry.getData());
        }
      });

      resolve({ extractPath, imageMap });
    } catch (err) {
      reject(err);
    }
  });
};

// 修改getTextFromHTML函数，添加图片路径映射参数
const getTextFromHTML = (htmlString, imageMap = null) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // 递归处理节点，保留 img 标签，其他转为文本
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
            node.setAttribute("src", newPath);
            found = true;
            break;
          }
        }
        if (!found) {
          console.log(`未找到匹配的图片路径: ${src}`);
        }
      }
      return node.outerHTML;
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
