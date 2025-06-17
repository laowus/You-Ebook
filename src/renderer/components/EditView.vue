<script setup>
const { ipcRenderer } = window.require("electron");
import { ref, watch, reactive, onMounted, toRaw } from "vue";
import { storeToRefs } from "pinia";
import { useAppStore } from "../store/appStore";
import { useBookStore } from "../store/bookStore";
const { curChapter } = storeToRefs(useBookStore());
const { updateTocByHref } = useBookStore();
const { showEditView, hideEditView } = useAppStore();
const { editViewShow } = storeToRefs(useAppStore());
// 创建一个新的响应式变量
const newLabel = ref(curChapter.value.label);
const updateLabel = () => {
  console.log("updateChapter", curChapter.value);
  //数据库修改 toc修改
  curChapter.value.label = newLabel.value;
  ipcRenderer.send("db-update-chapter", toRaw(curChapter.value));
  updateTocByHref(curChapter.value);
  hideEditView();
};
watch(curChapter, (newVal, oldVal) => {
  newLabel.value = newVal.label;
});
</script>
<template>
  <el-dialog v-model="editViewShow" title="修改标题" width="400">
    <el-form>
      <el-form-item label="标题名">
        <el-input v-model="newLabel" /> </el-form-item
    ></el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="hideEditView">关闭</el-button>
        <el-button type="primary" @click="updateLabel"> 修改 </el-button>
      </div>
    </template>
  </el-dialog>
</template>
<style></style>
