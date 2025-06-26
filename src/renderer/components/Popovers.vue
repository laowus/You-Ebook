<script setup>
import { reactive } from "vue";
import { storeToRefs } from "pinia";
import EventBus from "../common/EventBus";
import { useAppStore } from "../store/appStore";
import ContextMenu from "./ContextMenu.vue";
import Tip from "./Tip.vue";
import EditView from "./EditView.vue";
import HistoryView from "./HistoryView.vue";
import NewBook from "./NewBook.vue";
import EditBook from "./EditBook.vue";
import About from "./About.vue";
const { ipcRenderer } = window.require("electron");

const { ctxMenuShow, ctxMenuData, ctxMenuSeparatorNums, tipShow, tipText } =
  storeToRefs(useAppStore());
const { hideCtxMenu, showCtxMenu, showTip, hideTip } = useAppStore();

const ctxMenuPosStyle = reactive({ left: -999, top: -999 });
let ctxMenuPos = null;
const getCtxMenuAutoHeight = () => {
  const total = ctxMenuData.value.length || 1;
  const spNums = ctxMenuSeparatorNums.value;
  const itemHeight = 25,
    padding = 5;
  return itemHeight * (total - spNums) + 2.5 * spNums + 2 * padding;
};

const menuWidth = 208;
const adjustMenuPosition = (event) => {
  const { x, y, clientX, clientY } = event;
  const pos = { x, y };
  const { clientWidth, clientHeight } = document.documentElement;
  //const menuWidth = 179, menuHeight = 288, padding = 10
  const menuHeight = getCtxMenuAutoHeight(),
    padding = 10;
  const gapX = clientX + menuWidth - clientWidth;
  const tGapY = clientY - menuHeight;
  const bGapY = clientY + menuHeight - clientHeight;
  //右边界
  if (gapX > 0) {
    pos.x = pos.x - gapX - padding;
  }
  //TODO 菜单有可能溢出顶部边界
  if (bGapY > 0) {
    //溢出底部边界
    pos.y = pos.y - menuHeight + padding / 2;
  }
  return pos;
};

const setMenuPosition = (event) => {
  ctxMenuPos = adjustMenuPosition(event);
  ctxMenuPosStyle.left = ctxMenuPos.x + "px !important";
  ctxMenuPosStyle.top = ctxMenuPos.y + "px !important";
};

EventBus.on("commonCtxMenu-show", (event) => {
  hideCtxMenu(); //强制取消上次的显示
  setMenuPosition(event);
  showCtxMenu();
});

EventBus.on("showTip", (text) => {
  showTip(text);
});

EventBus.on("hideTip", (text = "完成!") => {
  showTip(text);
  hideTip();
});

ipcRenderer.on("showtip", (event, text) => {
  console.log("text", text);
  showTip(text);
});
ipcRenderer.on("hidetip", () => {
  showTip("完成!");
  hideTip();
});
</script>
<template>
  <div id="popovers">
    <HistoryView> </HistoryView>
    <EditView> </EditView>
    <NewBook> </NewBook>
    <EditBook></EditBook>
    <About></About>
    <ContextMenu
      v-show="ctxMenuShow"
      :posStyle="ctxMenuPosStyle"
      :data="ctxMenuData"
    >
    </ContextMenu>
    <Tip v-show="tipShow">
      <template #text>
        <p v-html="tipText"></p>
      </template>
    </Tip>
  </div>
</template>

<style></style>
