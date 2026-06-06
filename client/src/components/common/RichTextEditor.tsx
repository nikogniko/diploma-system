import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { messages } from "../../locales/localizedMessages";
import { legacyHtmlToMarkdown } from "../../utils/richText";
import styles from "./RichTextEditor.module.scss";

type RichTextEditorProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
};

/** Markdown rich-text editor for longer profile and vacancy text fields. */
export function RichTextEditor({ label, value, onChange, maxLength, placeholder }: RichTextEditorProps) {
  const ui = messages.editor;
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: placeholder ?? ui.defaultPlaceholder,
      }),
      Markdown,
    ],
    content: legacyHtmlToMarkdown(value || ""),
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: styles.editor,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (maxLength && currentEditor.getText().length > maxLength) {
        currentEditor.commands.undo();
        return;
      }
      const nextValue = currentEditor.getText().trim() ? currentEditor.getMarkdown().trim() : "";
      onChange(nextValue);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const normalizedValue = legacyHtmlToMarkdown(value || "");
    const currentValue = editor.getText().trim() ? editor.getMarkdown().trim() : "";
    if (currentValue !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className={styles.root}>
      {label && <div className={styles.label}>{label}</div>}
      <TiptapToolbar editor={editor} />
      <EditorContent editor={editor} className={styles.content} />
    </div>
  );
}

function TiptapToolbar({ editor }: { editor: Editor }) {
  const ui = messages.editor;
  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
      isBold: currentEditor.isActive("bold"),
      isItalic: currentEditor.isActive("italic"),
      isUnderline: currentEditor.isActive("underline"),
      isLink: currentEditor.isActive("link"),
      isBulletList: currentEditor.isActive("bulletList"),
      isOrderedList: currentEditor.isActive("orderedList"),
      isAlignLeft: currentEditor.isActive({ textAlign: "left" }),
      isAlignCenter: currentEditor.isActive({ textAlign: "center" }),
      isAlignRight: currentEditor.isActive({ textAlign: "right" }),
    }),
  });

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={ui.toolbarLabel}>
      <ToolbarButton label={ui.buttons.undo} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} icon={<UndoIcon />} />
      <ToolbarButton label={ui.buttons.redo} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} icon={<RedoIcon />} />
      <ToolbarDivider />
      <ToolbarButton label={ui.buttons.bold} active={state.isBold} onClick={() => editor.chain().focus().toggleBold().run()} icon={<BoldIcon />} />
      <ToolbarButton label={ui.buttons.italic} active={state.isItalic} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<ItalicIcon />} />
      <ToolbarButton label={ui.buttons.underline} active={state.isUnderline} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon />} />
      <ToolbarButton label="Link" active={state.isLink} onClick={() => setLink(editor)} icon={<LinkIcon />} />
      <ToolbarDivider />
      <ToolbarButton label={ui.buttons.bulletList} active={state.isBulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<BulletListIcon />} />
      <ToolbarButton label={ui.buttons.orderedList} active={state.isOrderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<OrderedListIcon />} />
      <ToolbarDivider />
      <ToolbarButton label={ui.buttons.alignLeft} active={state.isAlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} icon={<AlignLeftIcon />} />
      <ToolbarButton label={ui.buttons.alignCenter} active={state.isAlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} icon={<AlignCenterIcon />} />
      <ToolbarButton label={ui.buttons.alignRight} active={state.isAlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} icon={<AlignRightIcon />} />
    </div>
  );
}

function ToolbarButton({ label, icon, active, disabled, onClick }: { label: string; icon: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={active ? styles.activeButton : undefined}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <span className={styles.divider} aria-hidden="true" />;
}

function setLink(editor: Editor) {
  const previousUrl = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("URL", previousUrl ?? "");
  if (url === null) return;
  if (!url.trim()) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
}

function UndoIcon() { return <svg viewBox="0 0 24 24"><path d="M7.5 8H15a5 5 0 1 1 0 10h-4v-2h4a3 3 0 1 0 0-6H7.5l3 3L9 14.5 3.5 9 9 3.5 10.5 5l-3 3Z" /></svg>; }
function RedoIcon() { return <svg viewBox="0 0 24 24"><path d="M16.5 8H9a5 5 0 1 0 0 10h4v-2H9a3 3 0 1 1 0-6h7.5l-3 3 1.5 1.5L20.5 9 15 3.5 13.5 5l3 3Z" /></svg>; }
function BoldIcon() { return <svg viewBox="0 0 24 24"><path d="M7 4h6.2c2.6 0 4.3 1.5 4.3 3.8 0 1.4-.7 2.5-1.9 3.1 1.6.5 2.4 1.8 2.4 3.7 0 2.8-2 4.4-5 4.4H7V4Zm3 6h3c1 0 1.6-.6 1.6-1.5S14 7 13 7h-3v3Zm0 6h3.3c1.1 0 1.8-.6 1.8-1.7 0-1-.7-1.6-1.8-1.6H10V16Z" /></svg>; }
function ItalicIcon() { return <svg viewBox="0 0 24 24"><path d="M10 4v2h2.2l-3.4 12H6v2h8v-2h-2.2l3.4-12H18V4h-8Z" /></svg>; }
function UnderlineIcon() { return <svg viewBox="0 0 24 24"><path d="M6 20h12v2H6v-2Zm2-16h3v7.5c0 2 1 3.1 3 3.1s3-1.1 3-3.1V4h3v7.7c0 3.7-2.3 5.7-6 5.7s-6-2-6-5.7V4Z" /></svg>; }
function LinkIcon() { return <svg viewBox="0 0 24 24"><path d="M8.5 12A4.5 4.5 0 0 1 13 7.5h3v2h-3a2.5 2.5 0 0 0 0 5h3v2h-3A4.5 4.5 0 0 1 8.5 12Zm3.5 1h4v-2h-4v2ZM7 16.5H5a4.5 4.5 0 0 1 0-9h2v2H5a2.5 2.5 0 0 0 0 5h2v2Zm9-7v-2h3a4.5 4.5 0 0 1 0 9h-3v-2h3a2.5 2.5 0 0 0 0-5h-3Z" /></svg>; }
function BulletListIcon() { return <svg viewBox="0 0 24 24"><path d="M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4-3v2h12V4H9Zm-4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4-3v2h12v-2H9Zm-4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4-3v2h12v-2H9Z" /></svg>; }
function OrderedListIcon() { return <svg viewBox="0 0 24 24"><path d="M4 4h2v5H4V7h1V5H4V4Zm0 7h3v1.4L5.7 14H7v2H4v-1.4L5.3 13H4v-2Zm0 7h3v5H4v-1h2v-1H4v-1h2v-1H4v-1Zm6-13h11v2H10V5Zm0 7h11v2H10v-2Zm0 7h11v2H10v-2Z" /></svg>; }
function AlignLeftIcon() { return <svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5Zm0 4h11v2H4V9Zm0 4h16v2H4v-2Zm0 4h11v2H4v-2Z" /></svg>; }
function AlignCenterIcon() { return <svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5Zm3 4h10v2H7V9Zm-3 4h16v2H4v-2Zm3 4h10v2H7v-2Z" /></svg>; }
function AlignRightIcon() { return <svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5Zm5 4h11v2H9V9Zm-5 4h16v2H4v-2Zm5 4h11v2H9v-2Z" /></svg>; }
