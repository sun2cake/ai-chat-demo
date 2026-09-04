export interface MessageItem {
    role: 'user' | 'ai'
    content: string
    originalQuery?: string
}

export interface ConversationItem {
    id: string
    title: string
    messages: MessageItem[]
    conversationId?: string
    updatedAt: number
}

export interface SendMessage {
    inputs: object
    query: string
    user: string
    conversationId?: string
}
