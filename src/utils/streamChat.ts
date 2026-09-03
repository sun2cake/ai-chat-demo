interface DifyStreamEvent {
    event?: string
    answer?: string
    conversation_id?: string
    message?: string
}

export async function streamChat(
    query: string,
    conversationId: string | undefined,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
): Promise<string | undefined> {
    const res = await fetch('/dify-api/v1/chat-messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: {},
            query,
            user: 'user1',
            response_mode: 'streaming',
            ...(conversationId ? { conversation_id: conversationId } : {})
        }),
        signal
    })

    if(!res.ok) {
        throw new Error(`连接失败（${res.status}）`)
    }

    const reader = res.body?.getReader()
    if(!reader) {
        throw new Error('响应失败')
    }
    const decoder = new TextDecoder()
    let buffer = ''
    let currentConversationId = conversationId

    const handleEvent = (eventBlock: string) => {
        const data = eventBlock
            .split(/\r?\n/)
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trimStart())
            .join('\n')

        if(!data) return false
        if(data === '[DONE]') return true

        const event = JSON.parse(data) as DifyStreamEvent
        if(event.conversation_id) {
            currentConversationId = event.conversation_id
        }
        if(event.event === 'message' && event.answer) {
            onChunk(event.answer)
        }
        if(event.event === 'error') {
            throw new Error(event.message || '响应失败')
        }
        return event.event === 'message_end'
    }

    while(true) {
        const {done, value} = await reader.read()
        if(done) break

        buffer += decoder.decode(value, {stream: true})
        const eventBlocks = buffer.split(/\r?\n\r?\n/)
        buffer = eventBlocks.pop() || ''

        for(const eventBlock of eventBlocks) {
            if(handleEvent(eventBlock)) {
                return currentConversationId
            }
        }
    }

    buffer += decoder.decode()
    if(buffer.trim()) handleEvent(buffer)
    return currentConversationId
}
