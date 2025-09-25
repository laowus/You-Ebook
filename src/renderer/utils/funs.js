// 优化后的getChapters函数 - 保留第一个匹配前面的内容

export const getChapters = (content, title, chapterRegex) => {
  // 输入参数验证
  if (!content || typeof content !== "string" || !chapterRegex) {
    return [];
  }

  const chapters = [];
  let lastIndex = 0;
  let match;
  let chapterIndex = 0;
  let hasPrologue = false;

  // 重置正则表达式的lastIndex以确保正确匹配
  if (chapterRegex.global) {
    chapterRegex.lastIndex = 0;
  }

  while ((match = chapterRegex.exec(content)) !== null) {
    // 处理第一个匹配项前面的内容（如果有）
    if (chapters.length === 0 && match.index > 0) {
      const prologueContent = content.slice(0, match.index).trim();
      if (prologueContent !== "") {
        chapters.push({
          index: chapterIndex,
          label: title, // 可以自定义前言的标签名称
          content: prologueContent,
        });
        chapterIndex++;
        hasPrologue = true;
      }
    }

    if (chapters.length > 0 && !hasPrologue) {
      // 处理第一个章节内容（原来的逻辑）
      const prevChapterEnd = match.index;
      let chapterContent = content.slice(lastIndex, prevChapterEnd);
      chapterContent = chapterContent.replace(/^\n/, "").trim();

      if (chapterContent === "") {
        chapters.pop();
        chapterIndex--;
        lastIndex = prevChapterEnd;
        continue;
      }

      chapters[chapters.length - 1].content += chapterContent;
    } else if (chapters.length > 0) {
      // 对于后续章节，仍然需要处理内容
      const prevChapterEnd = match.index;
      let chapterContent = content.slice(lastIndex, prevChapterEnd);
      chapterContent = chapterContent.replace(/^\n/, "").trim();

      if (chapterContent === "") {
        chapters.pop();
        chapterIndex--;
        lastIndex = prevChapterEnd;
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

    chapterIndex++;
    lastIndex = match.index + match[0].length;
    hasPrologue = false; // 重置标志，确保只添加一次前言

    // 防止无限循环（处理零宽度匹配）
    if (match.index === chapterRegex.lastIndex) {
      chapterRegex.lastIndex++;
    }
  }

  // 处理最后一个章节的内容
  if (chapters.length > 0) {
    let lastChapterContent = content.slice(lastIndex);
    lastChapterContent = lastChapterContent.replace(/^\n/, "").trim();
    chapters[chapters.length - 1].content += lastChapterContent;
  }

  return chapters;
};
