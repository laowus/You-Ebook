export const getChapters = (content, title, chapterRegex) => {
  const chapters = [];
  let lastIndex = 0;
  let match;
  let chapterIndex = 0; // 初始化章节索引
  while ((match = chapterRegex.exec(content)) !== null) {
    console.log("match", match);
    if (chapters.length > 0) {
      const prevChapterEnd = match.index;
      let chapterContent = content.slice(lastIndex, prevChapterEnd);
      // 去除首行的 \n
      chapterContent = chapterContent.replace(/^\n/, "");
      if (chapterContent === "") {
        chapters.pop();
        chapterIndex--;
        continue;
      }
      chapters[chapters.length - 1].content += chapterContent;
    }

    const trimmedTitle = match[0].trim();
    chapters.push({
      index: chapterIndex,
      label: trimmedTitle,
      content: "",
    });
    chapterIndex++; // 索引自增
    lastIndex = match.index + match[0].length;
  }
  if (chapters.length > 0) {
    let lastChapterContent = content.slice(lastIndex);
    lastChapterContent = lastChapterContent.replace(/^\n/, "");
    chapters[chapters.length - 1].content += lastChapterContent;
  } else {
    content = content.replace(/^\n/, "");
    chapters.push({
      index: 0,
      label: title,
      content: content,
    });
  }
  return chapters;
};
