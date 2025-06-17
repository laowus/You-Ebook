<script setup>
import { ref, toRaw, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAppStore } from "../store/appStore";
import { useBookStore } from "../store/bookStore";
import { ElMessage } from "element-plus";
import EventBus from "../common/EventBus";
const { ipcRenderer, webUtils } = window.require("electron");
const path = window.require("path");
const fs = window.require("fs");

const { hideNewBook } = useAppStore();
const { newBookShow } = storeToRefs(useAppStore());
const { setMetaData, setFirst, clearToc } = useBookStore();

// 定义初始的 meta 数据
const initialMeta = {
  title: "",
  author: "",
  description: "",
  cover: "",
  bookId: 0,
};

const meta = ref({ ...initialMeta });

// 监听 newBookShow 的变化，当窗口显示时重置 meta
watch(newBookShow, (newValue) => {
  if (newValue) {
    meta.value = { ...initialMeta };
  }
});
// 处理文件选择事件
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    const filePath = webUtils.getPathForFile(file);
    meta.value.cover = filePath;
    console.log("meta", meta.value);
  }
};

// 双击插入封面图片
const handleDoubleClick = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg, image/png";
  input.addEventListener("change", handleFileChange);
  input.click();
};

const addBook = () => {
  if (meta.value.title && meta.value.author) {
    if (meta.value.cover) {
      //获取保存文件夹
      const coverDir = ipcRenderer.sendSync("get-cover-dir", "ping");
      const timestamp = Date.now();
      const coverPath = path.join(coverDir, timestamp + ".jpg");
      // 复制封面文件
      fs.copyFile(meta.value.cover, coverPath, (err) => {
        if (err) {
          console.error("封面文件复制失败:", err);
          ElMessage.error("封面文件复制失败");
        } else {
          console.log("封面文件复制成功", coverPath);
          meta.value.cover = coverPath;
        }
        ipcRenderer.send("db-insert-book", toRaw(meta.value));
      });
    } else {
      ipcRenderer.send("db-insert-book", toRaw(meta.value));
    }
    // 调用主进程的 addBook 方法
    ipcRenderer.once("db-insert-book-response", (event, data) => {
      console.log("metaData", meta);
      if (data.success) {
        meta.value.bookId = data.bookId;
        setMetaData(meta.value);
        const chapter = {
          bookId: meta.value.bookId,
          label: meta.value.title,
          href: `OPS/chapter-${Date.now()}`,
          content: "这是一段提示文字",
        };
        clearToc();
        EventBus.emit("addChapter", { href: null, chapter: chapter });
        setFirst(false);
        hideNewBook();
      }
    });

    hideNewBook();
  } else {
    ElMessage.error("请输入完整的书籍信息");
  }
};
</script>
<template>
  <el-dialog v-model="newBookShow" title="新建书籍" width="80%">
    <el-form :model="meta" label-width="auto">
      <el-row>
        <el-col :span="11">
          <el-form-item label="书名:" prop="title" required>
            <el-input v-model="meta.title" />
          </el-form-item>
          <el-form-item label="作者:" prop="author" required>
            <el-input v-model="meta.author" />
          </el-form-item>
          <el-form-item label="简介:">
            <el-input
              v-model="meta.description"
              style="width: 100%"
              :rows="6"
              type="textarea"
              placeholder="请输入书籍的介绍等信息"
            />
          </el-form-item>
        </el-col>
        <el-col :span="2"></el-col>
        <el-col :span="10">
          <el-form-item label="封面:" label-position="top" prop="cover">
            <div class="bordered-form-item" @dblclick="handleDoubleClick">
              <span v-if="!meta.cover"> 双击插入封面图片(jpg, png) </span>
              <el-image
                v-else
                :src="meta.cover"
                fit="contain"
                style="max-width: 100%; max-height: 100%"
              />
            </div>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="hideNewBook">关闭</el-button>
        <el-button type="primary" @click="addBook"> 确定 </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style>
/* 定义边框样式 */
.bordered-form-item {
  border: 1px solid #dcdfe6; /* 设置边框宽度、样式和颜色 */
  border-radius: 4px; /* 设置边框圆角 */
  padding: 5px; /* 设置内边距 */
  width: 220px;
  height: 200px;
  /* 添加 flex 布局样式 */
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
  overflow: hidden; /* 确保超出容器的内容被隐藏 */
}
</style>
