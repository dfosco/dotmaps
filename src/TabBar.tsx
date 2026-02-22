import { useState } from 'react';
import type { FileTab } from './storage';

interface TabBarProps {
  tabs: FileTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onNewTab: () => void;
  onCloseTab: (id: string) => void;
  onRenameTab: (id: string, name: string) => void;
}

export default function TabBar({ tabs, activeTabId, onSelectTab, onNewTab, onCloseTab, onRenameTab }: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRenameTab(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          {editingId === tab.id ? (
            <input
              className="tab-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className="tab-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(tab.id, tab.name);
              }}
            >
              {tab.name}
            </span>
          )}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
            title="Close tab"
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={onNewTab} title="New file">
        +
      </button>
    </div>
  );
}
