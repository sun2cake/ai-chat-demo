export async function streamChat(
    query: string,
    onChunk: (text: string) => void,
    onEnd: () => void,
    signal: AbortSignal
) {
    const res = await fetch('/dify-api/v1/chat-messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: {},
            query,
            user: 'demo-user',
            response_mode: 'streaming'
        }),
        signal
    })

    if(!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
    }

    const reader = res.body?.getReader()
    if(!reader) {
        throw new Error('Failed to get reader from response body')
    }
    const decoder = new TextDecoder()

    while(true) {
        const {done, value} = await reader.read()
        if(done) break

        const chunk = decoder.decode(value, {stream: true})

        const lines = chunk.split('\n').filter(line => line.trim() !== '')
        for(const line of lines) {
            if(!line.startsWith('data: ')) {
                continue
            }
            const dataStr = line.replace('data:', '').trim()
            if(dataStr === '[DONE]') {
                onEnd()
                return
            }
            try {
                const json = JSON.parse(dataStr)
                if(json.event === 'message' && json.answer){
                    onChunk(json.answer)
                }
            } catch(err) {}
        }
    }
    onEnd()
}
