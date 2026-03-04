import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  useCreateBlockNote,
  useComponentsContext,
  useBlockNoteEditor,
  FormattingToolbar,
  BlockTypeSelect,
  BasicTextStyleButton,
  TextAlignButton,
  ColorStyleButton,
  NestBlockButton,
  UnnestBlockButton,
  DragHandleButton,
  SideMenu,
  SideMenuController,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { isJsonContent } from '../utils/noteUtils';

function ToolbarButton({ onClick, label, icon }) {
  const Components = useComponentsContext();
  if (!Components) return null;
  return (
    <Components.FormattingToolbar.Button mainTooltip={label} onClick={onClick}>
      {icon}
    </Components.FormattingToolbar.Button>
  );
}

function CustomSideMenu(props) {
  return (
    <SideMenu {...props}>
      <DragHandleButton {...props} />
    </SideMenu>
  );
}

function LinkModal({ onConfirm, onCancel }) {
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url || url === 'https://') return;
    onConfirm(url, text || url);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal-dialog" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-title">Insérer un lien</span>
          </div>
        </div>
        <div className="form-group">
          <label>URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Texte du lien</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texte affiché (optionnel)"
          />
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
          <button type="submit" className="btn btn-primary">Insérer</button>
        </div>
      </form>
    </div>
  );
}

function StaticToolbar() {
  const editor = useBlockNoteEditor();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const cursorRef = useRef(null);

  const insertBlock = (blockDef) => {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks([blockDef], currentBlock, 'after');
  };

  const openLinkModal = () => {
    cursorRef.current = editor.getTextCursorPosition();
    setShowLinkModal(true);
  };

  const handleLinkConfirm = (url, text) => {
    setShowLinkModal(false);
    const savedBlock = cursorRef.current?.block;
    // Need multiple frames for focus to settle after modal closes
    setTimeout(() => {
      editor.focus();
      if (savedBlock) {
        try {
          editor.setTextCursorPosition(savedBlock, 'end');
        } catch {
          // Block may have been removed, use last block
        }
      }
      setTimeout(() => {
        editor.insertInlineContent([
          { type: 'link', content: text, href: url },
        ]);
      }, 50);
    }, 100);
  };

  return (
    <>
      <FormattingToolbar>
        <BlockTypeSelect key="blockType" />

        <BasicTextStyleButton basicTextStyle="bold" key="bold" />
        <BasicTextStyleButton basicTextStyle="italic" key="italic" />
        <BasicTextStyleButton basicTextStyle="underline" key="underline" />
        <BasicTextStyleButton basicTextStyle="strike" key="strike" />
        <BasicTextStyleButton basicTextStyle="code" key="code" />

        <TextAlignButton textAlignment="left" key="alignLeft" />
        <TextAlignButton textAlignment="center" key="alignCenter" />
        <TextAlignButton textAlignment="right" key="alignRight" />

        <ColorStyleButton key="colors" />
        <NestBlockButton key="nest" />
        <UnnestBlockButton key="unnest" />

        <ToolbarButton key="link" label="Link" icon="🔗" onClick={openLinkModal} />
        <ToolbarButton key="codeBlock" label="Code block" icon="⟨/⟩" onClick={() => insertBlock({ type: 'codeBlock' })} />
        <ToolbarButton
          key="table"
          label="Table (3×3)"
          icon="☷"
          onClick={() => insertBlock({
            type: 'table',
            content: {
              type: 'tableContent',
              rows: [
                { cells: [[{ type: 'text', text: '' }], [{ type: 'text', text: '' }], [{ type: 'text', text: '' }]] },
                { cells: [[{ type: 'text', text: '' }], [{ type: 'text', text: '' }], [{ type: 'text', text: '' }]] },
                { cells: [[{ type: 'text', text: '' }], [{ type: 'text', text: '' }], [{ type: 'text', text: '' }]] },
              ],
            },
          })}
        />
      </FormattingToolbar>

      {showLinkModal && (
        <LinkModal
          onConfirm={handleLinkConfirm}
          onCancel={() => setShowLinkModal(false)}
        />
      )}
    </>
  );
}

function parseInitialBlocks(content) {
  if (!content) return undefined;
  if (isJsonContent(content)) {
    try {
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function BlockNoteEditor({ initialContent, onChange, editable = true }) {
  const timeoutRef = useRef(null);
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const initialBlocks = React.useMemo(() => parseInitialBlocks(initialContent), [initialContent]);

  const editor = useCreateBlockNote({
    initialContent: initialBlocks || undefined,
  });

  // Handle legacy markdown content (non-JSON)
  useEffect(() => {
    if (!editor || !initialContent || isJsonContent(initialContent)) return;
    async function convertMarkdown() {
      const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
      editor.replaceBlocks(editor.document, blocks);
    }
    convertMarkdown();
  }, [editor]);

  const handleChange = useCallback(() => {
    if (!onChange || !editor) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const blocks = editor.document;
      onChange(JSON.stringify(blocks));
    }, 250);
  }, [editor, onChange]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Intercept link clicks to open in external browser (capture phase)
  const containerRef = useRef(null);

  useEffect(() => {
    if (editable || !containerRef.current) return;
    const el = containerRef.current;
    const handler = (e) => {
      const link = e.target.closest('a[href]');
      if (link && link.href) {
        e.preventDefault();
        e.stopPropagation();
        window.open(link.href, '_blank');
      }
    };
    // Use capture phase to intercept before ProseMirror
    el.addEventListener('click', handler, true);
    return () => el.removeEventListener('click', handler, true);
  }, [editable]);

  return (
    <div ref={containerRef}>
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={theme}
        onChange={handleChange}
        formattingToolbar={false}
        sideMenu={false}
      >
        {editable && (
          <>
            <SideMenuController sideMenu={(props) => <CustomSideMenu {...props} />} />
            <StaticToolbar />
          </>
        )}
      </BlockNoteView>
    </div>
  );
}

export default BlockNoteEditor;
