<script setup>
import EventBus from "../common/EventBus";
import { storeToRefs } from "pinia";
import { useAppStore } from "../store/appStore";
import { useBookStore } from "../store/bookStore";

const { currentHref } = storeToRefs(useAppStore());
const { setCtxMenuData, hideCtxMenu, showEditView, hideEditView } =
  useAppStore();
const { delTocByHref, upperToc, lowerToc, upToc, downToc } = useBookStore();
const { metaData, curChapter } = storeToRefs(useBookStore());

const props = defineProps({
  posStyle: Object,
  data: Array,
});

let currentDataType = -1;
const MenuItems = {
  sp: {
    separator: true,
  },
  addTop: {
    name: "新建最顶级章节",
    icon: "icon-xinjian",
    action: () => {
      EventBus.emit("addChapter", {
        href: null,
        chapter: {
          bookId: metaData?.value.bookId,
          label: "新章节",
          href: `OPS/chapter-${Date.now()}`,
          content: "这里输入内容(只为了提示你输入内容,删除修改为你要的内容)",
        },
      });
      hideCtxMenu();
    },
  },
  addSon: {
    name: "新建下级章节",
    icon: "icon-xinjian",
    action: () => {
      console.log("addSon", curChapter.value.id);
      EventBus.emit("addChapter", {
        href: curChapter.value.id,
        chapter: {
          bookId: metaData?.value.bookId,
          label: "新章节",
          href: `OPS/chapter-${Date.now()}`,
          content: "这里输入内容(只为了提示你输入内容,删除修改为你要的内容)",
        },
      });
      hideCtxMenu();
    },
  },
  update: {
    name: "修改",
    icon: "icon-xiugai",
    action: () => {
      console.log("Context - Menu - update", curChapter.value.label);
      showEditView();
      hideCtxMenu();
    },
  },
  delete: {
    name: "删除",
    icon: "icon-guanbi",
    action: () => {
      console.log("delete", curChapter.value.id);
      if (curChapter.value.id) {
        delTocByHref(curChapter.value.id);
      }
      hideCtxMenu();
    },
  },
  up: {
    name: "上移",
    icon: "icon-shangyi",
    action: () => {
      upToc(curChapter.value.id);
      hideCtxMenu();
    },
  },
  down: {
    name: "下移",
    icon: "icon-xiayi",
    action: () => {
      downToc(curChapter.value.id);
      hideCtxMenu();
    },
  },
  upper: {
    name: "上一级",
    icon: "icon-shangyiji",
    action: () => {
      upperToc(curChapter.value.id);
      hideCtxMenu();
    },
  },
  lower: {
    name: "下一级",
    icon: "icon-xiayiji",
    action: () => {
      lowerToc(curChapter.value.id);
      hideCtxMenu();
    },
  },
};

EventBus.on("commonCtxMenu-init", (dataType) => {
  currentDataType = dataType;
  let data = [];
  switch (dataType) {
    case 0: //
      data = [
        MenuItems.addTop,
        MenuItems.sp,
        MenuItems.addSon,
        MenuItems.sp,
        MenuItems.up,
        MenuItems.sp,
        MenuItems.down,
        MenuItems.sp,
        MenuItems.upper,
        MenuItems.sp,
        MenuItems.lower,
        MenuItems.sp,
        MenuItems.update,
        MenuItems.sp,
        MenuItems.delete,
      ];
      break;
  }
  doInit(data);
});

const doInit = (data) => {
  setCtxMenuData(data);
};
</script>
<template>
  <div class="ctx-menu" :style="posStyle" @click.stop="">
    <div class="ccontainer">
      <div class="padding"></div>
      <div class="center">
        <template v-for="(item, index) in data">
          <div class="menuItem" v-show="!item.separator" @click="item.action">
            <span class="iconfont" :class="item.icon"> </span>
            <span>{{ item.name }}</span>
          </div>
          <div class="separator" v-show="item.separator && false"></div>
        </template>
      </div>
      <div class="padding"></div>
    </div>
  </div>
</template>

<style>
.ctx-menu {
  position: absolute;
  z-index: 101;
  display: flex;
  box-shadow: 0px 0px 6px #999999;
  max-height: 386px;
  border-radius: 8px;
}

.ctx-menu .ccontainer {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: white;
}

.ctx-menu .padding {
  height: 5px;
}

.ctx-menu .center {
  overflow: auto;
}

.ctx-menu .menuItem {
  width: 100px;
  display: flex;
  flex-direction: row;
  align-items: center;
  font-size: 12px;
  padding: 5px 6px;
  height: 20px;
  gap: 5px;
}

.ctx-menu .menuItem:hover {
  background-color: green;
  color: black;
}

.ctx-menu .menuItem:hover svg {
  fill: green;
}

.ctx-menu .menuItem > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ctx-menu .menuItem svg {
  margin-right: 15px;
  fill: green;
}

.ctx-menu .menuItem span {
  overflow: hidden;
  word-wrap: break-all;
  white-space: pre-wrap;
  line-break: anywhere;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  text-align: left;
}

.ctx-menu .separator {
  margin: 3px 15px;
  height: 0px;
  border-bottom: 0.36px solid;
}
</style>
