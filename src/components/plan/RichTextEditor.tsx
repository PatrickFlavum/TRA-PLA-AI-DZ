import { useRef, useCallback, useEffect } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
}

export function RichTextEditor({ value, onChange, placeholder, disabled }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      editorRef.current.innerHTML = value
    }
    isInternalChange.current = false
  }, [value])

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const execCmd = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    emitChange()
  }, [emitChange])

  const handleLink = () => {
    const url = prompt('URL eingeben:')
    if (url) execCmd('createLink', url)
  }

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      {!disabled && (
        <div className="flex gap-1 mb-1">
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); execCmd('bold') }}
            className="px-2 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded"
            title="Fett"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); execCmd('italic') }}
            className="px-2 py-1 text-xs italic bg-gray-100 hover:bg-gray-200 rounded"
            title="Kursiv"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleLink() }}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            title="Link einfügen"
          >
            Link
          </button>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        className="rich-text-editor"
        onInput={emitChange}
        data-placeholder={placeholder}
        style={{ minHeight: '100px' }}
        suppressContentEditableWarning
      />
    </div>
  )
}
