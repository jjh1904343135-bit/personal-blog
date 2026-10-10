import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import { common, createLowlight } from 'lowlight'

const LocalImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || ''
    if (!/^\/(?:images\/[^?#]+|author-media\/[a-f\d]{32}\.(?:png|jpe?g|webp|gif|avif))$/.test(src)) return ['span', {class:'external-image'}, HTMLAttributes.alt || '外部图片：请先上传到本机']
    return ['img', {src, alt:HTMLAttributes.alt || '文章配图', title:HTMLAttributes.title || null}]
  }
})

export function createNoteEditor({ element, onChange, onSelection, onImageFiles }) {
  let loading = false, original = '', edited = false
  const editor = new Editor({
    element,
    injectCSS: false,
    extensions: [
      StarterKit.configure({codeBlock:false, underline:false, link:{openOnClick:false, autolink:false}}),
      Markdown.configure({markedOptions:{gfm:true}}),
      TableKit.configure({table:{resizable:false}}),
      LocalImage.configure({allowBase64:false}),
      CodeBlockLowlight.configure({lowlight:createLowlight(common),defaultLanguage:'plaintext'}),
      Placeholder.configure({placeholder:'从一个问题开始，写下你的思路、代码和复盘…'})
    ],
    editorProps: {
      attributes: {class:'note-prose',role:'textbox','aria-label':'笔记正文','aria-multiline':'true',spellcheck:'false'},
      handlePaste(_view, event) {
        const images = [...(event.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'))
        if (images.length) { event.preventDefault(); onImageFiles(images); return true }
        return false
      },
      handleDrop(_view,event) {
        const images = [...(event.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'))
        if(images.length) {event.preventDefault();onImageFiles(images);return true}
        return false
      }
    },
    onUpdate() { if(!loading) {edited=true;onChange()} },
    onSelectionUpdate() { onSelection(editor) }
  })
  return {
    editor,
    load(body) { loading=true; original=body; edited=false; editor.commands.setContent(body,{contentType:'markdown',emitUpdate:false}); loading=false },
    markdown() { return edited ? editor.getMarkdown() : original },
    command(action, value) {
      const chain = editor.chain().focus()
      const actions = {
        bold:()=>chain.toggleBold().run(), italic:()=>chain.toggleItalic().run(),
        heading:()=>value ? chain.toggleHeading({level:Number(value)}).run() : chain.setParagraph().run(),
        bullet:()=>chain.toggleBulletList().run(), ordered:()=>chain.toggleOrderedList().run(),
        quote:()=>chain.toggleBlockquote().run(), code:()=>chain.toggleCodeBlock({language:value || 'java'}).run(),
        language:()=>chain.updateAttributes('codeBlock',{language:value}).run(),
        table:()=>chain.insertTable({rows:3,cols:3,withHeaderRow:true}).run(),
        row:()=>chain.addRowAfter().run(), column:()=>chain.addColumnAfter().run(),
        deleteTable:()=>chain.deleteTable().run(), undo:()=>chain.undo().run(), redo:()=>chain.redo().run(),
        image:()=>{
          // Images belong outside a code block; never split a pasted code sample.
          const {$from}=editor.state.selection
          for(let depth=$from.depth;depth>0;depth--) if($from.node(depth).type.name==='codeBlock') return chain.insertContentAt($from.after(depth),{type:'image',attrs:{src:value,alt:'文章配图'}}).run()
          return chain.setImage({src:value,alt:'文章配图'}).run()
        },
        link:()=>value ? chain.extendMarkRange('link').setLink({href:value}).run() : chain.unsetLink().run()
      }
      actions[action]?.(); onSelection(editor)
    },
    editable(value) { editor.setEditable(value) },
    destroy() { editor.destroy() }
  }
}

// Do not silently round-trip VitePress/Vue/custom syntax through a rich editor.
export function needsSourceMode(body) {
  const withoutCode = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g,'')
  return /^\s*:::|<\/?[A-Za-z]|\{\{|^\[\^[^\]]+\]:|^\s*\$\$/m.test(withoutCode)
}
