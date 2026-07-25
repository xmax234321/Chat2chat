import {
  formatAppFolderFileDate,
  formatAppFolderFileIdHint,
  type AppFolderFileEntry,
} from '../lib/app-backups-folder';

type Props = {
  title: string;
  entries: AppFolderFileEntry[];
  onSelect: (entry: AppFolderFileEntry) => void;
  onCancel?: () => void;
};

export function AppFolderFilePicker({ title, entries, onSelect, onCancel }: Props) {
  const multi = entries.length > 1;

  return (
    <div className="app-folder-picker">
      {multi ? <div className="app-folder-picker-title">{title}</div> : null}
      <div className={`app-folder-picker-list${multi ? ' app-folder-picker-list--multi' : ''}`}>
        {entries.map((entry) => (
          <button
            key={entry.uri || entry.name}
            type="button"
            className="app-folder-picker-card"
            onClick={() => onSelect(entry)}
          >
            <span className="app-folder-picker-date">{formatAppFolderFileDate(entry.modifiedAt)}</span>
            <span className="app-folder-picker-id">{formatAppFolderFileIdHint(entry.name)}</span>
          </button>
        ))}
      </div>
      {onCancel ? (
        <button type="button" className="app-folder-picker-cancel" onClick={onCancel}>
          Choose another file
        </button>
      ) : null}
    </div>
  );
}
