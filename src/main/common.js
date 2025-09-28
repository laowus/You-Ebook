const fs = require("fs");
// 修改为返回 Promise 的版本，确保目录创建完成后再继续
const ensureDirectoryExists = (dirPath) => {
  return new Promise((resolve, reject) => {
    fs.access(dirPath, fs.constants.F_OK, (err) => {
      if (err) {
        // 文件夹不存在，创建它
        fs.mkdir(dirPath, { recursive: true }, (mkdirErr) => {
          if (mkdirErr) {
            console.error("Error creating folder:", mkdirErr);
            reject(mkdirErr);
          } else {
            console.log("Folder created successfully:", dirPath);
            resolve();
          }
        });
      } else {
        // 文件夹存在
        console.log("Folder already exists:", dirPath);
        resolve();
      }
    });
  });
};

module.exports = {
  ensureDirectoryExists,
};
