import { defineStore } from 'pinia';

export const spintaxListStore = defineStore('spintaxList', {
  state: () => ({
    dataList: []
  }),
  actions: {
    // History of Valid Spintax Generation:
    addSpintax(text) {
        this.dataList.push({ 'userInput': text });
        console.log('updated Store: ', this.dataList)
    },
    clearSpintax() {
        console.log('updated Store - Invalid Spintax Removed: Before: ', this.dataList)
        this.dataList.pop();
        console.log('updated Store - Invalid Spintax Removed: ', this.dataList)
    }
  }
});