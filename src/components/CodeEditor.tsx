import { useMemo } from 'react'
import CodeMirror, { type Extension } from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { php } from '@codemirror/lang-php'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'

export type CodeLang =
  | 'php' | 'javascript' | 'typescript' | 'css' | 'scss'
  | 'html' | 'json' | 'xml' | 'svg' | 'markdown' | 'yaml' | 'plaintext'

export function extToLang(ext: string): CodeLang {
  switch (ext.toLowerCase()) {
    case 'php': return 'php'
    case 'js':
    case 'jsx': return 'javascript'
    case 'ts':
    case 'tsx': return 'typescript'
    case 'css':
    case 'scss': return 'css'
    case 'html':
    case 'htm': return 'html'
    case 'json': return 'json'
    case 'xml': return 'xml'
    case 'svg': return 'svg'
    case 'md': return 'markdown'
    case 'yml':
    case 'yaml': return 'yaml'
    default: return 'plaintext'
  }
}

function langExtension(lang: CodeLang): Extension[] {
  switch (lang) {
    case 'php': return [php()]
    case 'javascript': return [javascript({ jsx: true })]
    case 'typescript': return [javascript({ jsx: true, typescript: true })]
    case 'css':
    case 'scss': return [css()]
    case 'html': return [html()]
    case 'json': return [json()]
    case 'xml':
    case 'svg': return [xml()]
    case 'markdown': return [markdown()]
    case 'yaml': return [yaml()]
    default: return []
  }
}

interface CodeEditorProps {
  value: string
  onChange: (v: string) => void
  language: CodeLang
  height?: string
  className?: string
  readOnly?: boolean
}

export function CodeEditor({
  value,
  onChange,
  language,
  height = '100%',
  className,
  readOnly = false,
}: CodeEditorProps) {
  const extensions = useMemo(() => langExtension(language), [language])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={oneDark}
      extensions={extensions}
      height={height}
      readOnly={readOnly}
      className={className}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        highlightSelectionMatches: true,
        indentOnInput: true,
      }}
      style={{ fontSize: 13, height }}
    />
  )
}
