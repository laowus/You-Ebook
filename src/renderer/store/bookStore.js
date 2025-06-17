import { defineStore } from "pinia";
import EventBus from "../common/EventBus";
const { ipcRenderer } = window.require("electron");
export const useBookStore = defineStore(
  "bookStore",
  {
    state: () => ({
      isFirst: true,
      metaData: null, //书籍信息
      toc: null, //目录
      curChapter: {
        bookId: 0,
        href: "",
        title: "",
        content: "",
      }, //当前编辑的章节
    }),
    getters: {},
    actions: {
      setFirst(isF) {
        this.isFirst = isF;
      },
      setMetaData(metaData) {
        this.metaData = metaData;
      },
      setToc(toc) {
        this.toc = toc;
      },
      clearToc() {
        this.toc = null;
      },
      delTocByHref(href) {
        console.log("delTocByHref", href);
        const removeItem = (items) => {
          for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item.href === href) {
              const preItem = items[i - 1];
              items.splice(i, 1);
              EventBus.emit("updateToc", preItem.href);
              return true;
            }
            if (item.subitems && item.subitems.length > 0) {
              if (removeItem(item.subitems)) {
                return true;
              }
            }
          }
          return false;
        };
        removeItem(this.toc);
      },
      // 插入数据库中 并更新目录以及当前章节
      addTocByHref(href, tocItem) {
        console.log("addTocByHref", href, tocItem);
        ipcRenderer.once("db-insert-chapter-response", (event, res) => {
          if (res.success) {
            const item = {
              label: tocItem.label,
              href: res.id,
              subitems: null,
            };
            if (href) {
              //获取要插入的父级元素
              const parentItem = this.findTocByHref(href);
              console.log("findTocByHref", parentItem);
              if (parentItem.subitems) {
                parentItem.subitems.push(item);
              } else {
                parentItem.subitems = [item];
              }
            } else {
              if (!this.toc) {
                this.toc = [];
              }
              this.toc.push(item);
            }
            // 发送更新目录事件
            EventBus.emit("updateToc", item.href);
          } else {
            console.error("插入章节数据失败:", res.message);
          }
        });
        ipcRenderer.send("db-insert-chapter", tocItem);
      },
      updateTocByHref(newItem) {
        const tocItem = this.findTocByHref(newItem.id);
        console.log("updateTocByHref", tocItem, newItem);
        if (tocItem) {
          tocItem.label = newItem.label;
          console.log("更新后toc", this.toc);
          EventBus.emit("updateToc", tocItem.href);
        }
      },
      findTocByHref(href) {
        const findItem = (href, items) => {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.href === href) {
              return item;
            }
            if (item.subitems && item.subitems.length > 0) {
              const result = findItem(href, item.subitems);
              if (result) {
                return result;
              }
            }
          }
        };
        return findItem(href, this.toc);
      },
      // 新增方法：让某个子对象升级
      upperToc(href) {
        const parent = this.findParentByHref(href);
        if (parent) {
          const items = parent.subitems;
          const index = items.findIndex((item) => item.href === href);
          if (index > -1) {
            const item = items.splice(index, 1)[0];
            // 找到父对象所在的层级
            const grandParent = this.findParentByHref(parent.href);
            if (grandParent) {
              const insertIndex = grandParent.subitems.indexOf(parent) + 1;
              grandParent.subitems.splice(insertIndex, 0, item);
            } else {
              // 如果父对象在顶级，直接添加到顶级数组
              this.toc.splice(this.toc.indexOf(parent) + 1, 0, item);
            }
            EventBus.emit("updateToc", item.href);
          }
        }
      },
      lowerToc(href) {
        const parent = this.findParentByHref(href);
        const items = parent ? parent.subitems : this.toc;
        const index = items.findIndex((item) => item.href === href);

        if (index > 0) {
          // 确保前面有兄弟对象
          const prevItem = items[index - 1];
          const item = items.splice(index, 1)[0];

          if (!prevItem.subitems) {
            prevItem.subitems = [];
          }
          prevItem.subitems.push(item);
          EventBus.emit("updateToc", item.href);
        }
      },
      // 新增方法：让某个子对象位置向上移动一个位置
      upToc(href) {
        const parent = this.findParentByHref(href);
        const items = parent ? parent.subitems : this.toc;
        const index = items.findIndex((item) => item.href === href);

        if (index > 0) {
          // 确保不是第一个元素
          // 交换当前元素和前一个元素的位置
          [items[index - 1], items[index]] = [items[index], items[index - 1]];
          EventBus.emit("updateToc", href);
        }
      },
      // 新增方法：让某个子对象位置向下移动一个位置
      downToc(href) {
        const parent = this.findParentByHref(href);
        const items = parent ? parent.subitems : this.toc;
        const index = items.findIndex((item) => item.href === href);

        // 确保不是最后一个元素
        if (index < items.length - 1) {
          // 交换当前元素和后一个元素的位置
          [items[index + 1], items[index]] = [items[index], items[index + 1]];
          EventBus.emit("updateToc", href);
        }
      },
      // 新增辅助方法：查找父对象
      findParentByHref(href) {
        const findParent = (items) => {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.subitems) {
              const found = item.subitems.find(
                (subItem) => subItem.href === href
              );
              if (found) {
                return item;
              }
              const nestedParent = findParent(item.subitems);
              if (nestedParent) {
                return nestedParent;
              }
            }
          }
          return null;
        };
        return findParent(this.toc);
      },
    },
  }
  // persist: {
  //   enabled: true,
  //   strategies: [
  //     {
  //       storage: localStorage,
  //       paths: ["metaData", "toc"],
  //     },
  //   ],
  // },
);
