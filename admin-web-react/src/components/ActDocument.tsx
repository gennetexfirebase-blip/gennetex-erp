import reportLogo from '../assets/report-logo.png';
import type { Act, ActDraft, ActPhoto, ActReceiver, ActTemplate } from '../lib/acts';
import './act-document.css';

type PrintableAct = Act | (ActDraft & { act_number?: string; created_at?: string });

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()} оны ${date.getMonth() + 1} сарын ${date.getDate()}`;
}

function chunks<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output.length ? output : [[]];
}

function Header({ template }: { template?: ActTemplate }) {
  return (
    <header className="act-paper-header">
      <img src={template?.logo_url || reportLogo} alt="Gennetex" />
    </header>
  );
}

function Footer({ template, page, total }: { template?: ActTemplate; page: number; total: number }) {
  return (
    <footer className="act-paper-footer">
      <div className="act-footer-line" />
      <span>{template?.footer_text || 'Ажил хүлээлцэх акт'}</span>
      <span>хуудас {page} / {total}</span>
    </footer>
  );
}

function Shell({ children, template, page, total, className = '' }: { children: React.ReactNode; template?: ActTemplate; page: number; total: number; className?: string }) {
  return (
    <section className={`act-paper ${className}`} data-act-page={page}>
      <Header template={template} />
      <main className="act-paper-body">{children}</main>
      <Footer template={template} page={page} total={total} />
    </section>
  );
}

function receiverGroupKey(receiver: ActReceiver) {
  return `${receiver.type}|${receiver.audience_type}|${receiver.organization.trim().toLocaleLowerCase('mn')}`;
}

function groupReceivers(receivers: ActReceiver[]) {
  const groups = new Map<string, ActReceiver[]>();
  receivers.filter((receiver) => receiver.is_enabled !== false).forEach((receiver) => {
    const key = receiverGroupKey(receiver);
    groups.set(key, [...(groups.get(key) || []), receiver]);
  });
  return [...groups.values()];
}

function receiverGroupLabel(receiver: ActReceiver) {
  const organization = receiver.organization || (receiver.type === 'contractor' ? 'Женнетекс ХХК' : receiver.type === 'nextmind' ? 'Нексмайнд' : 'Байгууллага');
  const subject = /бүс$/i.test(organization) ? `${organization}ийг` : `${organization}-г`;
  if (receiver.type === 'contractor') return `${subject} төлөөлж хүлээлгэн өгсөн:`;
  return `${subject} төлөөлөн хүлээж авсан:`;
}

function ReceiverBlock({ act }: { act: PrintableAct }) {
  const receivers = (act.receivers || []).filter((receiver) => receiver.is_enabled !== false);
  if (!receivers.length) return null;
  return (
    <div className="act-receivers">
      {groupReceivers(receivers).map((group, groupIndex) => {
        return <section className="act-receiver-group" key={`${receiverGroupKey(group[0])}-${groupIndex}`}>
          <h3>{receiverGroupLabel(group[0])}</h3>
          <div className="act-receiver-lines">
            {group.map((receiver, index) => <div className={`act-receiver-signature-row ${receiver.stamp_preview_url || receiver.stamp_url ? 'act-receiver-signature-row-stamped' : ''}`} key={`${receiver.id || receiver.contact_id || receiver.name}-${index}`}>
              <b>{receiver.position || 'Албан тушаал'}</b>
              <span className={`act-signature-slot ${receiver.stamp_preview_url || receiver.stamp_url ? 'act-signature-slot-stamped' : ''}`}>
                {receiver.stamp_preview_url || receiver.stamp_url
                  ? <img className="act-director-stamp" src={receiver.stamp_preview_url || receiver.stamp_url} alt={`${receiver.name} тамга`} />
                  : receiver.signature_preview_url || receiver.signature_url
                    ? <img src={receiver.signature_preview_url || receiver.signature_url} alt={`${receiver.name} гарын үсэг`} />
                    : <i aria-label="Гарын үсгийн зураас" />}
              </span>
              <span className="act-receiver-name">/{receiver.name || 'Нэр'}/</span>
            </div>)}
          </div>
        </section>;
      })}
    </div>
  );
}

function PhotoGrid({ photos, layout, startIndex }: { photos: ActPhoto[]; layout: 1 | 2 | 4; startIndex: number }) {
  return (
    <div className={`act-photo-grid act-photo-grid-${layout}`}>
      {photos.map((photo, index) => (
        <figure key={`${photo.storage_path || photo.image_url}-${index}`}>
          <div><img src={photo.preview_url || photo.image_url} alt={photo.caption || `Зураг ${startIndex + index + 1}`} /></div>
          <figcaption>
            <b>Зураг {startIndex + index + 1}{photo.caption ? ` (${photo.caption})` : ''}</b>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function actPageCount(act: PrintableAct) {
  const materialPages = Math.max(1, Math.ceil((act.materials?.length || 0) / 10));
  const checklistPages = Math.max(1, Math.ceil((act.checklists?.length || 0) / 11));
  const photoPages = Math.ceil((act.photos?.length || 0) / (act.photo_layout || 1));
  return materialPages + checklistPages + photoPages;
}

export default function ActDocument({ act, template, onlyPage }: { act: PrintableAct; template?: ActTemplate; onlyPage?: number }) {
  const materialGroups = chunks(act.materials || [], 10);
  const checklistGroups = chunks(act.checklists || [], 11);
  const photoGroups = chunks(act.photos || [], act.photo_layout || 1).filter((group) => group.length);
  const total = materialGroups.length + checklistGroups.length + photoGroups.length;
  let page = 0;
  const pages: React.ReactNode[] = [];

  materialGroups.forEach((materials, groupIndex) => {
    page += 1;
    const current = page;
    pages.push(
      <Shell key={`materials-${groupIndex}`} template={template} page={current} total={total}>
        {groupIndex === 0 ? (
          <>
            <div className="act-title-row"><h1>{template?.title || (act.act_type === 'work_handover' ? 'Ажил хүлээлцэх акт' : 'Ажил гүйцэтгэлийн акт')}</h1><span>{act.act_number || 'ACT-YYYY-0000'}</span></div>
            <dl className="act-details">
              <div><dt>1. Хаяг / Байршил:</dt><dd>{act.location || act.project_name || '—'}</dd></div>
              <div><dt>2. Гүйцэтгэгч компанийн нэр:</dt><dd>{act.contractor_name || 'Женнетекс ХХК'}</dd></div>
              <div><dt>3. Захиалагч байгууллага:</dt><dd>{act.customer_name || '—'}</dd></div>
              <div><dt>4. Гүйцэтгэсэн ажил:</dt><dd>{act.work_description || '—'}</dd></div>
              <div><dt>5. Ажил эхэлсэн хугацаа:</dt><dd>{formatDate(act.start_date)}</dd></div>
              <div><dt>6. Ажил дууссан хугацаа:</dt><dd>{formatDate(act.end_date)}</dd></div>
            </dl>
          </>
        ) : <h2 className="act-section-title">Зарцуулсан материал — үргэлжлэл</h2>}
        <h2 className="act-section-title">Байранд зарцуулсан материалын хэмжээ</h2>
        <table className="act-table">
          <thead><tr><th>№</th><th>Бараа материал</th><th>Хэмжих нэгж</th><th>Тоо хэмжээ</th></tr></thead>
          <tbody>
            {materials.length ? materials.map((item, index) => (
              <tr key={`${item.material_id || item.material_name}-${index}`}><td>{groupIndex * 10 + index + 1}</td><td>{item.material_name}</td><td>{item.unit}</td><td>{item.quantity}</td></tr>
            )) : <tr><td colSpan={4} className="act-empty-cell">Материал бүртгээгүй</td></tr>}
          </tbody>
        </table>
      </Shell>
    );
  });

  checklistGroups.forEach((items, groupIndex) => {
    page += 1;
    const current = page;
    pages.push(
      <Shell key={`check-${groupIndex}`} template={template} page={current} total={total}>
        <h2 className="act-section-title act-section-title-large">Ажил гүйцэтгэхдээ баримтлах шаардлагууд</h2>
        <table className="act-table act-check-table">
          <thead><tr><th>№</th><th>Шаардлага</th><th>Тийм</th><th>Үгүй</th><th>N/A</th><th>Шалтгаан</th></tr></thead>
          <tbody>
            {items.length ? items.map((item, index) => (
              <tr key={`${item.requirement}-${index}`}>
                <td>{groupIndex * 11 + index + 1}</td><td>{item.requirement}</td>
                <td>{item.result === 'yes' ? '✓' : ''}</td><td>{item.result === 'no' ? 'X' : ''}</td><td>{item.result === 'na' ? 'X' : ''}</td><td>{item.reason || '—'}</td>
              </tr>
            )) : <tr><td colSpan={6} className="act-empty-cell">Шалгах хуудас сонгоогүй</td></tr>}
          </tbody>
        </table>
        {groupIndex === checklistGroups.length - 1 ? <ReceiverBlock act={act} /> : null}
      </Shell>
    );
  });

  photoGroups.forEach((photos, groupIndex) => {
    page += 1;
    const current = page;
    pages.push(
      <Shell key={`photos-${groupIndex}`} template={template} page={current} total={total} className="act-photo-page">
        <h2 className="act-section-title act-section-title-large">Ажлын зураг</h2>
        <PhotoGrid photos={photos} layout={act.photo_layout || 1} startIndex={groupIndex * (act.photo_layout || 1)} />
      </Shell>
    );
  });

  return <div className="act-document">{onlyPage ? pages[onlyPage - 1] || pages[0] : pages}</div>;
}
