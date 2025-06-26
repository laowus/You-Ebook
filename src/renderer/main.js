import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import "./assets/styles/reset.css";
import "./assets/styles/global.css";
import "./assets/styles/iconfont/iconfont.css";
import { createPinia } from "pinia";
import piniaPersist from "pinia-plugin-persist";
//状态管理
const pinia = createPinia();
pinia.use(piniaPersist);

window.$ = document.querySelector.bind(document);
const app = createApp(App);

//应用：配置全局异常处理器
app.config.errorHandler = (err, vm, info) => {
  // 处理错误
  // `info` 是 Vue 特定的错误信息，比如错误所在的生命周期钩子
  //暂时仅需捕获，以免程序崩溃，其他不用特别处理
  console.log(err, vm, info);
};

app.use(pinia).use(ElementPlus);
app.mount("#app");
