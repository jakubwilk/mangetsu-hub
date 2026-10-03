import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { Message } from '../../types'

interface MessageBubbleProps {
  message: Message
}

const MessageBubble = ({ message }: MessageBubbleProps) =>
  message.role === 'user' ? (
    <div className="animate-bubble-in flex justify-end">
      <div className="bg-mangetsu-7 max-w-[75%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm whitespace-pre-wrap text-white">
        {message.content}
      </div>
    </div>
  ) : (
    <div className="animate-bubble-in flex justify-start">
      <div className="bg-card prose prose-sm prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-table:my-2 prose-table:block prose-table:overflow-x-auto prose-headings:mt-2 prose-headings:mb-1 prose-headings:font-semibold prose-strong:text-mangetsu-4 prose-code:rounded prose-code:bg-panel prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none marker:text-mangetsu-5 max-w-[92%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-gray-200 md:max-w-[75%] [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  )

export default MessageBubble
