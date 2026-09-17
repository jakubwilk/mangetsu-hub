'use client'

import { Box, Text } from '@mantine/core'
import ReactMarkdown from 'react-markdown'

import type { Message } from '../types'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <Box
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ animation: 'bubble-in 250ms ease' }}
    >
      <Box
        className="max-w-[75%] px-3.5 py-2.5"
        style={{
          borderRadius: isUser
            ? 'var(--mantine-radius-lg) var(--mantine-radius-lg) var(--mantine-radius-xs) var(--mantine-radius-lg)'
            : 'var(--mantine-radius-lg) var(--mantine-radius-lg) var(--mantine-radius-lg) var(--mantine-radius-xs)',
          background: isUser ? 'var(--mantine-color-mangetsu-7)' : 'var(--mantine-color-dark-6)',
        }}
      >
        {isUser ? (
          <Text size="sm" c="white" className="whitespace-pre-wrap">
            {message.content}
          </Text>
        ) : (
          <Box
            className="leading-[1.65] [&_code]:rounded [&_code]:bg-[var(--mantine-color-dark-8)] [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:text-[0.875em] [&_p]:mb-[0.4em] [&_p:last-child]:mb-0 [&_ul]:my-[0.35em] [&_ul]:pl-[1.1em] [&_ul]:list-disc [&_ol]:my-[0.35em] [&_ol]:pl-[1.1em] [&_ol]:list-decimal [&_li]:mb-[0.15em] [&_li]:marker:text-[var(--mantine-color-mangetsu-5)] [&_h1]:text-[1.15em] [&_h2]:text-[1.08em] [&_h3]:text-[1.02em] [&_h4]:text-[0.97em] [&_h5]:text-[0.92em] [&_h6]:text-[0.88em] [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-semibold [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:leading-tight [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:mt-[0.5em] [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:mb-[0.25em] [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:first:mt-0 [&_strong]:font-semibold [&_strong]:text-[var(--mantine-color-mangetsu-4)] [&_em]:italic"
            style={{
              fontSize: 'var(--mantine-font-size-sm)',
              color: 'var(--mantine-color-gray-2)',
            }}
          >
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </Box>
        )}
      </Box>
    </Box>
  )
}
