<script setup>
import { ref, inject, watch, onMounted, toRaw, computed } from "vue";
const { ipcRenderer } = window.require("electron");
import { storeToRefs } from "pinia";
import { useBookStore } from "../store/bookStore";
const { curChapter, metaData, toc } = storeToRefs(useBookStore());

const barValue = ref("1");
const suffix = ref("\n");
const editArea = ref(null);
const barArea = ref(null);

const curTabIndex = ref(0);

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
    console.log("滚动到顶部");
    editArea.value.scrollTop = 0;
  }
};

watch(
  curChapter,
  (val) => {
    queueMicrotask(() => {
      const textarea = editArea.value;
      console.log("textarea", textarea);
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

watch(
  () => curChapter.value?.title,
  (newTitle, oldTitle) => {
    scrollRightWrapperToTop();
  },
  { immediate: true, deep: true } // 设置 immediate: true 会在组件初始化时立即执行一次
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
    .join("\n");
  console.log("formattedContent", curStr);

  return curStr;
});

// 添加斜体格式化功能
const formatTag = (tag) => {
  if (!editArea.value) return;

  const textarea = editArea.value;
  const { selectionStart, selectionEnd, value } = textarea;

  // 获取选中的文本
  const selectedText = value.substring(selectionStart, selectionEnd);
  console.log("selectedText", selectedText);
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
      <button class="btn-icon-small" title="斜体" @click="formatTag('i')">
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
  line-height: 30px;
  font-size: 16px;
  float: left;
  padding: 0;
  color: black;
  font-family: inherit;
  box-sizing: border-box;
  padding-left: 5px;
  background-image: repeating-linear-gradient(#eee 0 1px, transparent 1px 30px);

  background-size: 100% 30px;
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
</style>
