import JSZip from "jszip";

// 递归生成 navPoints 的函数
const generateNavPoints = (chapters, parentPlayOrder = 1) => {
  let currentPlayOrder = parentPlayOrder;
  return chapters.map((chapter, index) => {
    const id = `chapter${currentPlayOrder}`;
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

export const createEpub = async (chapters, metadata) => {
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
          (_, index) => `
        <item id="chap${index + 1}" href="OEBPS/chapter${
            index + 1
          }.xhtml" media-type="application/xhtml+xml"/>
    `
        )
        .join("")
        .trim();

      // 生成 spine
      const spine = flatChapters
        .map(
          (_, index) => `
        <itemref idref="chap${index + 1}"/>`
        )
        .join("")
        .trim();

      // 生成内容页面
      flatChapters.forEach((chapter, index) => {
        // 这里假设 chapter.content 存在，实际使用时可能需要根据情况调整
        const content = chapter.content || "";
        zip.folder("OEBPS").file(
          `chapter${index + 1}.xhtml`,
          `
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
                <html xmlns="http://www.w3.org/1999/xhtml" lang="zh">
                  <head>
                    <title>${chapter.label}</title>
                    <link rel="stylesheet" type="text/css" href="../style.css"/>
                  </head>
                  <body>
                  <h1>${chapter.label}</h1>
                  ${content}
                  </body>
                </html>
              `.trim()
        );
      });

      const tocManifest = `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`;

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
    } catch (err) {
      console.error("转换过程中出现错误:", err);
      reject(err);
    }
  });
};


