import { CallInIcon, CallOutIcon, PhoneIcon } from '../Icons';
import type { CallRecord } from '../../lib/calls';
import { formatCallHistoryMeta, isMissedCall } from '../../lib/calls';
import type { Contact } from '../../lib/types';

export function CallListRow({
  record,
  contact,
  onCall,
}: {
  record: CallRecord;
  contact: Contact | undefined;
  onCall: () => void;
}) {
  const missed = isMissedCall(record);
  const metaColor = missed ? '#E5867B' : '#9C9C9A';
  const nameColor = missed ? '#E5867B' : '#F4F4F3';
  const DirectionIcon = record.direction === 'incoming' ? CallInIcon : CallOutIcon;
  const iconColor = missed ? '#E5867B' : record.direction === 'incoming' ? '#7FB88A' : '#9C9C9A';

  return (
    <button type="button" className="call-history-row" onClick={onCall}>
      <div className="avatar" style={{ width: 44, height: 44, fontSize: 14 }}>
        {contact?.avatar ?? '?'}
      </div>
      <div className="call-history-row-body">
        <div className="call-history-row-info">
          <div className="call-history-row-name" style={{ color: nameColor }}>
            {contact?.alias ?? 'Unknown'}
          </div>
          <div className="call-history-row-meta" style={{ color: metaColor }}>
            <DirectionIcon color={iconColor} />
            <span>{formatCallHistoryMeta(record)}</span>
          </div>
        </div>
        <PhoneIcon size={21} color="#9C9C9A" />
      </div>
    </button>
  );
}
