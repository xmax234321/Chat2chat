import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { PhoneShell } from '../components/PhoneShell';
import { BackIcon, ChevronRight } from '../components/Icons';
import { DeleteChatSheet } from '../components/DeleteChatSheet';
import { ExportBlockSheet, type ExportBlockSheetMode } from '../components/ExportBlockSheet';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ContactSharedSheet, type SharedContentTab } from '../components/ContactSharedSheet';
import { InviteContactToGroupSheet } from '../components/InviteContactToGroupSheet';
import { ExpandableUserId } from '../components/ExpandableUserId';
import { ContactAvatarEditorSheet } from '../components/ContactAvatarEditorSheet';
import { ContactRenameSheet } from '../components/ContactRenameSheet';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { downloadChatExport } from '../lib/chat-export';
import { collectSharedContent } from '../lib/chat-shared-content';
import { isContactExportBlocked } from '../lib/chat-privacy-protocol';
import { canDisableExportBlockForPeer, isExportBlockForPeerActive } from '../lib/export-block-lock';
import { contactDisplayName, isGroupId } from '../lib/types';
import { buildSavedMessagesContact, isSavedMessagesContact, isSavedMessagesId } from '../lib/saved-messages';
import { SfBookmarkIcon } from '../components/settings/SettingsSfIcons';

function TgRow({
  label,
  value,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tg-profile-row${danger ? ' tg-profile-row--danger' : ''}`}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      <span className="tg-profile-row-label">{label}</span>
      {value ? <span className="tg-profile-row-value">{value}</span> : <ChevronRight />}
    </button>
  );
}

export function ContactProfileScreen() {
  const navigate = useNavigate();
  const { contactId: rawId } = useParams();
  const contactId = decodeURIComponent(rawId ?? '');
  const { show } = useToast();
  const {
    getContact,
    groups,
    identity,
    getThread,
    setContactNote,
    renameContact,
    blockContact,
    unblockContact,
    setContactExportBlocked,
    setContactAvatar,
    clearChatMessages,
    deleteChat,
  } = useApp();

  const contact = getContact(contactId);
  const savedMessages = contact ? isSavedMessagesContact(contact) : isSavedMessagesId(contactId);
  const [noteDraft, setNoteDraft] = useState(contact?.note ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [sharedTab, setSharedTab] = useState<SharedContentTab | null>(null);
  const [exportBlockSheet, setExportBlockSheet] = useState<ExportBlockSheetMode | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    setNoteDraft(contact?.note ?? '');
  }, [contact?.note, contactId]);

  const adminGroups = useMemo(
    () => groups.filter((g) => g.adminId === identity?.userId),
    [groups, identity?.userId],
  );

  const thread = useMemo(() => getThread(contactId), [contactId, getThread]);

  const shared = useMemo(() => collectSharedContent(thread), [thread]);

  if (isGroupId(contactId) || (!contact && !isSavedMessagesId(contactId))) {
    return (
      <PhoneShell>
        <div className="screen-pad">Contact not found</div>
      </PhoneShell>
    );
  }

  if (savedMessages) {
    const savedContact = contact ?? buildSavedMessagesContact();
    return (
      <PhoneShell showHome={false}>
        <div className="tg-profile-screen">
          <header className="tg-profile-header">
            <button type="button" className="nav-back" onClick={() => navigate(-1)}>
              <BackIcon />
            </button>
            <h1>Info</h1>
            <span className="tg-profile-edit-btn tg-profile-edit-btn--spacer" aria-hidden />
          </header>

          <div className="tg-profile-body">
            <div className="tg-profile-hero">
              <div className="avatar avatar--saved-messages tg-profile-avatar">
                <SfBookmarkIcon size={28} color="#5eb3ff" />
              </div>
              <h2 className="tg-profile-name">{savedContact.alias}</h2>
              <p className="tg-profile-status">notes to self</p>
            </div>

            <div className="tg-profile-stats">
              <button type="button" className="tg-profile-stat" onClick={() => setSharedTab('media')}>
                <span className="tg-profile-stat-count">{shared.media.length}</span>
                <span className="tg-profile-stat-label">Media</span>
              </button>
              <button type="button" className="tg-profile-stat" onClick={() => setSharedTab('files')}>
                <span className="tg-profile-stat-count">{shared.files.length}</span>
                <span className="tg-profile-stat-label">Files</span>
              </button>
              <button type="button" className="tg-profile-stat" onClick={() => setSharedTab('links')}>
                <span className="tg-profile-stat-count">{shared.links.length}</span>
                <span className="tg-profile-stat-label">Links</span>
              </button>
            </div>
          </div>
        </div>

        <ContactSharedSheet
          open={sharedTab != null}
          tab={sharedTab ?? 'media'}
          contactId={contactId}
          contactAlias={savedContact.alias}
          shared={shared}
          onClose={() => setSharedTab(null)}
          onOpenMessage={(messageId) => {
            setSharedTab(null);
            navigate(`/chat/${encodeURIComponent(contactId)}?msg=${encodeURIComponent(messageId)}`);
          }}
        />
      </PhoneShell>
    );
  }

  if (!contact) {
    return (
      <PhoneShell>
        <div className="screen-pad">Contact not found</div>
      </PhoneShell>
    );
  }

  const exportBlocked = isContactExportBlocked(contact);
  const exportBlockForPeer = isExportBlockForPeerActive(contact);

  const handleExportBlockToggle = () => {
    if (!exportBlockForPeer) {
      setExportBlockSheet('enable');
      return;
    }
    if (!canDisableExportBlockForPeer(contact.exportBlockForPeerAt)) {
      setExportBlockSheet('locked');
      return;
    }
    setExportBlockSheet('disable');
  };

  const confirmExportBlockSheet = () => {
    if (exportBlockSheet === 'enable') {
      setContactExportBlocked(contactId, true);
      show('Export blocked for contact');
      setExportBlockSheet(null);
      return;
    }
    if (exportBlockSheet === 'disable') {
      const ok = setContactExportBlocked(contactId, false);
      show(ok ? 'Export allowed for contact' : 'Export block is still active');
      setExportBlockSheet(null);
    }
  };

  const saveNote = () => {
    setContactNote(contactId, noteDraft);
    show('Note saved');
    setNoteOpen(false);
  };

  const exportChat = async () => {
    if (exportBlocked) {
      show('Export is blocked for this chat');
      return;
    }
    try {
      await downloadChatExport(contact, thread);
      show('Chat exported');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const handleInvite = () => {
    show('Invitation sent');
  };

  const toggleBlock = () => {
    if (contact.blocked) {
      unblockContact(contactId);
      show('Contact unblocked');
      return;
    }
    setBlockOpen(true);
  };

  return (
    <PhoneShell showHome={false}>
      <div className="tg-profile-screen">
        <header className="tg-profile-header">
          <button
            type="button"
            className="nav-back"
            onClick={() => navigate(-1)}
          >
            <BackIcon />
          </button>
          <h1>Info</h1>
          <button type="button" className="tg-profile-edit-btn" onClick={() => setRenameOpen(true)}>
            Edit
          </button>
        </header>

        <div className="tg-profile-body">
          <div className="tg-profile-hero">
            <button type="button" className="tg-profile-avatar-btn" onClick={() => setAvatarOpen(true)} aria-label="Edit avatar">
              <div className="avatar tg-profile-avatar">{contact.avatar}</div>
            </button>
            <h2 className="tg-profile-name">{contactDisplayName(contact)}</h2>
            <p className="tg-profile-status">
              {contact.blocked ? 'Blocked' : contact.verified ? 'verified' : 'not verified'}
            </p>
            <ExpandableUserId userId={contact.userId} className="tg-profile-userid" />
          </div>

          <div className="tg-profile-stats">
            <button type="button" className="tg-profile-stat" onClick={() => setSharedTab('media')}>
              <span className="tg-profile-stat-count">{shared.media.length}</span>
              <span className="tg-profile-stat-label">Media</span>
            </button>
            <button type="button" className="tg-profile-stat" onClick={() => setSharedTab('files')}>
              <span className="tg-profile-stat-count">{shared.files.length}</span>
              <span className="tg-profile-stat-label">Files</span>
            </button>
            <button type="button" className="tg-profile-stat" onClick={() => setSharedTab('links')}>
              <span className="tg-profile-stat-count">{shared.links.length}</span>
              <span className="tg-profile-stat-label">Links</span>
            </button>
          </div>

          <div className="tg-profile-lists">
            <div className="tg-profile-group">
              <TgRow
                label="Note"
                value={contact.note ? contact.note.slice(0, 24) : 'Add'}
                onClick={() => setNoteOpen(true)}
              />
              {adminGroups.length > 0 && (
                <TgRow label="Add to group" onClick={() => setInviteOpen(true)} />
              )}
              <div className="tg-profile-row tg-profile-row--toggle">
                <span className="tg-profile-row-label">Block export</span>
                <ToggleSwitch
                  checked={exportBlockForPeer}
                  onChange={handleExportBlockToggle}
                  ariaLabel="Block chat export for contact"
                />
              </div>
              <TgRow label="Export chat" onClick={exportChat} disabled={exportBlocked} />
              <TgRow label="Clear chat" onClick={() => setClearOpen(true)} />
            </div>

            <div className="tg-profile-group">
              <TgRow
                label={contact.blocked ? 'Unblock' : 'Block'}
                onClick={toggleBlock}
                danger={!contact.blocked}
              />
              <TgRow label="Delete chat" onClick={() => setDeleteOpen(true)} danger />
            </div>
          </div>
        </div>
      </div>

      {noteOpen &&
        createPortal(
          <div className="share-contact-backdrop" onClick={() => setNoteOpen(false)} role="presentation">
            <div
              className="share-contact-sheet contact-note-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Note"
            >
              <div className="share-contact-handle" aria-hidden />
              <div className="notifications-sheet-header">
                <h2>Note</h2>
                <button type="button" className="create-group-close-btn" onClick={() => setNoteOpen(false)}>
                  ×
                </button>
              </div>
              <textarea
                className="contact-profile-note contact-note-sheet-input"
                placeholder="Private note…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                autoFocus
              />
              <button type="button" className="btn-primary contact-note-sheet-save" onClick={saveNote}>
                Save
              </button>
            </div>
          </div>,
          document.body,
        )}

      <InviteContactToGroupSheet
        open={inviteOpen}
        contactId={contactId}
        onClose={() => setInviteOpen(false)}
        onInvited={handleInvite}
      />

      <ContactSharedSheet
        open={sharedTab != null}
        tab={sharedTab ?? 'media'}
        contactId={contactId}
        contactAlias={contact.alias}
        shared={shared}
        onClose={() => setSharedTab(null)}
        onOpenMessage={(messageId) => {
          setSharedTab(null);
          navigate(`/chat/${encodeURIComponent(contactId)}?msg=${encodeURIComponent(messageId)}`);
        }}
      />

      <DeleteChatSheet
        open={blockOpen}
        contactName={contact.alias}
        title={`Block ${contact.alias}?`}
        message="They will not be able to message you. You will not be able to message them until you unblock."
        confirmLabel="Block"
        onClose={() => setBlockOpen(false)}
        onConfirm={() => {
          blockContact(contactId);
          setBlockOpen(false);
          show('Contact blocked');
        }}
      />

      <DeleteChatSheet
        open={clearOpen}
        contactName={contact.alias}
        title="Clear chat?"
        message="All messages in this chat will be removed from this device. The contact stays in your list."
        confirmLabel="Clear"
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearChatMessages(contactId);
          setClearOpen(false);
          show('Chat cleared');
        }}
      />

      <DeleteChatSheet
        open={deleteOpen}
        contactName={contact.alias}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteChat(contactId);
          setDeleteOpen(false);
          navigate('/chats');
        }}
      />

      <ExportBlockSheet
        open={exportBlockSheet != null}
        mode={exportBlockSheet ?? 'enable'}
        contactName={contact.alias}
        exportBlockForPeerAt={contact.exportBlockForPeerAt}
        onClose={() => setExportBlockSheet(null)}
        onConfirm={confirmExportBlockSheet}
      />

      <ContactRenameSheet
        open={renameOpen}
        initialName={contact.alias}
        onClose={() => setRenameOpen(false)}
        onSave={(name) => {
          const trimmed = name.trim();
          if (!trimmed) {
            show('Enter a name');
            return;
          }
          renameContact(contactId, trimmed);
          setRenameOpen(false);
          show('Contact renamed');
        }}
      />

      <ContactAvatarEditorSheet
        open={avatarOpen}
        current={contact.avatar}
        onClose={() => setAvatarOpen(false)}
        onSave={(avatar) => {
          setContactAvatar(contactId, avatar);
          show('Avatar updated');
        }}
      />
    </PhoneShell>
  );
}
