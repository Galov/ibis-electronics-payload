import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText as RichTextWithoutBlocks } from '@payloadcms/richtext-lexical/react'
import { cn } from '@/utilities/cn'

type Props = {
  data: SerializedEditorState
  enableGutter?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

type LexicalNode = {
  children?: LexicalNode[]
  indent?: number
  type?: string
} & Record<string, unknown>

const stripLexicalIndent = (node: LexicalNode): LexicalNode => {
  const nextNode: LexicalNode = {
    ...node,
  }

  if (typeof nextNode.indent === 'number' && nextNode.indent > 0) {
    nextNode.indent = 0
  }

  if (Array.isArray(nextNode.children)) {
    nextNode.children = nextNode.children.map(stripLexicalIndent)
  }

  return nextNode
}

export const RichText: React.FC<Props> = (props) => {
  const { className, data, enableProse = true, enableGutter = true, ...rest } = props
  const normalizedData = {
    ...data,
    root: stripLexicalIndent(data.root as LexicalNode),
  } as SerializedEditorState

  return (
    <RichTextWithoutBlocks
      className={cn(
        {
          'container ': enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto max-w-none prose type-richtext dark:prose-invert': enableProse,
        },
        className,
      )}
      data={normalizedData}
      {...rest}
    />
  )
}
