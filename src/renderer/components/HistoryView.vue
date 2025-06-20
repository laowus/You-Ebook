<script setup>
import { ref, watch, reactive, onMounted } from "vue";
import { storeToRefs } from "pinia";
import EventBus from "../common/EventBus";
import { useAppStore } from "../store/appStore";
import { useBookStore } from "../store/bookStore";
const { historyViewShow } = storeToRefs(useAppStore());
const { hideHistoryView } = useAppStore();
const { setMetaData, setToc, setFirst } = useBookStore();
const { ipcRenderer } = window.require("electron");
const books = ref([]);
// 定义获取书籍数据的函数
const fetchBooks = () => {
  const booksData = ipcRenderer.sendSync("db-get-books");
  books.value = booksData.data;
};

onMounted(() => {
  fetchBooks();
});

// 监听 historyViewShow 的变化
watch(historyViewShow, (newValue) => {
  if (newValue) {
    // 当 historyViewShow 变为 true 时，刷新数据
    fetchBooks();
  }
});
const importBook = (index, row) => {
  console.log(index, row);
  const metaData = {
    bookId: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    cover: row.cover,
  };
  setMetaData(metaData);
  const toc = JSON.parse(row.toc);
  setToc(toc);
  setFirst(false);
  console.log("importBook", metaData, toc);
  const firstChapter = ipcRenderer.sendSync(
    "db-first-chapter",
    metaData.bookId
  );
  console.log("const open firstChapter", firstChapter.data);
  EventBus.emit("updateToc", firstChapter.data.id);
  hideHistoryView();
};

const delBook = (row) => {
  console.log(row);
  // 删除成功后刷新数据
  ipcRenderer.once("db-del-book-response", (event, response) => {
    if (response.success) {
      fetchBooks();
    }
  });
  ipcRenderer.send("db-del-book", row.id);
};
</script>
<template>
  <el-dialog v-model="historyViewShow" title="历史记录" width="80%">
    <el-table :data="books">
      <el-table-column property="id" label="id" width="50" />
      <el-table-column property="title" label="书名" width="150" />
      <el-table-column property="author" label="作者" width="100" />
      <el-table-column property="createTime" label="创建时间" width="100" />
      <el-table-column fixed="right" label="操作" min-width="200">
        <template #default="scope">
          <el-button
            type="primary"
            size="small"
            @click="importBook(scope.$index, scope.row)"
          >
            载入
          </el-button>
          <el-button type="danger" size="small" @click="delBook(scope.row)"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<style></style>
