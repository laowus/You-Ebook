<script setup>
//TODO
</script>

<template>
  <div class="ntf">
    <div class="ntf-text">
      <slot name="text"></slot>
    </div>
  </div>
</template>

<style>
.ntf {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%); /* 精准居中 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 202;
  border-radius: 16px; /* 增大圆角 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* 优化阴影 */
  background: #ffffff; /* 白色背景 */
  padding: 16px 24px; /* 增加内边距 */
  transition: all 0.3s ease; /* 添加过渡效果 */
}

.ntf-text {
  font-size: 16px; /* 增大字体 */
  color: #333333; /* 深色文字 */
  text-align: center; /* 文字居中 */
  line-height: 1.5; /* 合适的行高 */
}
</style>
