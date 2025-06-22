import { makeBook } from "./view.js";
import { storeToRefs } from "pinia";
import { useBookStore } from "../store/bookStore.js";
import EventBus from "../common/EventBus";
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
  const { setToc, setMetaData, setFirst } = useBookStore();
  const { metaData, isFirst, toc } = storeToRefs(useBookStore());
  return new Promise(async (resolve, reject) => {
    const timestamp = Date.now();
    const book = await makeBook(file);
    console.log(book);
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
      }; //把文件信息添加到数据库中
      ipcRenderer.send("db-insert-book", _metaData);
      ipcRenderer.once("db-insert-book-response", (event, res) => {
        bookId = res.bookId;
        setMetaData({ ..._metaData, bookId: bookId });
        insertChapter(book, bookId).then(() => {
          setFirst(false);
          const firstChapter = ipcRenderer.sendSync("db-first-chapter", bookId);
          resolve(firstChapter.data);
          EventBus.emit("updateToc", firstChapter.data.id);
          EventBus.emit("hideTip");
        });
      });
    } else {
      const bookId = metaData.value.bookId;
      insertChapter(book, bookId).then(() => {
        EventBus.emit("hideTip");
        EventBus.emit("updateToc", book.toc[0].href);
      });
    }
  });
};

// 定义一个函数来提取 HTML 字符串中的纯文本
const getTextFromHTML = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  return doc.body.textContent || "";
};

const iCTip = (text) => {
  EventBus.emit("showTip", text);
};

// 插入章节以及内容加入数据库
const insertChapter = async (book, bookId) => {
  // [href, content]
  const insertTocItem = async (item, parentid = null) => {
    const res = await book.resolveHref(item.href);
    // 等待 createDocument 完成
    const doc = await book.sections[res.index].createDocument();
    const str = getTextFromHTML(doc.documentElement.outerHTML);
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
      "导入" + tocItem.label + "中 ..." + (index + 1) + "/" + book.toc.length
    );
    await insertTocItem(tocItem, null);
  }
};
