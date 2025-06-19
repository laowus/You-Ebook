const { ipcMain } = require("electron");
const JSZip = require("jszip");
const { getChap } = require("./dbtool");
// 递归生成 navPoints 的函数
const generateNavPoints = (chapters, parentPlayOrder = 1) => {
  let currentPlayOrder = parentPlayOrder;
  return chapters.map((chapter, index) => {
    const id = `chapter${chapter.href}`;
    const playOrder = currentPlayOrder++;
    let navPoint = `<navPoint id="navPoint-${id}" playOrder="${playOrder}">
                  <navLabel>
                    <text>${chapter.label}</text>
                  </navLabel>
                  <content src="./OEBPS/${id}.xhtml" />`;
    if (chapter.subitems && chapter.subitems.length > 0) {
      const subNavPoints = generateNavPoints(
        chapter.subitems,
        currentPlayOrder
      );
      currentPlayOrder += subNavPoints.length;
      navPoint += subNavPoints.join("\n");
    }
    navPoint += `</navPoint>`;
    return navPoint.trim();
  });
};

// 扁平化章节列表的函数
const flattenChapters = (chapters) => {
  return chapters.flatMap((chapter) => [
    chapter,
    ...(chapter.subitems ? flattenChapters(chapter.subitems) : []),
  ]);
};

// 格式化文本，添加分段和缩进
const formatText = (text) => {
  const lines = text.split("\n");
  let paragraphs = [];

  for (let line of lines) {
    line = line.trim();
    if (line !== "") {
      paragraphs.push(`<p>${line}</p>`);
    }
  }

  return paragraphs.join("\n");
};

const createEpub = async (chapters, metadata, mainWin) => {
  return new Promise((resolve, reject) => {
    try {
      const { author, title } = metadata;
      const zip = new JSZip();
      zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
      zip.folder("META-INF").file(
        "container.xml",
        ` <?xml version="1.0" encoding="UTF-8"?>
            <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
                <rootfiles>
                <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
                </rootfiles>
            </container>`.trim()
      );

      // 调用递归函数生成 navPoints
      const navPoints = generateNavPoints(chapters).join("\n");

      // 目录页面
      zip.folder("").file(
        "toc.ncx",
        ` <?xml version="1.0" encoding="UTF-8"?>
            <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
                <head>
                <meta name="dtb:uid" content="book-id" />
                <meta name="dtb:depth" content="1" />
                <meta name="dtb:totalPageCount" content="0" />
                <meta name="dtb:maxPageNumber" content="0" />
                </head>
                <docTitle>
                <text>${title}</text>
                </docTitle>
                <docAuthor>
                <text>${author}</text>
                </docAuthor>
                <navMap>
                ${navPoints}
                </navMap>
            </ncx>`.trim()
      );

      // 扁平化章节列表
      const flatChapters = flattenChapters(chapters);

      // 生成 manifest
      const manifest = flatChapters
        .map(
          (chapter, index) => `
        <item id="chap${chapter.href}" href="OEBPS/chapter${chapter.href}.xhtml" media-type="application/xhtml+xml"/>
    `
        )
        .join("")
        .trim();

      // 生成 spine
      const spine = flatChapters
        .map(
          (chapter, index) => `
        <itemref idref="chap${chapter.href}"/>`
        )
        .join("")
        .trim();

      // 生成内容页面
      // 将 forEach 替换为 for...of 循环
      const addChapterFiles = async () => {
        for (const [index, chapter] of flatChapters.entries()) {
          // 调用 getChap 获取章节内容
          const result = await getChap(metadata.bookId, chapter.href);
          // 检查返回结果是否成功
          const content = result.success ? formatText(result.data.content) : "";
          // 使用 mainWindow.webContents.send 发送消息给渲染进程
          if (mainWin && mainWin.webContents) {
            mainWin.webContents.send("showtip", chapter.label);
          }
          zip.folder("OEBPS").file(
            `chapter${chapter.href}.xhtml`,
            `<?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
                <html xmlns="http://www.w3.org/1999/xhtml" lang="zh">
                  <head>
                    <title>${chapter.label}</title>
                    <link rel="stylesheet" type="text/css" href="../style.css"/>
                  </head>
                  <body>
                  ${content}
                  </body>
                </html>
              `.trim()
          );
        }
      };

      // 等待所有章节文件添加完成
      addChapterFiles()
        .then(() => {
          const tocManifest = `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`;
          ipcMain.emit("hidetip");
          // 生成 content.opf
          zip.folder("").file(
            "content.opf",
            `
            <?xml version="1.0" encoding="UTF-8"?>
            <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
              <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                <dc:title>${title}</dc:title>
                <dc:language>zh</dc:language>
                <dc:creator>${author}</dc:creator>
                <dc:identifier id="book-id">${new Date().getTime()}</dc:identifier>
              </metadata>
              <manifest>
                ${manifest}
                ${tocManifest}
              </manifest>
              <spine toc="ncx">
                ${spine}
              </spine>
            </package>
          `.trim()
          );

          zip
            .generateAsync({ type: "nodebuffer" })
            .then((epubContent) => {
              resolve(epubContent);
            })
            .catch((err) => {
              console.error("转换过程中出现错误:", err);
              reject(err);
            });
        })
        .catch((err) => {
          console.error("添加章节文件时出现错误:", err);
          reject(err);
        });
    } catch (err) {
      console.error("转换过程中出现错误:", err);
      reject(err);
    }
  });
};
module.exports = {
  createEpub,
};
