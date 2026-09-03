import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const marked = new Marked(
    markedHighlight({
        emptyLangClass: 'hljs',
        langPrefix: 'hljs language-',
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext'
            return hljs.highlight(code, {language}).value
        }
    })
)

export function renderMarkdown(text: string): string {
    const html = marked.parse(text) as string
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}
