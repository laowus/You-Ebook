<script setup>
import { ref, watch, toRaw } from "vue";
import { storeToRefs } from "pinia";
import { useAppStore } from "../store/appStore";
import { useBookStore } from "../store/bookStore";
import { ElMessage } from "element-plus";
const { ipcRenderer, webUtils } = window.require("electron");
const { metaData } = storeToRefs(useBookStore());
const { setMetaData } = useBookStore();
const { editBookShow, editBookData } = storeToRefs(useAppStore());
const { hideEditBook, showHistoryView } = useAppStore();

// 处理文件选择事件
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    const filePath = webUtils.getPathForFile(file);
    // 点击之后 直接更新封面图片
    ipcRenderer
      .invoke("set-cover", filePath, editBookData.value.bookId)
      .then((res) => {
        if (res.success) {
          //重新去获取封面图片
          const coverPath = ipcRenderer.sendSync(
            "get-cover-path",
            editBookData.value.bookId
          );
          editBookData.value.cover = `${coverPath}?t=${Date.now()}`;
          ElMessage.success("封面图片设置成功");
        } else {
          ElMessage.error("设置封面图片失败");
          return;
        }
      });
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
  if (editBookData.value.title && editBookData.value.author) {
    // 更新title author description 三个就可以了
    ipcRenderer.once("db-update-book-response", (event, res) => {
      if (res.success) {
        ElMessage.success("书籍信息保存成功");
        if (metaData.value) {
          setMetaData(editBookData.value);
        }
        hideEditBook();
        showHistoryView();
      } else {
        ElMessage.error("书籍信息保存失败");
      }
    });

    ipcRenderer.send("db-update-book", toRaw(editBookData.value));
  } else {
    ElMessage.error("请输入完整的书籍信息");
  }
};
</script>
<template>
  <el-dialog v-model="editBookShow" title="'编辑书籍'" width="80%">
    <el-form :model="editBookData" label-width="auto">
      <el-row>
        <el-col :span="11">
          <el-form-item label="书名:" prop="title" required>
            <el-input v-model="editBookData.title" />
          </el-form-item>
          <el-form-item label="作者:" prop="author" required>
            <el-input v-model="editBookData.author" />
          </el-form-item>
          <el-form-item label="简介:">
            <el-input
              v-model="editBookData.description"
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
              <span v-if="!editBookData.cover">
                双击插入封面图片(jpg, png)
              </span>
              <img
                v-else
                :src="editBookData.cover"
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
