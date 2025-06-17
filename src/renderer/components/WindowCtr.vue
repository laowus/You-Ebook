<script setup>
const { ipcRenderer } = window.require('electron');
const handleClose = () => {
    ipcRenderer.send('window-close');
}
const handleMax = () => {
    ipcRenderer.send('window-max');
}
const handleMix = () => {
    ipcRenderer.send('window-min');
}
</script>

<template>
    <div class="tool">
        <span class="iconfont icon-zuixiaohua" @click="handleMix"></span>
        <span class="iconfont icon-zuidahua_huaban1" @click="handleMax"></span>
        <span class="iconfont icon-guanbi" @click="handleClose"></span>
    </div>
</template>

<style>
.tool {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding-right: 20px;

}
</style>
