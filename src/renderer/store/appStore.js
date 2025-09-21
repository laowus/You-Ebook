import { defineStore } from "pinia";

export const useAppStore = defineStore("appStore", {
  state: () => ({
    //通用上下文菜单
    ctxMenuShow: false,
    ctxMenuData: [],
    ctxItem: {},
    ctxMenuSeparatorNums: 0,
    currentHref: "",
    // 通用弹窗
    tipShow: false,
    tipText: null,
    editViewShow: false,
    historyViewShow: false,
    newBookShow: false,
    editBookShow: false,
    editBookData: null,
    aboutShow: null,
  }),
  getters: {},
  actions: {
    setCurrentHref(href) {
      this.currentHref = href;
    },
    showCtxMenu() {
      this.ctxMenuShow = true;
    },
    hideCtxMenu() {
      this.ctxMenuShow = false;
    },
    showEditView() {
      this.editViewShow = true;
    },
    hideEditView() {
      this.editViewShow = false;
    },
    showHistoryView() {
      this.historyViewShow = true;
    },
    hideHistoryView() {
      this.historyViewShow = false;
    },
    showNewBook() {
      this.newBookShow = true;
    },
    hideNewBook() {
      this.newBookShow = false;
    },
    showEditBook() {
      this.editBookShow = true;
    },
    hideEditBook() {
      this.editBookShow = false;
    },
    showAbout() {
      this.aboutShow = true;
    },
    hideAbout() {
      this.aboutShow = false;
    },
    setEditBookData(data) {
      // 添加设置要编辑的书籍数据的方法
      this.editBookData = data;
    },
    setCtxMenuData(data) {
      this.ctxMenuData.length = 0;
      if (data) {
        let spCnt = 0;
        data.forEach((item) => {
          this.ctxMenuData.push(item);
          if (item.separator) ++spCnt;
        });
        this.ctxMenuSeparatorNums = spCnt;
      }
    },
    showTip(text) {
      this.tipShow = true;
      this.tipText = text;
    },
    hideTip() {
      this.tipShow = false;
      this.tipText = null;
    },
  },
});
