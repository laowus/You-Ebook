<script setup>
import { ref, reactive } from "vue";
import { storeToRefs } from "pinia";
import { useAppStore } from "../store/appStore";
const { aboutShow } = storeToRefs(useAppStore());
const tindex = ref(0);
const tabs = ref(["软件介绍", "捐赠支持"]);
const tabContents = ref([
  `
  YouEbook 是一个基于 Vue3 + Electron 开发的跨平台电子书生成器，支持 macOS、Windows、Linux 等操作系统。(本人只有Windows系统电脑, 其他没有平台测试。)

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
        <div v-else class="content-item">
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
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
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
