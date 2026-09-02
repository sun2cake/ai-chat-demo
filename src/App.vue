<script setup lang="ts">
import { ref } from 'vue'
import service from './request'
import type { MessageItem, SendMessage } from './types/index'

const inputText = ref('')
const loading = ref(false)
const messageList = ref<MessageItem[]>([])

const handleSend = async () => {
  const text = inputText.value.trim()
  if(!text || loading.value) return
  messageList.value.push({
    role: 'user',
    content: text
  })

  inputText.value = ''
  loading.value = true

  try {
    const res = await sendChat({
      inputs: {},
      query: text,
      user: 'user1'
    })
    messageList.value.push({
      role: 'ai',
      content: res.data.answer
    })
  } catch(err) {
    alert('请求出错，请稍后再试')
  } finally {
    loading.value = false
  }

}


  const sendChat = async (params: SendMessage) => {
    return await service.post('/chat-messages', params)
  }


</script>

<template>
  <div class="chat-wrap">
    <h2>AI-Chat Demo</h2>
  <div class="message-list">
    <div v-for="(item, index) in messageList"
    :key="index"
    :class="['message', item.role]"
    >{{ item.content }}
  </div>
  </div>

  <div class="input-area">
    <textarea
      v-model="inputText"
      placeholder="请输入问题"
      :disabled="loading"
      @keydown.enter.prevent="handleSend"
    ></textarea>
    <button @click="handleSend" :disabled="loading">
      {{ loading ? '发送中...' : '发送' }}
    </button>
  </div>
  </div>
</template>
