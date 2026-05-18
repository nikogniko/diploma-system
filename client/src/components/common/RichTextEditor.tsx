import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import type { ReactNode } from "react";
import styles from "./RichTextEditor.module.scss";

type RichTextEditorProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
};

/** Форматований HTML-редактор для довших текстових полів профілю. */
export function RichTextEditor({ label = "Текст", value, onChange, maxLength, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: placeholder ?? "Опишіть головне структуровано: короткі абзаци, списки, акценти.",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: styles.editor,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextValue = currentEditor.getHTML() === "<p></p>" ? "" : currentEditor.getHTML();
      if (maxLength && currentEditor.getText().length > maxLength) {
        currentEditor.commands.undo();
        return;
      }
      onChange(nextValue);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const normalizedValue = value || "";
    const currentValue = editor.getHTML() === "<p></p>" ? "" : editor.getHTML();
    if (currentValue !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className={styles.root}>
      <div className={styles.label}>{label}</div>
      <TiptapToolbar editor={editor} />
      <EditorContent editor={editor} className={styles.content} />
    </div>
  );
}

/** Мінімальна панель інструментів у стилі Tiptap UI без коду, зображень і вставок. */
function TiptapToolbar({ editor }: { editor: Editor }) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Панель форматування тексту">
      <ToolbarButton label="Скасувати" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} icon={<UndoIcon />} />
      <ToolbarButton label="Повторити" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} icon={<RedoIcon />} />
      <ToolbarDivider />
      <ToolbarButton label="Жирний текст" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={<BoldIcon />} />
      <ToolbarButton label="Курсив" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<ItalicIcon />} />
      <ToolbarButton label="Підкреслення" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon />} />
      <ToolbarDivider />
      <ToolbarButton label="Маркований список" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<BulletListIcon />} />
      <ToolbarButton label="Нумерований список" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<OrderedListIcon />} />
      <ToolbarDivider />
      <ToolbarButton label="Вирівняти ліворуч" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} icon={<AlignLeftIcon />} />
      <ToolbarButton label="Вирівняти по центру" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} icon={<AlignCenterIcon />} />
      <ToolbarButton label="Вирівняти праворуч" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} icon={<AlignRightIcon />} />
    </div>
  );
}

/** Кнопка панелі редактора з іконкою, станами active/disabled і tooltip через title. */
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

/** Візуально розділяє групи інструментів у панелі редактора. */
function ToolbarDivider() {
  return <span className={styles.divider} aria-hidden="true" />;
}

function UndoIcon() { return <svg viewBox="0 0 24 24"><path d="M7.5 8H15a5 5 0 1 1 0 10h-4v-2h4a3 3 0 1 0 0-6H7.5l3 3L9 14.5 3.5 9 9 3.5 10.5 5l-3 3Z" /></svg>; }
function RedoIcon() { return <svg viewBox="0 0 24 24"><path d="M16.5 8H9a5 5 0 1 0 0 10h4v-2H9a3 3 0 1 1 0-6h7.5l-3 3 1.5 1.5L20.5 9 15 3.5 13.5 5l3 3Z" /></svg>; }
function BoldIcon() { return <svg viewBox="0 0 24 24"><path d="M7 4h6.2c2.6 0 4.3 1.5 4.3 3.8 0 1.4-.7 2.5-1.9 3.1 1.6.5 2.4 1.8 2.4 3.7 0 2.8-2 4.4-5 4.4H7V4Zm3 6h3c1 0 1.6-.6 1.6-1.5S14 7 13 7h-3v3Zm0 6h3.3c1.1 0 1.8-.6 1.8-1.7 0-1-.7-1.6-1.8-1.6H10V16Z" /></svg>; }
function ItalicIcon() { return <svg viewBox="0 0 24 24"><path d="M10 4v2h2.2l-3.4 12H6v2h8v-2h-2.2l3.4-12H18V4h-8Z" /></svg>; }
function UnderlineIcon() { return <svg viewBox="0 0 24 24"><path d="M6 20h12v2H6v-2Zm2-16h3v7.5c0 2 1 3.1 3 3.1s3-1.1 3-3.1V4h3v7.7c0 3.7-2.3 5.7-6 5.7s-6-2-6-5.7V4Z" /></svg>; }
function BulletListIcon() { return <svg viewBox="0 0 24 24"><path d="M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4-3v2h12V4H9Zm-4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4-3v2h12v-2H9Zm-4 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4-3v2h12v-2H9Z" /></svg>; }
function OrderedListIcon() { return <svg viewBox="0 0 24 24"><path d="M4 4h2v5H4V7h1V5H4V4Zm0 7h3v1.4L5.7 14H7v2H4v-1.4L5.3 13H4v-2Zm0 7h3v5H4v-1h2v-1H4v-1h2v-1H4v-1Zm6-13h11v2H10V5Zm0 7h11v2H10v-2Zm0 7h11v2H10v-2Z" /></svg>; }
function AlignLeftIcon() { return <svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5Zm0 4h11v2H4V9Zm0 4h16v2H4v-2Zm0 4h11v2H4v-2Z" /></svg>; }
function AlignCenterIcon() { return <svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5Zm3 4h10v2H7V9Zm-3 4h16v2H4v-2Zm3 4h10v2H7v-2Z" /></svg>; }
function AlignRightIcon() { return <svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5Zm5 4h11v2H9V9Zm-5 4h16v2H4v-2Zm5 4h11v2H9v-2Z" /></svg>; }
