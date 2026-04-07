import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText as RichTextWithoutBlocks } from '@payloadcms/richtext-lexical/react'
import { cn } from '@/utilities/cn'

type Props = {
  data: SerializedEditorState
  enableGutter?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export const RichText: React.FC<Props> = (props) => {
  const { className, enableProse = true, enableGutter = true, ...rest } = props
  return (
    <RichTextWithoutBlocks
      className={cn(
        {
          'container ': enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto prose md:prose-md dark:prose-invert ': enableProse,
        },
        className,
      )}
      {...rest}
    />
  )
}
