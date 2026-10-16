'use client'

import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading2,
  ImageIcon,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Rich-text editor for article bodies.
 *
 * The toolbar is a set of real `<button>` elements inside a `role="toolbar"`,
 * each with `aria-pressed` reflecting the current state of the formatting it
 * controls, so a screen-reader user can tell which marks are active.
 *
 * Security note: the allowlist in `src/lib/sanitize.ts` is the real control.
 * This component restricts what the *editor* can produce for usability, but
 * every document is sanitised again on the server before it is stored or
 * rendered. Client-side filtering is never treated as a boundary.
 *
 * `immediatelyRender: false` is required for server rendering: without it
 * TipTap generates different HTML on the server and the client, which produces
 * a hydration mismatch.
 */

export type EditorVariant = 'default' | 'comment'

export function RichTextEditor({
  name,
  initialContent,
  label,
  onWordCountChange,
}: {
  /** Name of the hidden input the HTML is submitted under. */
  name: string
  initialContent: string
  label: string
  onWordCountChange?: (words: number) => void
}) {
  // Word count is derived in the DOM-free way the server also uses; keeping it
  // in React state rather than reading the editor during render avoids the
  // same class of hydration problem.
  //
  // Seeded from `initialContent` rather than computed in an effect: an effect
  // that calls setState on mount produces a second render pass and, worse,
  // renders the server HTML with one count before correcting it.
  const [wordCount, setWordCount] = useState(() =>
    countWordsInHtml(initialContent),
  )
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /*
   * `onWordCountChange` is held in a ref so the editor can be created once.
   *
   * Without the dependency array below, `useEditor` sees a NEW options object on
   * every render and re-creates the Editor — which resets the document back to
   * `content` and discards everything typed. In practice that meant typing in
   * the title field silently wiped the article body, because changing the title
   * re-rendered this component.
   */
  const wordsCallbackRef = useRef(onWordCountChange)

  useEffect(() => {
    wordsCallbackRef.current = onWordCountChange
  }, [onWordCountChange])

  const editor = useEditor(
    {
      immediatelyRender: false,

      /*
       * Re-render the toolbar on every transaction.
       *
       * TipTap 3 defaults this to false for performance, which is wrong for a
       * component whose job is to show which marks are active. Without it the
       * toolbar only refreshed as a side effect of the word-count state
       * changing: toggling a heading alters the document structure but not the
       * text, so `setWordCount` received an identical value, React bailed out of
       * re-rendering, and the button stayed visually inactive while the change
       * had in fact been applied. `aria-pressed` was wrong for the same reason,
       * so a screen-reader user was told the heading was not applied when it was.
       */
      shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({ table: { resizable: true } }),
      Image.configure({
        // Restrict the editor to images that can actually be served safely.
        // The server allowlist is stricter still.
        allowBase64: false,
        HTMLAttributes: { loading: 'lazy' },
      }),
      Placeholder.configure({
        placeholder:
          'Write the article. Use the toolbar for headings, lists, links and tables.',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        // Reuses the same typography as the published article, so what an
        // editor sees while writing is what a reader will see.
        class:
          'prose-editorial min-h-96 w-full px-4 py-3 text-base leading-relaxed focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) => {
      /*
       * Write the HTML straight to the input here, in the same tick as the
       * edit.
       *
       * The input is deliberately given NO `value` or `defaultValue` prop.
       * React owns those properties: on any re-render it re-applies the
       * remembered `defaultValue` to the `value` attribute, and writing the
       * attribute resets the property. In practice that wiped the submitted
       * body whenever an unrelated field changed — typing in the title field
       * emptied the article, because the title updates state and re-renders.
       *
       * React having no value to manage means nothing can clobber this.
       */
      const html = e.getHTML()
      if (inputRef.current) inputRef.current.value = html

      const text = e.getText().trim()
      const words = text.length === 0 ? 0 : text.split(/\s+/).length
      setWordCount(words)
      wordsCallbackRef.current?.(words)
    },
    },
    // Pin the editor instance: see the note above.
    [],
  )

  // Keep the hidden input in step with the editor without re-rendering it.
  useEffect(() => {
    if (!editor || !inputRef.current) return

    // Seed the input with the stored content on mount, so saving an article
    // that was not edited still submits its body.
    inputRef.current.value = editor.getHTML()
  }, [editor])

  // Report the initial count to the parent once, on mount.
  useEffect(() => {
    onWordCountChange?.(wordCount)
    // Only on mount: later updates go through the onUpdate handler above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus()
  }, [linkOpen])

  if (!editor) {
    return (
      <div
        className="min-h-96 rounded-b-sm border border-t-0 border-ink-300 bg-ink-50"
        aria-busy="true"
      />
    )
  }

  function applyLink() {
    const url = linkValue.trim()
    if (url.length === 0) {
      editor?.chain().focus().unsetLink().run()
      setLinkOpen(false)
      setLinkValue('')
      return
    }

    // Normalise a bare domain so the editor does not produce a relative link.
    const normalised = /^[a-z][a-z0-9+.-]*:/i.test(url)
      ? url
      : `https://${url}`

    editor
      ?.chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: normalised })
      .run()

    setLinkOpen(false)
    setLinkValue('')
  }

  const setImage = () => {
    const url = window.prompt('Image URL (https://)')
    if (!url || !/^https:\/\//i.test(url.trim())) return
    editor?.chain().focus().setImage({ src: url.trim() }).run()
  }

  return (
    <div>
      <div className="rounded-t-sm border border-ink-300 bg-ink-50">
        <div
          role="toolbar"
          aria-label={`${label} formatting`}
          aria-controls={name}
          className="flex flex-wrap items-center gap-1 border-b border-ink-200 p-2"
        >
          <ToolbarButton
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo2 className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo2 className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <Separator />

          <ToolbarButton
            label="Bold"
            pressed={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Italic"
            pressed={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Underline"
            pressed={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <Underline className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Strikethrough"
            pressed={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Inline code"
            pressed={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <Separator />

          <ToolbarButton
            label="Heading"
            pressed={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Bulleted list"
            pressed={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Numbered list"
            pressed={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Quote"
            pressed={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <Separator />

          <ToolbarButton
            label="Align left"
            pressed={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            text="L"
          />
          <ToolbarButton
            label="Align centre"
            pressed={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            text="C"
          />
          <ToolbarButton
            label="Align right"
            pressed={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            text="R"
          />

          <Separator />

          <ToolbarButton
            label="Insert link"
            pressed={editor.isActive('link')}
            onClick={() => {
              setLinkValue(editor.getAttributes('link').href ?? '')
              setLinkOpen((v) => !v)
            }}
          >
            <Link2 className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Remove link"
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Link2Off className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton label="Insert image" onClick={setImage}>
            <ImageIcon className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Insert table"
            pressed={editor.isActive('table')}
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            <TableIcon className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="size-4" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          >
            <span className="px-1 text-xs font-bold">Tx</span>
          </ToolbarButton>
        </div>

        {/* Link editor. A form so Enter submits without a mouse. */}
        {linkOpen ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-white p-2">
            <label htmlFor="editor-link-url" className="sr-only">
              Link URL
            </label>
            <input
              id="editor-link-url"
              ref={linkInputRef}
              type="url"
              inputMode="url"
              value={linkValue}
              placeholder="https://example.com"
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                }
                if (e.key === 'Escape') setLinkOpen(false)
              }}
              className="min-w-48 flex-1 rounded-sm border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
            <button
              type="button"
              onClick={applyLink}
              className="rounded-sm bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setLinkOpen(false)}
              className="rounded-sm border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      <EditorContent
        editor={editor}
        className="rounded-b-sm border-x border-b border-ink-300 bg-white"
      />

      {/*
        The submitted value. No `value` and no `defaultValue` on purpose — see
        the note in `onUpdate`. React must not manage this node's value.
      */}
      <input type="hidden" name={name} ref={inputRef} />

      <p className="mt-1.5 text-xs text-ink-500">
        {wordCount.toLocaleString('en-GB')} words · roughly{' '}
        {Math.max(1, Math.round(wordCount / 200))} min read
      </p>
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  pressed,
  disabled,
  text,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
  text?: string
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="inline-flex size-8 items-center justify-center rounded-sm text-ink-700 transition-colors hover:bg-ink-200 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-40 aria-pressed:bg-brand-100 aria-pressed:text-brand-800"
    >
      {text ? <span className="text-xs font-bold">{text}</span> : children}
    </button>
  )
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 h-6 w-px shrink-0 bg-ink-200"
    />
  )
}

/**
 * Word count of an HTML string.
 *
 * Duplicated from `src/lib/sanitize.ts` rather than imported, because that
 * module is `server-only` and this is a Client Component. The two must agree,
 * so the rule — whitespace-delimited tokens of visible text — is kept trivial.
 */
function countWordsInHtml(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length === 0 ? 0 : text.split(' ').length
}