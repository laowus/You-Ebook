<script setup>
import { ref, reactive, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useAppStore } from "../store/appStore";
const { ipcRenderer } = window.require("electron");
const { aboutShow } = storeToRefs(useAppStore());
const tindex = ref(0);
const dataDir = ref("");
const tabs = ref(["软件介绍", "捐赠支持", "备份/恢复"]);
const tabContents = ref([
  `
  YouEbook（捡书） 是一个基于 Vue3 + Electron 开发的跨平台电子书编辑器，支持 macOS、Windows、Linux 等操作系统。(本人只有Windows系统电脑, 其他没有平台测试。)

  功能：
      1、导入txt，epub，html，mobi等文件，进行编辑，然后导出生成epub/txt/html文件。
      2、导入的文本可以分割章节，前提是你的文本已经有章节的字符，譬如（第一章 ...  第二章 ...)这种文字,
         点击分割按钮就会进行分割成多段文字。
      3、可以对导入的文字进行简单编辑，譬如消除空行，段落首行缩进。

  开源地址：https://github.com/laowus/You-Ebook
  如有问题可以以下方式进行联系：
      邮箱：pjhxl@qq.com 
      Q Q：37156760
      QQ群：616712461
  `,
  `如果您喜欢
  YouEbook，请考虑通过捐赠来支持该项目。您的捐赠将帮助我维护和改进这个项目。`,
]);

// 切换标签的函数
const changeTab = (index) => {
  tindex.value = index;
};

onMounted(() => {
  loadDataDir();
});

const loadDataDir = () => {
  dataDir.value = ipcRenderer.sendSync("get-data-dir");
};

const openDataDir = () => {
  ipcRenderer.send("open-data-dir", dataDir.value);
};

// 在script部分末尾添加以下方法
const backupData = () => {
  ipcRenderer.send("backup-data", dataDir.value);
  // 可以添加提示信息
  alert("备份操作已开始，请等待完成提示！");
};

const restoreData = () => {
  // 先确认是否覆盖现有数据
  if (confirm("恢复数据将覆盖现有数据，确定要继续吗？")) {
    ipcRenderer.send("restore-data", dataDir.value);
    alert("恢复操作已开始，请等待完成提示！");
  }
};

// 监听备份和恢复完成的消息
ipcRenderer.on("backup-complete", (event, message) => {
  alert(message || "备份完成！");
});

ipcRenderer.on("restore-complete", (event, message) => {
  alert(message || "恢复完成！");
});

ipcRenderer.on("operation-error", (event, error) => {
  alert("操作失败：" + error);
});
</script>
<template>
  <el-dialog v-model="aboutShow" title="关于" width="70%">
    <div class="about-container">
      <!-- 标签导航 -->
      <div class="tab-nav">
        <div
          v-for="(tab, index) in tabs"
          :key="index"
          class="tab-item"
          :class="{ active: tindex === index }"
          @click="changeTab(index)"
        >
          {{ tab }}
        </div>
      </div>
      <!-- 动态显示内容 -->
      <div class="tab-content">
        <div v-if="tindex === 0" class="content-item">
          <!-- 使用 v-html 渲染替换后的内容 -->
          <div v-html="tabContents[0].replace(/\n/g, '<br>')"></div>
        </div>
        <div v-else-if="tindex === 1" class="content-item">
          {{ tabContents[1] }}
          <div class="payment-methods">
            <div class="payment-item">
              <img src="../assets/images/weichat.jpg" width="200" />
              <p>微信支付</p>
            </div>
            <div class="payment-item">
              <img src="../assets/images/alipay.jpg" width="200" />
              <p>支付宝支付</p>
            </div>
          </div>
        </div>
        <div v-else-if="tindex === 2" class="content-item">
          <div class="backup-restore">
            <div class="data-top">
              <h2>备份/恢复功能：</h2>
              <p>
                您可以使用备份/恢复功能来备份您的书籍数据，以及在需要时恢复备份。这对于保护您的书籍数据免受意外删除或损坏非常重要。
              </p>
            </div>
            <div class="data-content">
              <h2>数据保存位置：</h2>
              <p>
                {{ dataDir }}
                <el-button type="primary" @click="openDataDir">
                  打开
                </el-button>
              </p>
              <h2>备份/恢复操作：</h2>
              <p>
                1、备份：点击备份按钮，会在数据保存位置创建一个备份文件夹，备份文件夹中包含了所有的书籍数据。
                2、恢复：如果您需要恢复备份的数据，点击恢复按钮，会在数据保存位置打开备份文件夹，您可以选择要恢复的备份文件进行恢复。
              </p>
              <div class="backup-restore-buttons" style="margin-top: 20px">
                <el-button
                  type="primary"
                  @click="backupData"
                  style="margin-right: 10px"
                >
                  备份数据
                </el-button>
                <el-button type="primary" @click="restoreData">
                  恢复数据
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.backup-restore {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.about-container {
  padding: 20px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.tab-nav {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.tab-item {
  padding: 12px 20px;
  cursor: pointer;
  font-size: 16px;
  color: #666666;
  transition: color 0.3s ease;
}

.tab-item.active {
  color: #409eff;
  border-bottom: 2px solid #409eff;
}

.tab-content {
  padding: 10px;
}

.content-item {
  font-size: 14px;
  color: #333333;
  line-height: 1.6;
}

.payment-methods {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 20px;
}

.payment-item {
  text-align: center;
}

.payment-item img {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.payment-item img:hover {
  transform: scale(1.05);
}

.payment-item p {
  margin-top: 10px;
  font-size: 14px;
  color: #666666;
}
</style>
