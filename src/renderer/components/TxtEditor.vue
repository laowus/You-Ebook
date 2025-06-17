<script setup>
import { ref, inject, watch, onMounted, toRaw } from "vue";
const { ipcRenderer } = window.require("electron");
import { storeToRefs } from "pinia";
import { useBookStore } from "../store/bookStore";
const { curChapter, metaData, toc } = storeToRefs(useBookStore());

const barValue = ref("1");
const suffix = ref("\n");
const editArea = ref(null);
const barArea = ref(null);

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
// 监听 value 变化

watch(
  curChapter,
  (val) => {
    queueMicrotask(() => {
      const textarea = editArea.value;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const scrollHeight = textarea.scrollHeight;
      const rows = Math.ceil(scrollHeight / lineHeight);
      line(rows);
      scrollRightWrapperToTop();
      if (val && Object.keys(val).length > 0) {
        try {
          ipcRenderer.sendSync("db-update-chapter", toRaw(val));
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
  background-image: repeating-linear-gradient(#eee 0 1px, transparent 1px 28px);
  background-size: 100% 28px;
  background-attachment: local;
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
