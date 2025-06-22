<script setup>
import { ref, watch, toRaw } from "vue";
import { storeToRefs } from "pinia";
import { useAppStore } from "../store/appStore";
import { useBookStore } from "../store/bookStore";
import { ElMessage } from "element-plus";
const { ipcRenderer, webUtils } = window.require("electron");
const { metaData } = storeToRefs(useBookStore());
const { editBookShow, editBookData } = storeToRefs(useAppStore());
const { hideEditBook, showHistoryView } = useAppStore();

const meta = ref({
  title: "",
  author: "",
  description: "",
  cover: "",
  bookId: 0,
});

// 监听 editBookData 的变化，更新 meta 数据
watch(editBookData, (newData) => {
  if (newData) {
    meta.value = { ...newData };
  }
});

// 监听 editBookShow 的变化，当窗口关闭时重置 meta
watch(editBookShow, (newValue) => {
  if (!newValue) {
    meta.value = {
      title: "",
      author: "",
      description: "",
      cover: "",
      bookId: 0,
    };
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

// 保存编辑后的书籍信息
const saveEditBook = () => {
  // 这里添加保存书籍信息的逻辑
  console.log("meta", meta.value);
  if (meta.value.title && meta.value.author) {
    ipcRenderer.send("db-update-book", toRaw(meta.value));
    ElMessage.success("书籍信息保存成功");
    if (meta.value.bookId === metaData.value.bookId) {
      metaData.value = meta.value;
    }
    hideEditBook();
    showHistoryView();
  } else {
    ElMessage.error("请输入完整的书籍信息");
  }
};
</script>
<template>
  <el-dialog v-model="editBookShow" title="'编辑书籍'" width="80%">
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
              <img
                v-else
                :src="meta.cover"
                style="max-width: 100%; max-height: 100%"
              />
            </div>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="hideEditBook">关闭</el-button>
        <el-button type="primary" @click="saveEditBook"> 保存 </el-button>
      </div>
    </template>
  </el-dialog>
</template>
<style></style>
