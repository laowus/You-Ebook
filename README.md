# <div align='center'><img src="https://github.com/laowus/You-Ebook/blob/main/public/icon.png" width="100" height="100"><br/>捡书 You Ebook</div>

一款基于 Electron + Vue 3 开发的电子书编辑器。

你可以导入一些电子书，合并删除其中的内容，然后生成导出。

支持导入格式: EPUB、MOBI、TXT、HTML、AZW3、FB2、

导出格式：EPUB、TXT、HTML

### 联系:

有兴趣可以加入
QQ 群：616712461 (备注：You Ebook)
或者本人
QQ:37156760 (备注：You Ebook)
交流共同进步

### TODO

-v 0.0.2

- [x] 1、 输出 HTML 空格转义。
- [x] 2、 目录标题拉动，进行位置的更改。

-v 0.0.3

- [x] 1、 批量编辑，删空行，缩进。
- [x] 2、 优化正则分割章节

### 开发/测试环境

- Windows 10( 个人电脑只有 Windows 系统的,linux 苹果系统没有测试)
- IDE：[Visual Studio Code](https://code.visualstudio.com/)
- [Nodejs](https://nodejs.org/)：v20.18.0(只是我电脑上的版本,其他版本可能也没关系)
- 其他：详见 [package.json](package.json)

### 功能特性

- 支持导入文件格式：EPUB、TXT、HTML、MOBI （导入前确认下导入文件是否为标准格式）
- 支持导出文件格式：EPUB、TXT、HTML
- 两种书籍生成方式。
  - 1、新建书籍：
    - 输入书籍名字和作者，简介，还有封面。
    - 如果是当前有正在编辑的书籍，则会覆盖当前的书籍（书籍不会被删除，可以在历史记录里面）
  - 2、导入书籍。
    - 导入前如果没有在编辑的书籍状态，则默认为当前导入的书籍为书籍信息。譬如导入的是 epub 文件，就会获取当前 epub 文件的名字和作者、封面作为当前的书籍信息。
    - （默认如果当前是书籍编辑状态，导入则为增加到当前书籍中的内容。如果想重新新建一个书籍，请重启软件恢复空状态，或者新建一本书。）

### 预览图

![Github snap 1.png](https://github.com/laowus/You-Ebook/blob/main/snapshot/01.jpg)
![Github snap 2.png](https://github.com/laowus/You-Ebook/blob/main/snapshot/02.jpg)
![Github snap 3.png](https://github.com/laowus/You-Ebook/blob/main/snapshot/03.jpg)
![Github snap 4.png](https://github.com/laowus/You-Ebook/blob/main/snapshot/04.jpg)
![Github snap 5.png](https://github.com/laowus/You-Ebook/blob/main/snapshot/05.jpg)

### For 开发者- 请先下载安装最新版（或最新 LTS 版本） [Nodejs](https://nodejs.org/)

- <b>如有问题，建议先查看文档</b>：[FAQ.md](FAQ.md)
- <b>安装依赖</b>
  `npm install`
- <b>开发模式运行</b>
  `npm run dev`
- <b>构建打包</b>
  `npm run dist`
  或者，分步执行
  `npm run build`
  `npm run pack`
- <b>更新依赖</b>
  `npm update`
