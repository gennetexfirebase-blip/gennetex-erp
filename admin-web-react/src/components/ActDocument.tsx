import { useLayoutEffect, useRef } from 'react';
import reportLogo from '../assets/report-logo.png';
import type { Act, ActChecklist, ActDraft, ActInventoryItem, ActMaterial, ActPhoto, ActReceiver, ActTemplate } from '../lib/acts';
import './act-document.css';

type PrintableAct = Act | (ActDraft & { act_number?: string; created_at?: string });

type CustomerOption = { label: string; organization: string };

/** Editor горим — актыг яг хэвлэгдэх загвар дээр нь шууд бөглөнө. */
export type ActDocumentEdit = {
  onChange: (value: Partial<ActDraft>) => void;
  inventory?: ActInventoryItem[];
  customers?: CustomerOption[];
  onChooseCustomer?: (option: CustomerOption) => void;
  onRemovePhoto?: (index: number) => void;
  onDropFiles?: (files: File[]) => void;
  onEditReceivers?: () => void;
  /** Зөвхөн зураг нэмэх эрхтэй (материал, шалгах хуудас, зургийн тайлбар түгжээтэй). */
  photosLocked?: boolean;
};

const MATERIALS_PER_PAGE = 10;
const CHECKLIST_PER_PAGE = 11;

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

function EditText({ value, onChange, placeholder, multiline, className = '', disabled, list, type, label }: {
  value: string | number; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; className?: string; disabled?: boolean; list?: string; type?: string; label?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  if (multiline) return <textarea ref={ref} rows={1} aria-label={label} className={`act-edit-input ${className}`} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
  return <input type={type} list={list} aria-label={label} className={`act-edit-input ${className}`} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}

/** Огноог актад хэвлэгдэх “2026 оны 10 сарын 5” хэлбэрээр харуулж, дарахад сонгогч нээгдэнэ. */
function EditDate({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <span className="act-edit-date">
    <span className={value ? '' : 'act-edit-placeholder'}>{value ? formatDate(value) : 'Огноо сонгох'}</span>
    <input type="date" aria-label={label} value={value ? value.slice(0, 10) : ''} onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* дэмжихгүй browser */ } }} onChange={(event) => onChange(event.target.value)} />
  </span>;
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="act-edit-remove" aria-label={label} title={label} onClick={onClick}>×</button>;
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
      <span>{page ? `хуудас ${page} / ${total}` : ''}</span>
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

function ReceiverBlock({ act, onEdit }: { act: PrintableAct; onEdit?: () => void }) {
  const receivers = (act.receivers || []).filter((receiver) => receiver.is_enabled !== false);
  if (!receivers.length) return onEdit ? <button type="button" className="act-edit-add act-edit-receivers-empty" onClick={onEdit}>+ Хүлээлцэх хүмүүс нэмэх</button> : null;
  return (
    <div className={`act-receivers ${onEdit ? 'act-edit-receivers' : ''}`}>
      {onEdit ? <button type="button" className="act-edit-chip" onClick={onEdit}>Хүлээлцэх хүмүүс засах</button> : null}
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

function PhotoGrid({ photos, layout, startIndex, edit, allPhotos }: { photos: ActPhoto[]; layout: 1 | 2 | 4; startIndex: number; edit?: ActDocumentEdit; allPhotos?: ActPhoto[] }) {
  const editable = Boolean(edit && !edit.photosLocked && allPhotos);
  const setCaption = (index: number, caption: string) => edit?.onChange({ photos: allPhotos!.map((photo, photoIndex) => photoIndex === index ? { ...photo, caption } : photo) });
  const swap = (source: number, target: number) => {
    if (source === target || !allPhotos) return;
    const next = [...allPhotos];
    [next[source], next[target]] = [next[target], next[source]];
    edit?.onChange({ photos: next });
  };
  return (
    <div className={`act-photo-grid act-photo-grid-${layout}`}>
      {photos.map((photo, index) => {
        const position = startIndex + index;
        return (
          <figure key={`${photo.storage_path || photo.image_url}-${index}`}
            className={editable ? 'act-edit-photo' : undefined}
            draggable={editable}
            onDragStart={editable ? (event) => event.dataTransfer.setData('text/act-photo', String(position)) : undefined}
            onDragOver={editable ? (event) => event.preventDefault() : undefined}
            onDrop={editable ? (event) => {
              const source = event.dataTransfer.getData('text/act-photo');
              if (source === '') return;
              event.preventDefault(); event.stopPropagation(); swap(Number(source), position);
            } : undefined}>
            <div>
              <img src={photo.preview_url || photo.image_url} alt={photo.caption || `Зураг ${position + 1}`} />
              {editable && edit?.onRemovePhoto ? <RemoveButton label={`Зураг ${position + 1} устгах`} onClick={() => edit.onRemovePhoto!(position)} /> : null}
            </div>
            <figcaption>
              {editable
                ? <b className="act-edit-caption">Зураг {position + 1}<EditText multiline label={`Зураг ${position + 1}-ийн тайлбар`} value={photo.caption} placeholder="(тайлбар бичих)" onChange={(caption) => setCaption(position, caption)} /></b>
                : <b>Зураг {position + 1}{photo.caption ? ` (${photo.caption})` : ''}</b>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export function actPageCount(act: PrintableAct) {
  const materialPages = Math.max(1, Math.ceil((act.materials?.length || 0) / MATERIALS_PER_PAGE));
  const checklistPages = Math.max(1, Math.ceil((act.checklists?.length || 0) / CHECKLIST_PER_PAGE));
  const photoPages = Math.ceil((act.photos?.length || 0) / (act.photo_layout || 1));
  return materialPages + checklistPages + photoPages;
}

export default function ActDocument({ act, template, onlyPage, edit }: { act: PrintableAct; template?: ActTemplate; onlyPage?: number; edit?: ActDocumentEdit }) {
  const materialGroups = chunks(act.materials || [], MATERIALS_PER_PAGE);
  const checklistGroups = chunks(act.checklists || [], CHECKLIST_PER_PAGE);
  const photoGroups = chunks(act.photos || [], act.photo_layout || 1).filter((group) => group.length);
  const total = materialGroups.length + checklistGroups.length + photoGroups.length;
  const rowsLocked = Boolean(edit?.photosLocked);
  let page = 0;
  const pages: React.ReactNode[] = [];

  const setMaterial = (index: number, value: Partial<ActMaterial>) => edit?.onChange({ materials: act.materials.map((row, rowIndex) => rowIndex === index ? { ...row, ...value } : row) });
  const setMaterialName = (index: number, name: string) => {
    const item = edit?.inventory?.find((row) => row.name === name);
    setMaterial(index, item ? { material_id: item.id, material_name: item.name, unit: item.unit } : { material_name: name, material_id: null });
  };
  const addMaterial = () => edit?.onChange({ materials: [...act.materials, { material_id: null, material_name: '', unit: 'ширхэг', quantity: 1 }] });
  const removeMaterial = (index: number) => edit?.onChange({ materials: act.materials.filter((_, rowIndex) => rowIndex !== index) });
  const setCheck = (index: number, value: Partial<ActChecklist>) => edit?.onChange({ checklists: act.checklists.map((row, rowIndex) => rowIndex === index ? { ...row, ...value } : row) });
  const addCheck = () => edit?.onChange({ checklists: [...act.checklists, { requirement: '', result: 'na', reason: '' }] });
  const removeCheck = (index: number) => edit?.onChange({ checklists: act.checklists.filter((_, rowIndex) => rowIndex !== index) });
  const customerKnown = Boolean(edit?.customers?.some((option) => option.label === act.customer_name));

  const detail = (label: string, view: React.ReactNode, editor?: React.ReactNode) => <div><dt>{label}</dt><dd>{edit && editor && !rowsLocked ? editor : view}</dd></div>;

  materialGroups.forEach((materials, groupIndex) => {
    page += 1;
    const current = page;
    const isLast = groupIndex === materialGroups.length - 1;
    pages.push(
      <Shell key={`materials-${groupIndex}`} template={template} page={current} total={total}>
        {groupIndex === 0 ? (
          <>
            <div className="act-title-row"><h1>{template?.title || (act.act_type === 'work_handover' ? 'Ажил хүлээлцэх акт' : 'Ажил гүйцэтгэлийн акт')}</h1><span>{act.act_number || 'ACT-YYYY-0000'}</span></div>
            <dl className="act-details">
              {detail('1. Хаяг / Байршил:', act.location || act.project_name || '—',
                <EditText multiline label="Хаяг / Байршил" value={act.location} placeholder={act.project_name || 'Хаяг, байршил'} onChange={(location) => edit!.onChange({ location })} />)}
              {detail('2. Гүйцэтгэгч компанийн нэр:', act.contractor_name || 'Женнетекс ХХК',
                <EditText label="Гүйцэтгэгч компани" value={act.contractor_name} placeholder="Женнетекс ХХК" onChange={(contractor_name) => edit!.onChange({ contractor_name })} />)}
              {detail('3. Захиалагч байгууллага:', act.customer_name || '—', edit?.customers?.length
                ? <select className="act-edit-input act-edit-select" aria-label="Захиалагч байгууллага" value={customerKnown ? act.customer_name : ''} onChange={(event) => { const option = edit.customers!.find((row) => row.label === event.target.value); if (option) edit.onChooseCustomer?.(option); }}>
                    <option value="" disabled>{act.customer_name && !customerKnown ? `${act.customer_name} — сонгоно уу` : 'Захиалагч сонгох'}</option>
                    {edit.customers.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                  </select>
                : <EditText label="Захиалагч байгууллага" value={act.customer_name} placeholder="Захиалагч" onChange={(customer_name) => edit!.onChange({ customer_name })} />)}
              {detail('4. Гүйцэтгэсэн ажил:', act.work_description || '—',
                <EditText multiline label="Гүйцэтгэсэн ажил" value={act.work_description} placeholder="Гүйцэтгэсэн ажлын тайлбар" onChange={(work_description) => edit!.onChange({ work_description })} />)}
              {detail('5. Ажил эхэлсэн хугацаа:', formatDate(act.start_date),
                <EditDate label="Ажил эхэлсэн хугацаа" value={act.start_date} onChange={(start_date) => edit!.onChange({ start_date })} />)}
              {detail('6. Ажил дууссан хугацаа:', formatDate(act.end_date),
                <EditDate label="Ажил дууссан хугацаа" value={act.end_date} onChange={(end_date) => edit!.onChange({ end_date })} />)}
            </dl>
          </>
        ) : <h2 className="act-section-title">Зарцуулсан материал — үргэлжлэл</h2>}
        <h2 className="act-section-title">Байранд зарцуулсан материалын хэмжээ</h2>
        <table className={`act-table ${edit ? 'act-edit-table' : ''}`}>
          <thead><tr><th>№</th><th>Бараа материал</th><th>Хэмжих нэгж</th><th>Тоо хэмжээ</th></tr></thead>
          <tbody>
            {materials.map((item, index) => {
              const position = groupIndex * MATERIALS_PER_PAGE + index;
              const issued = Boolean(item.source_transaction_id);
              return edit ? (
                <tr key={`${item.material_id || 'manual'}-${position}`}>
                  <td>{position + 1}</td>
                  <td><EditText multiline label={`${position + 1}-р материал`} list={edit.inventory?.length ? 'act-inventory-options' : undefined} value={item.material_name} placeholder="Бараа материал" disabled={issued || rowsLocked} onChange={(name) => setMaterialName(position, name)} />{issued ? <span className="act-edit-note">✓ зарлага бүртгэгдсэн</span> : null}</td>
                  <td><EditText label={`${position + 1}-р материалын нэгж`} value={item.unit} disabled={rowsLocked} onChange={(unit) => setMaterial(position, { unit })} /></td>
                  <td><EditText type="number" label={`${position + 1}-р материалын тоо`} value={item.quantity} disabled={issued || rowsLocked} onChange={(quantity) => setMaterial(position, { quantity: Number(quantity) })} />{!rowsLocked ? <RemoveButton label={`${position + 1}-р материал устгах`} onClick={() => removeMaterial(position)} /> : null}</td>
                </tr>
              ) : <tr key={`${item.material_id || item.material_name}-${index}`}><td>{position + 1}</td><td>{item.material_name}</td><td>{item.unit}</td><td>{item.quantity}</td></tr>;
            })}
            {!materials.length && !edit ? <tr><td colSpan={4} className="act-empty-cell">Материал бүртгээгүй</td></tr> : null}
            {edit && isLast && !rowsLocked ? <tr className="act-edit-add-row"><td colSpan={4}><button type="button" className="act-edit-add" onClick={addMaterial}>+ Материал нэмэх</button></td></tr> : null}
          </tbody>
        </table>
        {edit?.inventory?.length && groupIndex === 0 ? <datalist id="act-inventory-options">{edit.inventory.map((item) => <option key={item.id} value={item.name}>{`үлдэгдэл ${item.quantity} ${item.unit}`}</option>)}</datalist> : null}
      </Shell>
    );
  });

  checklistGroups.forEach((items, groupIndex) => {
    page += 1;
    const current = page;
    const isLast = groupIndex === checklistGroups.length - 1;
    pages.push(
      <Shell key={`check-${groupIndex}`} template={template} page={current} total={total}>
        <h2 className="act-section-title act-section-title-large">Ажил гүйцэтгэхдээ баримтлах шаардлагууд</h2>
        <table className={`act-table act-check-table ${edit ? 'act-edit-table' : ''}`}>
          <thead><tr><th>№</th><th>Шаардлага</th><th>Тийм</th><th>Үгүй</th><th>N/A</th><th>Шалтгаан</th></tr></thead>
          <tbody>
            {items.map((item, index) => {
              const position = groupIndex * CHECKLIST_PER_PAGE + index;
              if (!edit) return (
                <tr key={`${item.requirement}-${index}`}>
                  <td>{position + 1}</td><td>{item.requirement}</td>
                  <td>{item.result === 'yes' ? '✓' : ''}</td><td>{item.result === 'no' ? 'X' : ''}</td><td>{item.result === 'na' ? 'X' : ''}</td><td>{item.reason || '—'}</td>
                </tr>
              );
              const mark = (result: ActChecklist['result'], symbol: string, label: string) => (
                <td className="act-edit-mark-cell">
                  <button type="button" className={`act-edit-mark ${item.result === result ? 'is-on' : ''}`} aria-pressed={item.result === result} aria-label={`${position + 1}-р шаардлага: ${label}`} disabled={rowsLocked} onClick={() => setCheck(position, { result })}>{item.result === result ? symbol : ''}</button>
                </td>
              );
              const missingReason = item.result === 'no' && !item.reason.trim();
              return (
                <tr key={`check-${position}`}>
                  <td>{position + 1}</td>
                  <td><EditText multiline label={`${position + 1}-р шаардлага`} value={item.requirement} placeholder="Шаардлага" disabled={rowsLocked} onChange={(requirement) => setCheck(position, { requirement })} /></td>
                  {mark('yes', '✓', 'Тийм')}{mark('no', 'X', 'Үгүй')}{mark('na', 'X', 'N/A')}
                  <td className={missingReason ? 'act-edit-required' : undefined}><EditText multiline label={`${position + 1}-р шаардлагын шалтгаан`} value={item.reason} placeholder={item.result === 'no' ? 'Шалтгаан заавал' : '—'} disabled={rowsLocked} onChange={(reason) => setCheck(position, { reason })} />{!rowsLocked ? <RemoveButton label={`${position + 1}-р шаардлага устгах`} onClick={() => removeCheck(position)} /> : null}</td>
                </tr>
              );
            })}
            {!items.length && !edit ? <tr><td colSpan={6} className="act-empty-cell">Шалгах хуудас сонгоогүй</td></tr> : null}
            {edit && isLast && !rowsLocked ? <tr className="act-edit-add-row"><td colSpan={6}><button type="button" className="act-edit-add" onClick={addCheck}>+ Шаардлага нэмэх</button></td></tr> : null}
          </tbody>
        </table>
        {isLast ? <ReceiverBlock act={act} onEdit={edit?.onEditReceivers} /> : null}
      </Shell>
    );
  });

  photoGroups.forEach((photos, groupIndex) => {
    page += 1;
    const current = page;
    pages.push(
      <Shell key={`photos-${groupIndex}`} template={template} page={current} total={total} className="act-photo-page">
        <h2 className="act-section-title act-section-title-large">Ажлын зураг</h2>
        <PhotoGrid photos={photos} layout={act.photo_layout || 1} startIndex={groupIndex * (act.photo_layout || 1)} edit={edit} allPhotos={act.photos} />
      </Shell>
    );
  });

  if (edit?.onDropFiles) {
    const drop = edit.onDropFiles;
    pages.push(
      <Shell key="photos-add" template={template} page={0} total={total} className="act-photo-page act-edit-photo-add">
        <h2 className="act-section-title act-section-title-large">Ажлын зураг</h2>
        <label className="act-edit-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); drop(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))); }}>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { drop(Array.from(event.target.files || [])); event.target.value = ''; }} />
          <b>+ Зураг нэмэх</b>
          <span>Зургаа энд чирж оруулах эсвэл дарж сонгоно уу</span>
        </label>
      </Shell>
    );
  }

  return <div className={`act-document ${edit ? 'act-document-edit' : ''}`}>{onlyPage ? pages[onlyPage - 1] || pages[0] : pages}</div>;
}
