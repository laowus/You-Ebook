<script setup>
//TODO
</script>

<template>
  <div class="ntf">
    <div class="ntf-dialog-mask">
      <div class="ntf-dialog container">
        <div class="ntf-text">
          <slot name="text"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.ntf {
  position: fixed;
  left: 50%;
  top: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 202;
}

.ntf-dialog-mask {
  position: absolute;
  margin: auto;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0px 0px 6px #666;
}

.ntf-dialog {
  width: 265px;
  height: 50px;
  background: #ccc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ntf-text {
  font-size: 15px;
}

.ntf-text p {
  line-height: 36px;
}
</style>
