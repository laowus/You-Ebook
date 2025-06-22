<script setup>
import { ref, onMounted, inject, toRaw } from "vue";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus";
import EventBus from "../common/EventBus";
import WindowCtr from "./WindowCtr.vue";
import { getChapters } from "../utils/funs.js";
import { open } from "../libs/parseBook.js";
import { parseFile, readTxtFile, getTextFromHTML } from "../common/utils";
import { useBookStore } from "../store/bookStore";
import { useAppStore } from "../store/appStore";
const { ipcRenderer } = window.require("electron");
const { curChapter, metaData, isFirst, toc } = storeToRefs(useBookStore());
const { setMetaData, setFirst } = useBookStore();
const { showHistoryView, showNewBook, showAbout } = useAppStore();

const curIndex = ref(1);
const indentNum = ref(2);
const changeTab = (index) => {
  curIndex.value = index;
};
// 正则表达式
const reg = {
  pre: ["", "第", "卷", "chapter"],
  aft: ["", "章", "回", "节", "集", "部", "篇", "部分"],
  selected: [1, 1],
};

const initDom = () => {
  $("#add-file").addEventListener("change", (e) => {
    // 检查用户是否选择了文件
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const newFile = parseFile(file);
      if (newFile.ext === "txt" || newFile.ext === "html") {
        let fileStr = "";
        readTxtFile(newFile.path).then((data) => {
          fileStr = newFile.ext === "html" ? getTextFromHTML(data) : data;
          if (isFirst.value) {
            const meta = {
              title: file.name.split(".")[0],
              author: "Unknown",
              description: "Unknown",
              cover: "",
            };
            ipcRenderer.once("db-insert-book-response", (event, data) => {
              if (data.success) {
                meta.bookId = data.bookId;
                setMetaData(meta);
                const chapter = {
                  bookId: metaData.value.bookId,
                  label: metaData.value.title,
                  href: `OPS/chapter-${Date.now()}`,
                  content: fileStr,
                };
                EventBus.emit("addChapter", { href: null, chapter: chapter });
                setFirst(false);
              } else {
                ElMessage.error("插入失败");
              }
            });
            ipcRenderer.send("db-insert-book", meta);
          } else {
            const chapter = {
              bookId: metaData.value.bookId,
              label: file.name.split(".")[0],
              href: `OPS/chapter-${Date.now()}`,
              content: fileStr,
            };
            EventBus.emit("addChapter", { href: null, chapter: chapter });
          }
        });
      } else if (newFile.ext === "epub" || newFile.ext === "mobi") {
        open(newFile.path).then((res) => {
          console.log(" 02 open", res);
        });
      }
    } else {
      console.log("用户未选择文件");
    }
  });
  $("#add-file-btn").addEventListener("click", () => $("#add-file").click());
};
onMounted(() => {
  initDom();
});
//删除空行
const deleteEmptyLines = () => {
  if (curChapter.value.content) {
    // 按换行符分割字符串
    const lines = curChapter.value.content.split("\n");
    // 过滤掉空行
    const nonEmptyLines = lines.filter((line) => line.trim() !== "");
    // 重新拼接字符串
    curChapter.value.content = nonEmptyLines.join("\n");
  }
};
// 缩进
const indentFirstLine = () => {
  if (curChapter.value.content) {
    const indentString = "    ".repeat(indentNum.value);
    console.log("空格", indentString, "空格");
    // 按换行符分割字符串
    const lines = curChapter.value.content
      .split("\n")
      .map((line) => line.trimStart());
    // 给每一行添加缩进
    const indentedLines = lines.map((line) => indentString + line);
    // 重新拼接字符串
    curChapter.value.content = indentedLines.join("\n");
  }
};

const regString = () => {
  const pre = $("#pre").value;
  const aft = $("#aft").value;
  let attach = $("#attach").value.trim();
  attach ? (attach = `|^\s*(${attach})`) : (attach = "");
  // 动态拼接正则表达式
  const regexPattern = `^\\s*([${pre}][一二三四五六七八九十0-9]+[${aft}]).*${attach}([^\\n]+)?$`;
  const chapterRegex = new RegExp(regexPattern, "gm");
  console.log(chapterRegex);

  // 分割字符串
  const tempChapter = {
    bookId: curChapter.value.bookId,
    href: curChapter.value.href,
    content: curChapter.value.label,
    label: curChapter.value.label,
  };
  const chapters = getChapters(
    curChapter.value.content,
    curChapter.value.title,
    chapterRegex
  );
  insertChapters(chapters, curChapter.value.id).then(
    ipcRenderer.send("db-update-chapter", tempChapter)
  );
};
const iCTip = (text) => {
  EventBus.emit("showTip", text);
};
const insertChapters = async (chapters, id) => {
  const insertSingleChapter = (chapterData) => {
    return new Promise((resolve, reject) => {
      const successListener = (res) => {
        resolve(res);
      };
      EventBus.on("addChapterRes", successListener);
      EventBus.emit("addChapter", {
        href: id,
        chapter: chapterData,
      });
    });
  };

  for (const [index, chap] of chapters.entries()) {
    const chapter = {
      bookId: metaData.value.bookId,
      label: chap.label,
      href: `OPS/chapter-${Date.now()}`,
      content: chap.content,
    };
    iCTip("导入" + chap.label + "中 ..." + (index + 1) + "/" + chapters.length);
    //await 等待章节插入完成
    await insertSingleChapter(chapter);
  }
  EventBus.emit("hideTip");
};

const exportEpub = async () => {
  ipcRenderer.once("export-epub-reply", (event, res) => {
    if (res.success) {
      ElMessage.success(`导出${metaData.value.title}成功!`);
    } else {
      ElMessage.error(res.message);
    }
  });
  ipcRenderer.send("export-epub", {
    chapters: toRaw(toc.value),
    metaData: toRaw(metaData.value),
  });
};

const exportTxt = async () => {
  ipcRenderer.once("export-txt-reply", (event, res) => {
    console.log(res);
    if (res.success) {
      ElMessage.success(`导出${metaData.value.title}成功!`);
    } else {
      ElMessage.error(res.message);
    }
  });
  ipcRenderer.send("export-txt", {
    chapters: toRaw(toc.value),
    metaData: toRaw(metaData.value),
  });
};
const exportHtml = async () => {
  ipcRenderer.once("export-html-reply", (event, res) => {
    console.log(res);
    if (res.success) {
      ElMessage.success(`导出${metaData.value.title}成功!`);
    } else {
      ElMessage.error(res.message);
    }
  });
  ipcRenderer.send("export-html", {
    chapters: toRaw(toc.value),
    metaData: toRaw(metaData.value),
  });
};

// 定义重启程序的函数
const restartApp = () => {
  if (confirm("确定要重启程序吗？")) {
    ipcRenderer.send("restart-app");
  }
};
</script>
<template>
  <div class="header">
    <div class="tabs">
      <div class="tabnames">
        <div
          class="tabname"
          @click="changeTab(0)"
          :class="{ active: curIndex === 0 }"
        >
          开始
        </div>
        <div
          class="tabname"
          @click="changeTab(1)"
          :class="{ active: curIndex === 1 }"
        >
          导入
        </div>
        <div
          class="tabname"
          @click="changeTab(2)"
          :class="{ active: curIndex === 2 }"
        >
          编辑
        </div>
        <div
          class="tabname"
          @click="changeTab(3)"
          :class="{ active: curIndex === 3 }"
        >
          工具
        </div>
        <div
          class="tabname"
          @click="changeTab(4)"
          :class="{ active: curIndex === 4 }"
        >
          发布
        </div>
        <div
          class="tabname"
          @click="changeTab(5)"
          :class="{ active: curIndex === 5 }"
        >
          帮助
        </div>
        <div class="drag-tab"></div>

        <WindowCtr />
      </div>
      <div class="tabcontent">
        <div v-show="curIndex === 0">
          <button class="btn-icon" @click="showNewBook">
            <span class="iconfont icon-xinjian" style="color: green"></span>
            <span>新建</span>
          </button>
        </div>
        <div v-show="curIndex === 1">
          <input
            type="file"
            id="add-file"
            hidden
            accept=".txt,.html,.epub,.mobi,.azw3"
          />
          <button class="btn-icon" id="add-file-btn">
            <span class="iconfont icon-Epub" style="color: green"></span>
            <span>导入文件</span>
          </button>
          <button class="btn-icon" @click="showHistoryView">
            <span class="iconfont icon-lishijilu" style="color: green"></span>
            <span>历史记录</span>
          </button>
          <button class="btn-icon" @click="restartApp">
            <span class="iconfont icon-zhongqi" style="color: red"></span>
            <span> 重 启 </span>
          </button>
        </div>
        <div v-show="curIndex === 2">
          <button
            class="btn-icon"
            @click="deleteEmptyLines"
            :disabled="!curChapter.bookId"
          >
            <span
              class="iconfont icon-shanchukonghang"
              style="color: red"
            ></span>
            <span>删除空行</span>
          </button>
          <select
            @change="indentNum = parseInt($event.target.value)"
            :value="indentNum"
          >
            <option v-for="index in [0, 1, 2, 3, 4, 5, 6]" :key="index">
              {{ index }}
            </option>
          </select>
          <button
            class="btn-icon"
            @click="indentFirstLine"
            :disabled="!curChapter.bookId"
          >
            <span
              class="iconfont icon-shouhangsuojin"
              style="color: green"
            ></span>
            <span>首行缩进</span>
          </button>
        </div>
        <div v-show="curIndex === 3">
          <div class="reg-string">
            <span>规则:</span>
            <select id="pre">
              <option
                v-for="(pr, index) in reg.pre"
                :selected="reg.selected[0] == index"
              >
                {{ pr }}
              </option>
            </select>
            <span>[数字]</span>
            <select id="aft">
              <option
                v-for="(af, index) in reg.aft"
                :selected="reg.selected[1] == index"
              >
                {{ af }}
              </option>
            </select>
            <span>特别:</span>
            <input
              id="attach"
              style="width: 150px; height: 20px; font-size: 12px"
              placeholder="多个用|分开"
            />
            <button
              class="btn-icon"
              @click="regString"
              :disabled="!curChapter.bookId"
            >
              <span class="iconfont icon-jianqie" style="color: green"></span>
              <span>开始分割</span>
            </button>
          </div>
        </div>
        <div v-show="curIndex === 4">
          <button
            class="btn-icon"
            @click="exportEpub"
            :disabled="!curChapter.bookId"
          >
            <span class="iconfont icon-daochuexl" style="color: green"></span>
            <span>生成epub</span>
          </button>
          <button
            class="btn-icon"
            @click="exportTxt"
            :disabled="!curChapter.bookId"
          >
            <span class="iconfont icon-daochutxt" style="color: green"></span>
            <span>生成txt</span>
          </button>
          <button
            class="btn-icon"
            @click="exportHtml"
            :disabled="!curChapter.bookId"
          >
            <span class="iconfont icon-HTML" style="color: green"></span>
            <span>生成Html</span>
          </button>
        </div>
        <div v-show="curIndex === 5">
          <button class="btn-icon" @click="showAbout">
            <span class="iconfont icon-daochuexl" style="color: green"></span>
            <span>关于</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.header {
  width: 100%;
  background-color: #f0f0f0;
  display: flex;
  flex-direction: row;
  border: 1px solid #add8e6;
  height: 100px;
}
.tabs {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.tabnames {
  width: 100%;
  display: flex;
  flex-direction: row;
  background-color: #87ceeb;
  padding-left: 10px;
  gap: 10px;
}

.tabname {
  font-size: 14px;
  width: 60px;
  height: 30px;
  align-items: center;
  justify-content: center;
  display: flex;
}
.tabname.active {
  background-color: white;
  border: 1px solid #87ceeb;
  /* 设置下边框颜色为白色 */
  border-bottom-color: white;
  border-radius: 10px 10px 0 0;
}

.drag-tab {
  flex: 1;
  user-select: none;
  -webkit-app-region: drag;
  -webkit-user-select: none;
}

.tabcontent div {
  padding-left: 5px;
  font-size: 12px;
  background-color: white;
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 10px;
  align-items: center;
  background-color: #add8e6;
}
.btn-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: transparent;
  transition: background-color 0.3s ease;
  margin: 10px;
  font-size: 12px;
}
.btn-icon-row {
  flex-direction: row;
  border: 1px solid #87ceeb;
  border-radius: 5px;
  padding: 5px;
  background-color: #add8e6;
}

.btn-icon .iconfont {
  font-size: 2rem;
}

.btn-icon:hover {
  background-color: #ffffcc;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
} /* 添加按钮禁用状态样式 */
.btn-icon:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  /* 降低透明度，让按钮看起来变灰 */
}

.btn-icon:disabled .iconfont {
  color: #ccc;
  /* 禁用状态下图标颜色变灰 */
}

.btn-icon:disabled:hover {
  background-color: transparent;
  /* 禁用状态下鼠标悬停不改变背景色 */
  box-shadow: none;
  /* 禁用状态下鼠标悬停不显示阴影 */
}
</style>
