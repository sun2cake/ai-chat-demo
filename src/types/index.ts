export interface MessageItem {
    role: 'user' | 'ai'
    content: string
}

export interface SendMessage {
    inputs: object
    query: string
    user: string
    conversationId?: string
}