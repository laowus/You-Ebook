<script setup>
import { ref, inject, watch, onMounted, toRaw, computed } from "vue";
const { ipcRenderer } = window.require("electron");
import { storeToRefs } from "pinia";
import { useBookStore } from "../store/bookStore";
const { curChapter } = storeToRefs(useBookStore());

const barValue = ref("1");
const suffix = ref("\n");
const editArea = ref(null);
const barArea = ref(null);
const currentLine = ref(0); // 当前光标所在行

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
  console.log("视觉行号:", visualLineNumber);
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
};

watch(
  curChapter,
  (val) => {
    console.log("curChapter", val);
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
</script>

<template>
  <div class="line-edit-wrapper">
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
</template>

<style>
.line-edit-wrapper {
  width: 60%;
  display: flex;
  flex-direction: row;
  flex: 1;
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
