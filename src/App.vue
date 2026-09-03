<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { renderMarkdown } from './utils/markdown'
import { streamChat } from './utils/streamChat'
import type { ConversationItem, MessageItem } from './types/index'

const CONVERSATIONS_KEY = 'ai-workbench-conversations'
const ACTIVE_CONVERSATION_KEY = 'ai-workbench-active-conversation'

const createConversation = (): ConversationItem => ({
  id: crypto.randomUUID(),
  title: '新对话',
  messages: [],
  updatedAt: Date.now()
})

const loadConversations = (): ConversationItem[] => {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const conversations = ref<ConversationItem[]>(loadConversations())
if(conversations.value.length === 0) {
  conversations.value.push(createConversation())
}

const storedActiveId = localStorage.getItem(ACTIVE_CONVERSATION_KEY)
const activeConversationId = ref(
  conversations.value.some(item => item.id === storedActiveId)
    ? storedActiveId as string
    : conversations.value[0].id
)
const inputText = ref('')
const loading = ref(false)
const sidebarOpen = ref(false)
const conversationScroll = ref<HTMLElement | null>(null)
const promptInput = ref<HTMLTextAreaElement | null>(null)

const activeConversation = computed(() =>
  conversations.value.find(item => item.id === activeConversationId.value)
)
const messageList = computed(() => activeConversation.value?.messages || [])

const persistConversations = () => {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations.value))
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId.value)
}

const scrollToBottom = async () => {
  await nextTick()
  if(conversationScroll.value) {
    conversationScroll.value.scrollTop = conversationScroll.value.scrollHeight
  }
}

const focusPrompt = async () => {
  await nextTick()
  promptInput.value?.focus()
}

const handleNewConversation = () => {
  if(loading.value) return

  const emptyConversation = conversations.value.find(item => item.messages.length === 0)
  if(emptyConversation) {
    activeConversationId.value = emptyConversation.id
  } else {
    const conversation = createConversation()
    conversations.value.unshift(conversation)
    activeConversationId.value = conversation.id
  }

  sidebarOpen.value = false
  persistConversations()
  focusPrompt()
}

const handleSelectConversation = (id: string) => {
  if(loading.value) return
  activeConversationId.value = id
  sidebarOpen.value = false
  persistConversations()
  scrollToBottom()
}

const handleSend = async () => {
  const text = inputText.value.trim()
  const conversation = activeConversation.value
  if(!text || !conversation || loading.value) return

  conversation.messages.push({ role: 'user', content: text })
  if(conversation.messages.length === 1) {
    conversation.title = text.length > 18 ? `${text.slice(0, 18)}…` : text
  }

  const aiMessage = reactive<MessageItem>({ role: 'ai', content: '' })
  conversation.messages.push(aiMessage)
  conversation.updatedAt = Date.now()
  inputText.value = ''
  loading.value = true
  persistConversations()
  scrollToBottom()

  const controller = new AbortController()

  try {
    const conversationId = await streamChat(
      text,
      conversation.conversationId,
      (chunk) => {
        aiMessage.content += chunk
        scrollToBottom()
      },
      controller.signal
    )
    if(conversationId) {
      conversation.conversationId = conversationId
    }
  } catch(err) {
    aiMessage.content = err instanceof Error ? err.message : '请求出错，请稍后再试'
  } finally {
    loading.value = false
    conversation.updatedAt = Date.now()
    conversations.value.sort((a, b) => b.updatedAt - a.updatedAt)
    persistConversations()
    scrollToBottom()
  }
}
</script>

<template>
  <div class="workbench">
    <a class="skip-link" href="#conversation">跳到对话内容</a>

    <header class="topbar">
      <button
        class="sidebar-trigger"
        type="button"
        aria-label="打开会话列表"
        aria-controls="conversation-sidebar"
        :aria-expanded="sidebarOpen"
        @click="sidebarOpen = true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div class="brand-lockup" aria-label="初上连钩 AI 工作台">
        <span class="brand-name">初上连钩</span>
        <span class="brand-separator" aria-hidden="true"></span>
        <span class="product-name">AI 工作台</span>
      </div>

      <a class="return-link" href="https://chushang.party/">
        <span aria-hidden="true">←</span>
        返回个人站
      </a>
    </header>

    <div class="workbench-body">
      <button
        v-if="sidebarOpen"
        class="sidebar-backdrop"
        type="button"
        aria-label="关闭会话列表"
        @click="sidebarOpen = false"
      ></button>

      <aside
        id="conversation-sidebar"
        class="sidebar"
        :class="{ 'is-open': sidebarOpen }"
        aria-label="会话列表"
      >
        <button
          class="new-conversation"
          type="button"
          :disabled="loading"
          @click="handleNewConversation"
        >
          <span aria-hidden="true">＋</span>
          新建对话
        </button>

        <div class="history-heading">
          <span>历史记录</span>
          <small>{{ conversations.length }}</small>
        </div>

        <nav class="conversation-history" aria-label="历史对话">
          <button
            v-for="conversation in conversations"
            :key="conversation.id"
            class="conversation-item"
            :class="{ 'is-active': conversation.id === activeConversationId }"
            type="button"
            :disabled="loading"
            :aria-current="conversation.id === activeConversationId ? 'page' : undefined"
            @click="handleSelectConversation(conversation.id)"
          >
            <span class="conversation-title">{{ conversation.title }}</span>
            <span class="conversation-meta">
              {{ conversation.messages.length ? `${conversation.messages.length} 条消息` : '尚未开始' }}
            </span>
          </button>
        </nav>

        <p class="storage-note">会话仅保存在当前浏览器</p>
      </aside>

      <main class="chat-panel">
        <section
          id="conversation"
          ref="conversationScroll"
          class="conversation-scroll"
          aria-label="对话内容"
          :aria-busy="loading"
        >
          <div v-if="messageList.length === 0" class="empty-state">
            <div class="empty-mark" aria-hidden="true">✦</div>
            <p class="empty-eyebrow">AI Q&amp;A WORKBENCH</p>
            <h1>把问题放在这里</h1>
            <p>让提问、思考和答案，安静地发生在同一张书桌上。</p>
          </div>

          <div v-else class="message-list" aria-live="polite" aria-relevant="additions text">
            <article
              v-for="(item, index) in messageList"
              :key="index"
              :class="['message', item.role]"
            >
              <span class="message-label">{{ item.role === 'user' ? '你' : 'AI' }}</span>
              <div v-if="item.role === 'user'" class="user-content">{{ item.content }}</div>
              <div v-else class="md-body" v-html="renderMarkdown(item.content)"></div>
            </article>
          </div>
        </section>

        <footer class="composer-shell">
          <form class="composer" @submit.prevent="handleSend">
            <label class="visually-hidden" for="prompt-input">输入问题</label>
            <textarea
              id="prompt-input"
              ref="promptInput"
              v-model="inputText"
              rows="2"
              placeholder="输入问题……"
              :disabled="loading"
              @keydown.enter.exact.prevent="handleSend"
            ></textarea>
            <div class="composer-actions">
              <span class="composer-hint">Enter 发送 · Shift + Enter 换行</span>
              <button class="send-button" type="submit" :disabled="loading || !inputText.trim()">
                {{ loading ? '生成中' : '发送' }}
              </button>
            </div>
          </form>
        </footer>
      </main>
    </div>
  </div>
</template>

<style scoped>
:global(#app) {
  width: 100%;
  max-width: none;
  min-height: 100dvh;
  margin: 0;
  border: 0;
  text-align: left;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.workbench {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--color-text);
  background: var(--color-background);
}

.skip-link {
  position: fixed;
  top: 8px;
  left: 12px;
  z-index: 100;
  padding: 8px 12px;
  border-radius: var(--radius-tag);
  color: var(--color-background);
  background: var(--color-primary);
  font-weight: 700;
  transform: translateY(-160%);
}

.skip-link:focus {
  transform: translateY(0);
}

.topbar {
  z-index: 40;
  height: 64px;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--color-line);
  background: rgba(6, 26, 51, 0.96);
}

.sidebar-trigger {
  display: none;
  width: 40px;
  height: 40px;
  padding: 8px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-tag);
  color: var(--color-primary);
  background: transparent;
}

.sidebar-trigger svg {
  width: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.brand-name {
  color: var(--color-primary-soft);
  font-family: var(--font-title);
  font-size: 19px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.brand-separator {
  width: 1px;
  height: 18px;
  background: var(--color-border);
}

.product-name {
  color: var(--color-muted);
  font-size: 14px;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.return-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-tag);
  color: var(--color-muted);
  font-size: 14px;
  text-decoration: none;
  transition: color 180ms ease, background 180ms ease;
}

.return-link:hover {
  color: var(--color-primary);
  background: rgba(255, 190, 61, 0.08);
}

.workbench-body {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
}

.sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4) var(--space-4);
  border-right: 1px solid var(--color-line);
  background: rgba(2, 13, 27, 0.34);
}

.new-conversation {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-tag);
  color: var(--color-background);
  background: var(--color-primary);
  font-weight: 700;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease, opacity 180ms ease;
}

.new-conversation:hover:not(:disabled) {
  color: var(--color-primary);
  background: transparent;
}

.new-conversation:disabled,
.conversation-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-2);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.history-heading small {
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--color-primary-soft);
  background: rgba(255, 190, 61, 0.1);
  font-size: 11px;
  letter-spacing: 0;
  text-align: center;
}

.conversation-history {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
}

.conversation-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-tag);
  color: var(--color-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease;
}

.conversation-item:hover:not(:disabled) {
  background: rgba(247, 242, 232, 0.05);
}

.conversation-item.is-active {
  border-color: var(--color-border);
  background: rgba(255, 190, 61, 0.09);
}

.conversation-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-meta,
.storage-note {
  color: var(--color-muted);
  font-size: 12px;
}

.storage-note {
  margin: auto 0 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-line);
  text-align: center;
}

.chat-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(247, 242, 232, 0.015), transparent 30%);
}

.conversation-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-8) clamp(var(--space-6), 5vw, var(--space-16));
  scroll-behavior: smooth;
}

.empty-state {
  width: min(100%, 620px);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-mark {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  margin-bottom: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-primary);
  background: rgba(255, 190, 61, 0.06);
  font-size: 24px;
  box-shadow: var(--shadow-panel);
}

.empty-eyebrow {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.empty-state h1 {
  margin: var(--space-3) 0 var(--space-4);
  color: var(--color-primary-soft);
  font-family: var(--font-title);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: 0.06em;
}

.empty-state > p:last-child {
  max-width: 34em;
  color: var(--color-muted);
  font-size: 15px;
  line-height: 1.8;
}

.message-list {
  width: min(100%, 900px);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin: 0 auto;
}

.message {
  box-sizing: border-box;
  overflow-wrap: anywhere;
}

.message-label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.message.user {
  width: fit-content;
  max-width: 70%;
  align-self: flex-end;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: 16px 16px 4px 16px;
  color: var(--color-text);
  background: rgba(255, 190, 61, 0.1);
}

.user-content {
  font-size: 15px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.message.ai {
  width: 100%;
  align-self: flex-start;
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  color: var(--color-text);
  background: rgba(247, 242, 232, 0.035);
  box-shadow: var(--shadow-panel);
}

.md-body {
  font-size: 15px;
  line-height: 1.72;
  white-space: normal;
}

.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3) {
  margin: var(--space-6) 0 var(--space-3);
  color: var(--color-primary-soft);
  font-family: var(--font-title);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.04em;
}

.md-body :deep(h1:first-child),
.md-body :deep(h2:first-child),
.md-body :deep(h3:first-child) {
  margin-top: 0;
}

.md-body :deep(h1) {
  font-size: 22px;
}

.md-body :deep(h2) {
  font-size: 19px;
}

.md-body :deep(h3) {
  font-size: 17px;
}

.md-body :deep(p) {
  margin: 0 0 var(--space-4);
}

.md-body :deep(p:last-child) {
  margin-bottom: 0;
}

.md-body :deep(ol),
.md-body :deep(ul) {
  margin: var(--space-2) 0 var(--space-4);
  padding-left: 1.5em;
}

.md-body :deep(li) {
  margin: var(--space-1) 0;
}

.md-body :deep(li > p) {
  margin: 0;
}

.md-body :deep(li > ol),
.md-body :deep(li > ul) {
  margin: var(--space-1) 0;
}

.md-body :deep(a) {
  color: var(--color-primary);
  text-underline-offset: 3px;
}

.md-body :deep(blockquote) {
  margin: var(--space-4) 0;
  padding: var(--space-2) var(--space-4);
  border-left: 3px solid var(--color-primary);
  color: var(--color-muted);
  background: rgba(255, 190, 61, 0.05);
}

.md-body :deep(code) {
  display: inline;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--color-primary-soft);
  background: rgba(2, 13, 27, 0.72);
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.md-body :deep(pre) {
  max-width: 100%;
  margin: var(--space-4) 0;
  padding: var(--space-4);
  overflow-x: auto;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-tag);
  background: rgba(2, 13, 27, 0.82);
}

.md-body :deep(pre code) {
  display: block;
  padding: 0;
  color: inherit;
  background: transparent;
  line-height: 1.65;
}

.md-body :deep(table) {
  width: 100%;
  display: block;
  margin: var(--space-4) 0;
  overflow-x: auto;
  border-collapse: collapse;
}

.md-body :deep(th),
.md-body :deep(td) {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line);
  text-align: left;
  white-space: nowrap;
}

.md-body :deep(th) {
  color: var(--color-primary-soft);
  background: rgba(255, 190, 61, 0.06);
}

.composer-shell {
  flex: none;
  padding: var(--space-3) clamp(var(--space-6), 5vw, var(--space-16)) var(--space-6);
  border-top: 1px solid var(--color-line);
  background: rgba(6, 26, 51, 0.96);
}

.composer {
  width: min(100%, 900px);
  margin: 0 auto;
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: rgba(247, 242, 232, 0.04);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.composer:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(255, 190, 61, 0.08);
}

.composer textarea {
  width: 100%;
  min-height: 56px;
  max-height: 180px;
  display: block;
  padding: var(--space-2);
  resize: vertical;
  border: 0;
  outline: 0;
  color: var(--color-text);
  background: transparent;
  font: inherit;
  font-size: 15px;
  line-height: 1.6;
}

.composer textarea::placeholder {
  color: var(--color-muted);
}

.composer textarea:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0 0 var(--space-2);
}

.composer-hint {
  color: var(--color-muted);
  font-size: 12px;
}

.send-button {
  min-width: 88px;
  height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-tag);
  color: var(--color-background);
  background: var(--color-primary);
  font-weight: 700;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease, opacity 180ms ease;
}

.send-button:hover:not(:disabled) {
  color: var(--color-primary);
  background: transparent;
}

.send-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.sidebar-backdrop {
  display: none;
}

.sidebar-trigger:focus-visible,
.new-conversation:focus-visible,
.conversation-item:focus-visible,
.return-link:focus-visible,
.send-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 4px;
}

@media (max-width: 760px) {
  .topbar {
    height: 60px;
    padding: 0 var(--space-4);
  }

  .sidebar-trigger {
    display: block;
    flex: none;
  }

  .workbench-body {
    display: block;
  }

  .sidebar {
    position: fixed;
    top: 60px;
    bottom: 0;
    left: 0;
    z-index: 35;
    width: min(82vw, 280px);
    transform: translateX(-100%);
    transition: transform 180ms ease;
  }

  .sidebar.is-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 60px 0 0;
    z-index: 30;
    display: block;
    border: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  .chat-panel {
    height: calc(100dvh - 60px);
  }

  .conversation-scroll {
    padding: var(--space-6) var(--space-4);
  }

  .message-list {
    gap: var(--space-4);
  }

  .message.user {
    max-width: 86%;
  }

  .message.ai {
    padding: var(--space-4);
  }

  .composer-shell {
    padding: var(--space-3) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
  }
}

@media (max-width: 430px) {
  .brand-separator,
  .product-name,
  .composer-hint {
    display: none;
  }

  .return-link {
    padding-inline: var(--space-2);
    font-size: 13px;
  }

  .empty-state {
    padding-inline: 0;
  }

  .empty-state h1 {
    font-size: 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .return-link,
  .new-conversation,
  .conversation-item,
  .composer,
  .send-button {
    transition-duration: 0.01ms;
  }

  .conversation-scroll {
    scroll-behavior: auto;
  }
}
</style>
