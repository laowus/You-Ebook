<script setup>
import { ref, inject, watch, onMounted, toRaw, computed } from "vue";
const { ipcRenderer } = window.require("electron");
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { useBookStore } from "../store/bookStore";
const { curChapter } = storeToRefs(useBookStore());

const barValue = ref("1");
const suffix = ref("\n");
const editArea = ref(null);
const barArea = ref(null);
const currentLine = ref(0); // 当前光标所在行

const curTabIndex = ref(0);

// 添加选中状态跟踪变量
const isTextSelected = ref(false);

// 添加斜体格式化功能
const formatTag = (tag) => {
  if (!editArea.value || !isTextSelected.value) return;

  const textarea = editArea.value;
  const { selectionStart, selectionEnd, value } = textarea;

  // 获取选中的文本
  const selectedText = value.substring(selectionStart, selectionEnd);
  consolelog("selectedText", selectedText);
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

  // 恢复光标位置（考虑添加的标记长度）
  queueMicrotask(() => {
    textarea.focus();
    textarea.setSelectionRange(
      selectionStart,
      selectionEnd + 2 // 加上两个星号的长度
    );
  });
};

// 计算当前行的背景渐变
const highlightBackground = computed(() => {
  if (!editArea.value) return "";

  const lineHeight = 28; // 与CSS中的line-height保持一致
  const currentLinePos = (currentLine.value - 1) * lineHeight;

  // 获取文本区域的实际滚动高度
  const scrollHeight = editArea.value.scrollHeight;
  // 创建黄色高亮的渐变
  return `repeating-linear-gradient(
    transparent 0px,
    transparent ${currentLinePos}px,
    yellow ${currentLinePos}px,
    yellow ${currentLinePos + lineHeight}px,
    transparent ${currentLinePos + lineHeight}px,
    transparent ${scrollHeight}px
  ), repeating-linear-gradient(#eee 0 1px, transparent 1px ${lineHeight}px)`;
});

const getVisualLineNumber = () => {
  if (!editArea.value) return 1;

  const textarea = editArea.value;
  const cursorPos = textarea.selectionStart;

  // 创建一个与textarea样式相同的临时div元素
  const temp = document.createElement("div");

  // 设置与textarea相同的样式，确保文本渲染效果一致
  temp.style.cssText = `
    position: absolute;
    top: -9999px;
    left: -9999px;
    font: inherit;
    font-size: ${getComputedStyle(textarea).fontSize};
    font-family: ${getComputedStyle(textarea).fontFamily};
    line-height: ${getComputedStyle(textarea).lineHeight};
    white-space: pre-wrap;
    word-wrap: break-word;
    width: ${textarea.clientWidth}px;
    padding: ${getComputedStyle(textarea).padding};
    margin: ${getComputedStyle(textarea).margin};
    border: ${getComputedStyle(textarea).border};
    box-sizing: ${getComputedStyle(textarea).boxSizing};
  `;

  // 填充文本直到光标位置
  temp.textContent = textarea.value.substring(0, cursorPos);

  // 将临时元素添加到文档中以计算高度
  document.body.appendChild(temp);

  // 获取行高和临时元素高度，计算视觉行数
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
  const visualLineCount = Math.ceil(temp.clientHeight / lineHeight);

  // 移除临时元素
  document.body.removeChild(temp);

  return visualLineCount;
};

// 获取光标所在行
const getCurrentLine = () => {
  if (!editArea.value) return;

  const visualLineNumber = getVisualLineNumber();
  currentLine.value = visualLineNumber;
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
    handleSelectionChange();
  }
};
// 滚动到顶部的方法
const scrollRightWrapperToTop = () => {
  if (editArea.value) {
    editArea.value.scrollTop = 0;
  }
};
// 监听 value 变化
// 监听光标位置变化
const handleSelectionChange = () => {
  getCurrentLine();
  // 检查是否有文本被选中
  if (editArea.value) {
    const { selectionStart, selectionEnd } = editArea.value;
    isTextSelected.value = selectionStart !== selectionEnd;
  }
};

watch(
  curChapter,
  (val) => {
    queueMicrotask(() => {
      const textarea = editArea.value;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const scrollHeight = textarea.scrollHeight;
      const rows = Math.ceil(scrollHeight / lineHeight);
      line(rows);
      // scrollRightWrapperToTop();
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
    // 监听光标位置变化
    editArea.value.addEventListener("click", handleSelectionChange);
    editArea.value.addEventListener("keyup", handleSelectionChange);
    editArea.value.addEventListener("input", handleSelectionChange);

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
      handleSelectionChange();
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

  // 将内容按换行符分割，过滤掉空行，然后用<p>标签包裹
  // 替换图片路径 src="images\74823574491o4d.jpeg"
  // images 替换 imageDir
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
    .join("\n");
  console.log("formattedContent", curStr);

  return curStr;
});

const addImage = () => {
  if (!editArea.value) return;

  // 调用Electron对话框选择图片
  ipcRenderer
    .invoke("select-image", `${curChapter.value?.bookId}`)
    .then((imagePath) => {
      if (!imagePath) return; // 用户取消选择

      // 上传图片并获取URL（这里需要根据实际上传逻辑修改）
      // 假设上传成功后返回图片URL
      const imgUrl = imagePath;

      // 创建图片标签
      const imgTag = `<img src="images\${imgUrl}">`;

      const textarea = editArea.value;
      const { selectionStart, selectionEnd, value } = textarea;

      // 在光标位置插入图片标签
      const newContent =
        value.substring(0, selectionStart) +
        imgTag +
        value.substring(selectionEnd);

      // 更新内容
      curChapter.value.content = newContent;

      // 移动光标到图片标签后面
      queueMicrotask(() => {
        textarea.focus();
        textarea.setSelectionRange(
          selectionStart + imgTag.length,
          selectionStart + imgTag.length
        );
      });
    })
    .catch((err) => {
      console.error("图片选择失败:", err);
      ElMessage.error("图片选择失败");
    });
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
    <div class="edit-bar" v-if="curTabIndex === 0">
      <button class="btn-icon-small" title="添加图片" @click="addImage">
        <span class="iconfont icon-tianjiatupian"></span>
      </button>
      <button
        class="btn-icon-small"
        title="斜体"
        @click="formatTag('i')"
        :disabled="!isTextSelected"
      >
        <span class="iconfont icon-zitixieti"></span>
      </button>
      <button class="btn-icon-small" title="下划线" @click="formatTag('u')">
        <span class="iconfont icon-zitixiahuaxian"></span>
      </button>
      <button class="btn-icon-small" title="加粗" @click="formatTag('b')">
        <span class="iconfont icon-zitijiacu"></span>
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
          :style="{ backgroundImage: highlightBackground }"
        />
      </div>
    </div>
    <div class="preview-wrapper" v-if="curTabIndex === 1">
      <div class="preview-content">
        <div v-html="formattedContent"></div>
      </div>
    </div>
  </div>
</template>

<style>
.edit-bar {
  height: 28px;
  display: flex;
  flex-direction: row;
  background-color: white;
  /* 添加垂直居中对齐 */
  align-items: center;
  /* 设置内边距：上下5px，左边10px */
  padding: 5px 0 5px 20px;
  gap: 20px;
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

.btn-icon-small {
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
.btn-icon-small:hover {
  background-color: #ffffcc;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  /* 优化边框样式 */
  border: 1px solid #eee;
}

.btn-icon-small .iconfont {
  font-size: 1.2rem;
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
}
.preview-content p {
  margin-bottom: 16px; /* 设置段落间距 */
  line-height: 1.6; /* 设置行高 */
}
/* 添加斜体样式 */
.preview-content i {
  font-style: italic;
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
  /* background-size: 100% 28px; */
  background-attachment: local;
  transition: background-image 0.1s ease;
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
  line-height: 28px;
  font-size: 14px;
  padding: 0 5px;
  text-align: right;
  font-weight: bold;
  box-sizing: border-box;
}
</style>
