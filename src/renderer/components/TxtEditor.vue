<script setup>
import { ref, inject, watch, onMounted, toRaw, computed } from "vue";
const { ipcRenderer } = window.require("electron");
import { storeToRefs } from "pinia";
import { useBookStore } from "../store/bookStore";
import EventBus from "../common/EventBus";
const { curChapter, selectColor } = storeToRefs(useBookStore());

const barValue = ref("1");
const suffix = ref("\n");
const editArea = ref(null);
const barArea = ref(null);

const curTabIndex = ref(0);
const showReplace = ref(false);

// 添加查找替换相关状态
const searchVisible = ref(false);
const searchText = ref("");
const matchCount = ref(0);
const currentMatchIndex = ref(0);
const matches = ref([]); // 存储所有匹配位置信息

const replaceText = ref("");

// 添加查找替换相关方法
const toggleSearchPanel = () => {
  searchVisible.value = !searchVisible.value;
  if (searchVisible.value && editArea.value) {
    // 聚焦到输入框
    setTimeout(() => {
      const searchInput = document.querySelector(".search-input");
      if (searchInput) searchInput.focus();
    }, 100);
  }
};

const searchTextHandler = () => {
  if (!searchText.value || !editArea.value) {
    matchCount.value = 0;
    currentMatchIndex.value = 0;
    matches.value = []; // 清空匹配位置信息
    return;
  }

  const content = editArea.value.value;
  const regex = new RegExp(searchText.value, "g");
  const matchResults = [];
  let match;

  // 查找所有匹配位置
  while ((match = regex.exec(content)) !== null) {
    matchResults.push({
      start: match.index,
      end: match.index + match[0].length,
    });
    // 防止零宽度匹配导致的无限循环
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }

  matches.value = matchResults;
  matchCount.value = matchResults.length;
  currentMatchIndex.value = 0;

  // 如果有匹配项，选中第一个
  if (matchResults.length > 0) {
    selectMatch(0);
  }
};

// 选中指定索引的匹配项
const selectMatch = (index) => {
  if (!editArea.value || index < 0 || index >= matches.value.length) {
    return;
  }

  const textarea = editArea.value;
  const match = matches.value[index];

  // 设置选中范围
  textarea.selectionStart = match.start;
  textarea.selectionEnd = match.end;

  // 滚动到选中位置
  textarea.focus();

  // 考虑视觉换行的精确滚动实现
  const scrollToVisualLine = () => {
    const textareaEl = textarea;

    // 创建用于测量的临时元素
    const createMeasurementElement = () => {
      const measurementDiv = document.createElement("div");

      // 复制文本框的关键样式，确保测量准确
      const textareaStyle = window.getComputedStyle(textareaEl);
      measurementDiv.style.visibility = "hidden";
      measurementDiv.style.position = "absolute";
      measurementDiv.style.top = "-9999px";
      measurementDiv.style.left = "-9999px";
      measurementDiv.style.width = textareaStyle.width;
      measurementDiv.style.font = textareaStyle.font;
      measurementDiv.style.fontSize = textareaStyle.fontSize;
      measurementDiv.style.fontFamily = textareaStyle.fontFamily;
      measurementDiv.style.lineHeight = textareaStyle.lineHeight;
      measurementDiv.style.padding = textareaStyle.padding;
      measurementDiv.style.border = textareaStyle.border;
      measurementDiv.style.boxSizing = textareaStyle.boxSizing;
      measurementDiv.style.whiteSpace = "pre-wrap"; // 关键：处理空白和换行
      measurementDiv.style.wordWrap = "break-word"; // 关键：允许单词内换行
      measurementDiv.style.overflowWrap = "break-word";

      document.body.appendChild(measurementDiv);
      return measurementDiv;
    };

    // 计算文本到指定位置的实际显示行数
    const calculateVisualLines = (text, pos) => {
      const measurementDiv = createMeasurementElement();

      // 计算行高
      measurementDiv.textContent = "X"; // 使用单个字符计算行高
      const lineHeight = measurementDiv.offsetHeight;

      // 设置文本到指定位置
      measurementDiv.textContent = text.substring(0, pos);

      // 计算实际显示的行数
      const totalHeight = measurementDiv.offsetHeight;
      const visualLines = Math.ceil(totalHeight / lineHeight);

      // 清理临时元素
      document.body.removeChild(measurementDiv);

      return {
        lines: visualLines,
        lineHeight: lineHeight,
      };
    };

    // 获取选择位置的视觉行数和行高
    const result = calculateVisualLines(textareaEl.value, match.start);
    const visualLines = result.lines;
    const lineHeight = result.lineHeight;

    // 计算目标滚动位置
    const viewportHeight = textareaEl.clientHeight;
    const visibleLines = Math.floor(viewportHeight / lineHeight);

    // 计算滚动值，使选中行位于视图中央
    const targetScrollTop = Math.max(
      0,
      (visualLines - Math.floor(visibleLines / 2)) * lineHeight
    );

    // 确保不超出最大滚动范围
    const maxScrollTop = textareaEl.scrollHeight - viewportHeight;
    const finalScrollTop = Math.min(targetScrollTop, maxScrollTop);

    // 使用requestAnimationFrame确保精确滚动
    requestAnimationFrame(() => {
      textareaEl.scrollTop = finalScrollTop;

      // 二次确认滚动位置
      requestAnimationFrame(() => {
        textareaEl.scrollTop = finalScrollTop;
      });
    });
  };

  // 延迟执行以确保DOM已更新
  setTimeout(scrollToVisualLine, 10);
  // 更新当前匹配索引
  currentMatchIndex.value = index + 1; // 显示为从1开始的索引
};

// 查找下一个匹配项
const searchNext = () => {
  if (matchCount.value === 0) return;

  let nextIndex = currentMatchIndex.value; // 因为currentMatchIndex是从1开始的
  if (nextIndex >= matchCount.value) {
    nextIndex = 0; // 循环到第一个
  }

  selectMatch(nextIndex);
};

// 查找上一个匹配项
const searchPrev = () => {
  if (matchCount.value === 0) return;

  let prevIndex = currentMatchIndex.value - 2; // 因为currentMatchIndex是从1开始的
  if (prevIndex < 0) {
    prevIndex = matchCount.value - 1; // 循环到最后一个
  }

  selectMatch(prevIndex);
};

// 设置行号方法
const line = (n) => {
  let num = "";
  for (let i = 1; i <= n; i++) {
    num += i + suffix.value;
  }
  barValue.value = num;
};

// 同步滚动条位置方法
const syncScrollTop = () => {
  if (barArea.value && editArea.value) {
    barArea.value.scrollTop = editArea.value.scrollTop;
  }
};
// 滚动到顶部的方法
const scrollRightWrapperToTop = () => {
  if (editArea.value) {
    editArea.value.scrollTop = 0;
  }
};

EventBus.on("scrollToTop", scrollRightWrapperToTop);

watch(
  curChapter,
  (val) => {
    queueMicrotask(() => {
      const textarea = editArea.value;
      if (!textarea) return;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const scrollHeight = textarea.scrollHeight;
      const rows = Math.ceil(scrollHeight / lineHeight);
      line(rows);
      if (val && Object.keys(val).length > 0) {
        try {
          ipcRenderer.send("db-update-chapter", toRaw(val));
        } catch (error) {
          console.error("发送 db-update-chapter 消息时出错:", error);
        }
      } else {
        console.log("val 无效，不发送消息");
      }
    });
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  if (editArea.value) {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width !== entry.borderBoxSize[0].inlineSize) {
          const textarea = editArea.value;
          const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
          const scrollHeight = textarea.scrollHeight;
          const rows = Math.ceil(scrollHeight / lineHeight);
          line(rows);
        }
      }
    });
    observer.observe(editArea.value);
  }
  // 组件挂载时滚动到顶部
  scrollRightWrapperToTop();
});

// 添加在已有的computed部分
const formattedContent = computed(() => {
  // 获取图片存储位置
  const imageDir = ipcRenderer.sendSync(
    "get-image-dir",
    `${curChapter.value?.bookId}`
  );

  if (!curChapter.value?.content) return "";

  const curStr = curChapter.value.content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      // 替换图片路径
      if (line.includes("src=")) {
        // 将路径中的"images"替换为imageDir变量
        // 替换 \ 为 /
        return line.replace(
          /images\\/,
          `file:///${imageDir.replace(/\\/g, "/")}/`
        );
      }
      return `<p>${line}</p>`;
    })
    .join("");
  return curStr;
});

// 添加斜体格式化功能
const formatTag = (tag) => {
  if (!editArea.value) return;

  const textarea = editArea.value;
  const { selectionStart, selectionEnd, value } = textarea;

  // 获取选中的文本
  const selectedText = value.substring(selectionStart, selectionEnd);
  //判断selectedText 是否包含tag
  if (selectedText === "" || selectedText.length === 0) {
    ElMessage({
      message: "请先选择文本",
      type: "warning",
    });
    return;
  }
  const formattedText = `<${tag}>${selectedText}</${tag}>`;

  // 更新文本内容
  const newContent =
    value.substring(0, selectionStart) +
    formattedText +
    value.substring(selectionEnd);

  // 保存当前章节内容
  curChapter.value.content = newContent;
};

const addImage = () => {
  if (!editArea.value) return;

  // 调用Electron对话框选择图片
  ipcRenderer
    .invoke("select-image", `${curChapter.value?.bookId}`)
    .then((imagePath) => {
      if (!imagePath) return; // 用户取消选择

      const imgUrl = imagePath;

      // 创建图片标签
      const imgTag = `<img src="images\\${imgUrl}">`;

      const textarea = editArea.value;
      const { selectionStart, selectionEnd, value } = textarea;

      // 在光标位置插入图片标签
      const newContent =
        value.substring(0, selectionStart) +
        imgTag +
        value.substring(selectionEnd);

      // 更新内容
      curChapter.value.content = newContent;
    })
    .catch((err) => {
      console.error("图片选择失败:", err);
      ElMessage.error("图片选择失败");
    });
};

const insertStyle = (styleStr) => {
  if (!editArea.value) return;

  // 获取textarea和选中信息
  const textarea = editArea.value;
  const { selectionStart, selectionEnd, value } = textarea;
  const selectedText = value.substring(selectionStart, selectionEnd);

  if (!selectedText) return; // 如果没有选中文字，直接返回

  // 按换行符分割选中的文字
  const lines = selectedText.split("\n");

  // 给每段添加span标签
  const formattedLines = lines.map((line) => {
    if (styleStr.ty === "color")
      return `<span style="color: ${styleStr.val}">${line}</span>`;
    else if (styleStr.ty === "align")
      return `<p style="text-align: ${styleStr.val};">${line}</p>`;
  });

  // 用<br>连接处理后的段落，保持原来的换行效果
  const formattedText = formattedLines.join("\n");

  // 更新内容
  const newContent =
    value.substring(0, selectionStart) +
    formattedText +
    value.substring(selectionEnd);

  curChapter.value.content = newContent;
};

// 替换当前选择的文本
const replaceCurrent = () => {
  const textareaEl = editArea.value;
  if (!textareaEl || !searchText.value) return;

  const start = textareaEl.selectionStart;
  const end = textareaEl.selectionEnd;
  const selectedText = textareaEl.value.substring(start, end);

  // 检查选中的文本是否与要查找的文本匹配
  if (selectedText === searchText.value) {
    // 执行替换
    const newValue =
      textareaEl.value.substring(0, start) +
      replaceText.value +
      textareaEl.value.substring(end);

    textareaEl.value = newValue;

    // 设置光标位置到替换后的文本末尾
    const newCursorPos = start + replaceText.value.length;
    textareaEl.selectionStart = newCursorPos;
    textareaEl.selectionEnd = newCursorPos;

    // 重新聚焦textarea
    textareaEl.focus();

    // 触发input事件以更新v-model绑定
    textareaEl.dispatchEvent(new Event("input"));
  } else {
    // 如果当前选中的文本不匹配，尝试查找下一个匹配项
    searchNext();
  }
};

// 替换所有匹配的文本
const replaceAll = () => {
  const textareaEl = editArea.value;
  if (!textareaEl || !searchText.value) return;

  // 创建正则表达式，g标志表示全局匹配
  const regex = new RegExp(searchText.value, "g");
  const originalValue = textareaEl.value;
  const newValue = originalValue.replace(regex, replaceText.value);

  textareaEl.value = newValue;

  // 触发input事件以更新v-model绑定
  textareaEl.dispatchEvent(new Event("input"));

  // 重新聚焦textarea
  textareaEl.focus();
};
</script>

<template>
  <div class="out-editor">
    <div class="top-bar">
      <button @click="curTabIndex = 0" :class="{ active: curTabIndex === 0 }">
        编辑
      </button>
      <button @click="curTabIndex = 1" :class="{ active: curTabIndex === 1 }">
        预览
      </button>
    </div>
    <div class="edit-bar" v-if="curTabIndex === 0 && curChapter.content !== ''">
      <button class="btn-icon-normal" title="添加图片" @click="addImage">
        <span class="iconfont icon-tianjiatupian"></span>
      </button>
      <button class="btn-icon-normal" title="斜体" @click="formatTag('i')">
        <span class="iconfont icon-zitixieti"></span>
      </button>
      <button class="btn-icon-normal" title="下划线" @click="formatTag('u')">
        <span class="iconfont icon-zitixiahuaxian"></span>
      </button>
      <button class="btn-icon-normal" title="加粗" @click="formatTag('b')">
        <span class="iconfont icon-zitijiacu"></span>
      </button>
      <div class="color-select-wrapper">
        <button
          class="btn-icon-small"
          title="颜色"
          @click="insertStyle({ ty: 'color', val: selectColor })"
        >
          <span
            class="iconfont icon-yanseban"
            :style="{ color: selectColor }"
          ></span>
        </button>
        <input
          class="select-panel"
          type="color"
          v-model="selectColor"
          title="选择颜色"
        />
      </div>
      <div class="color-select-wrapper">
        <button
          class="btn-icon-small"
          title="居左"
          @click="insertStyle({ ty: 'align', val: 'left' })"
        >
          <span class="iconfont icon-juzuo"></span>
        </button>
        <button
          class="btn-icon-small"
          title="居中"
          @click="insertStyle({ ty: 'align', val: 'center' })"
        >
          <span class="iconfont icon-juzhongduiqi"></span>
        </button>
        <button
          class="btn-icon-small"
          title="居右"
          @click="insertStyle({ ty: 'align', val: 'right' })"
        >
          <span class="iconfont icon-juyou"></span>
        </button>
      </div>
      <button
        class="btn-icon-normal"
        title="查找替换"
        @click="toggleSearchPanel"
      >
        <span class="iconfont icon-chazhaotihuan"></span>
      </button>
    </div>
    <div class="line-edit-wrapper" v-if="curTabIndex === 0">
      <div class="left-bar-wrapper">
        <textarea
          ref="barArea"
          v-model="barValue"
          class="bar-area"
          wrap="off"
          cols="2"
          disabled
        />
      </div>
      <div class="rigth-edit-wrapper">
        <textarea
          ref="editArea"
          v-model="curChapter.content"
          class="edit-area"
          name="content"
          @scroll="syncScrollTop"
        />
      </div>
    </div>
    <div class="preview-wrapper" v-if="curTabIndex === 1">
      <div class="preview-content">
        <div v-html="formattedContent"></div>
      </div>
    </div>

    <div
      v-if="searchVisible && curChapter.content !== '' && curTabIndex === 0"
      class="search-float-panel"
    >
      <div class="search-left">
        <i
          class="iconfont"
          :class="showReplace ? 'icon-xiangxia2' : 'icon-xiangyou'"
          @click="showReplace = !showReplace"
        ></i>
      </div>
      <div class="search-right">
        <div class="search-content">
          <input
            v-model="searchText"
            class="search-input"
            placeholder="查找"
            @input="searchTextHandler"
            @keyup.enter="searchNext"
            @keyup.arrowdown="searchNext"
            @keyup.arrowup="searchPrev"
          />
          <div class="search-controls">
            <button class="search-btn" @click="searchPrev" title="上一个（↑）">
              ↑
            </button>
            <button class="search-btn" @click="searchNext" title="下一个（↓）">
              ↓
            </button>
          </div>
          <div class="search-info">
            <span v-if="matchCount > 0" class="match-count"
              >{{ currentMatchIndex }}/{{ matchCount }}</span
            >
          </div>
          <button class="search-close" @click="toggleSearchPanel" title="关闭">
            ×
          </button>
        </div>
        <div class="search-content" v-if="showReplace">
          <input
            v-model="replaceText"
            class="search-input"
            placeholder="替换"
          />
          <div class="search-controls">
            <button class="search-btn" @click="replaceCurrent" title="替换">
              <i class="iconfont icon-chazhaotihuan1"></i>
            </button>
            <button class="search-btn" @click="replaceAll" title="全部替换">
              <i class="iconfont icon-quanbutihuan"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.search-left {
  display: flex;
  align-items: center;
}
.search-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.edit-bar {
  height: 30px;
  display: flex;
  flex-direction: row;
  background-color: white;
  /* 添加垂直居中对齐 */
  align-items: center;
  /* 设置内边距：上下5px，左边10px */
  padding: 5px 0 5px 20px;
  gap: 20px;
}

.select-panel {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  border-color: transparent;
}
.color-select-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  border: 1px solid #ccc;
  padding: 2px 5px;
  border-radius: 5px;
}
.out-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.top-bar {
  width: 100%;
  height: 30px;
  background-color: #f0efe2;
  display: flex;
  flex-direction: row;
  gap: 5px;
}

.top-bar button {
  cursor: pointer;
  font-size: 12px;
  color: #333;
  transition: background-color 0.3s, color 0.3s;
  padding-left: 2%;
  padding-right: 20px;
  justify-content: center;
  align-items: center;
}

.top-bar button.active {
  background-color: #ffffcc;
  color: #000;
  font-weight: bold;
  font-size: 14px;
}

.btn-icon-normal {
  height: 1.5rem;
  width: 1.5rem;
  cursor: pointer;
  /* 添加flex布局确保图标居中 */
  display: flex;
  justify-content: center;
  align-items: center;
  /* 添加透明边框避免hover时布局跳动 */
  border: 1px solid #ccc;
  /* 圆角美化 */
  border-radius: 4px;
  /* 过渡动画使效果更平滑 */
  transition: all 0.2s ease;
}

.btn-icon-normal:hover {
  background-color: #ffffcc;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  /* 优化边框样式 */
  border: 1px solid #eee;
}

.btn-icon-normal .iconfont {
  font-size: 1.2rem;
  color: green;
}

.btn-icon-small {
  height: 1.2rem;
  width: 1.2rem;
  cursor: pointer;
  /* 添加flex布局确保图标居中 */
  display: flex;
  justify-content: center;
  align-items: center;
  /* 添加透明边框避免hover时布局跳动 */
  border: 1px solid #ccc;
  /* 圆角美化 */
  border-radius: 4px;
  /* 过渡动画使效果更平滑 */
  transition: all 0.2s ease;
}

.btn-icon-small:hover {
  background-color: #ffffcc;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  /* 优化边框样式 */
  border: 1px solid #eee;
}

.btn-icon-small .iconfont {
  font-size: 1rem;
  color: green;
}

.line-edit-wrapper {
  width: 100%;
  display: flex;
  flex-direction: row;
  flex: 1;
}

.preview-wrapper {
  width: 100%;
  display: flex;
  flex-direction: row;
  flex: 1;
  background-color: white !important;
  overflow: hidden; /* 防止容器本身滚动 */
}

.preview-content {
  padding: 20px;
  width: 100%;
  height: 100%;
  overflow-y: auto; /* 内容超出时显示垂直滚动条 */
  overflow-x: hidden; /* 禁止水平滚动 */
  margin-bottom: 10px;
  white-space: pre-wrap;
}
.preview-content p {
  margin-bottom: 16px; /* 设置段落间距 */
  line-height: 1.6; /* 设置行高 */
}
/* 添加斜体样式 */
.preview-content i {
  font-style: italic;
}

.preview-content u {
  text-decoration: underline;
}

.preview-content b {
  font-weight: bold;
}
.preview-content img {
  max-width: 80%;
  height: auto;
}

.left-bar-wrapper {
  background-color: #f0efe2;
  width: 50px;
  height: 100%;
  text-align: left;
  float: left;
}

.rigth-edit-wrapper {
  height: 100%;
  flex: 1;
}

.edit-area {
  border: 1px solid #eaeaea;
  outline: none;
  width: 100%;
  height: 100%;
  resize: none;
  line-height: 28px;
  font-size: 14px;
  float: left;
  padding: 0;
  color: black;
  font-family: inherit;
  box-sizing: border-box;
  padding-left: 5px;
  background-image: repeating-linear-gradient(#eee 0 1px, transparent 1px 28px);
  background-size: 100% 28px;
  background-attachment: local;
}

.rigth-edit-wrapper textarea {
  caret-color: #ff0000; /* 将光标颜色设置为红色，可以根据需要修改 */
  caret-width: 2px; /* 增加光标宽度，某些浏览器可能不支持 */
}
.rigth-edit-wrapper textarea:focus {
  outline: none; /* 移除默认的聚焦轮廓 */
  caret-color: #ff0000; /* 确保聚焦时光标颜色仍然明显 */
}

.bar-area {
  height: 100%;
  width: 100%;
  resize: none;
  outline: none;
  overflow-y: hidden;
  overflow-x: hidden;
  border: 0;
  background: rgb(247, 247, 247);
  color: #999;
  line-height: 30px;
  font-size: 14px;
  padding: 0 5px;
  text-align: right;
  font-weight: bold;
  box-sizing: border-box;
}

/* 优化查找替换浮动块样式 - 单行紧凑版 */
.search-float-panel {
  position: fixed;
  top: 100px;
  right: 20px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: 10px;
}

.replace-content {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 10px;
  flex-direction: row;
}

.search-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-title {
  font-weight: 600;
  color: #333;
  font-size: 13px;
  white-space: nowrap;
}
.search-float-panel i:hover {
  color: #409eff;
  cursor: pointer;
}

.search-input {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  width: 100px;
  height: 26px;
}

.search-input:focus {
  outline: none;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.search-controls {
  display: flex;
  flex-direction: row;
  gap: 5px;
}

.search-btn {
  padding: 2px 6px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.search-btn:hover {
  background-color: #e6f7ff;
  border-color: #409eff;
  color: #409eff;
}

.search-info {
  display: flex;
  align-items: center;
}

.match-count {
  font-size: 12px;
  color: #666;
  background-color: #f5f5f5;
  padding: 2px 6px;
  border-radius: 10px;
  font-family: monospace;
}

.search-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.search-close:hover {
  background-color: #f5f5f5;
  color: #333;
}

/* 移除原有的search-header和search-body样式 */
.search-header,
.search-body {
  display: none;
}
</style>
