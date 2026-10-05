import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CircleAlert,
  CloudDownload, Download, FileText, ImagePlus, PackageOpen, Plus, Printer,
  Save, Signature, Trash2, Upload, Users, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import ActDocument, { actPageCount } from '../components/ActDocument';
import SignatureCanvas from '../components/SignatureCanvas';
import { Button, Card, EmptyState, Input, Loading, PageHeader, Select } from '../components/ui';
import { fetchEmployees, type Employee } from '../lib/data';
import {
  ACT_STATUS_LABELS, actError, addActPhoto, emptyActDraft, fetchAct, fetchActInventory, fetchActReceiverContacts, fetchActSources, fetchActTemplates,
  fetchSourceSnapshot, issueActMaterials, logActExport, normalizeSourceMaterials, normalizeSourcePhotos, removeActImage,
  saveAct, saveActReceiverContact, snapshotDraft, transitionAct, uploadActImage, type Act, type ActChecklist, type ActDraft, type ActInventoryItem,
  type ActMaterial, type ActPhoto, type ActReceiver, type ActReceiverContact, type ActSource, type ActTemplate,
} from '../lib/acts';

const STEPS = [
  ['Үндсэн мэдээлэл', FileText], ['Хүлээлцэх хүмүүс', Users], ['Урьдчилан харах', FileText], ['PDF / Word', Download],
] as const;

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-muted">{label}{required ? <b className="ml-1 text-danger">*</b> : null}</span>{children}</label>;
}

const HANDOVER_GROUP = 'gennetex_handover';
/** Захирал — Мөнхбат, Баярхүүг зөвхөн энэ имэйлээр нэвтэрсэн хүн нэмнэ (superadmin эрхтэй хамаагүй). */
const DIRECTOR_EMAIL = 'bayasgalan.gennetex@gmail.com';

const isDirectorContact = (contact: ActReceiverContact) => contact.preset_group === HANDOVER_GROUP && /захирал/i.test(contact.position || '');

/** Женнетексийн Захирал — акт бүрт нэр нь автоматаар орно. Тамга нь зөвхөн
 *  Захирал өөрөө баталгаажуулахад (DB trigger) гарын үсгийн хэсэгт гарна. */
function directorContacts(contacts: ActReceiverContact[]): ActReceiverContact[] {
  return contacts.filter((contact) => contact.is_active && isDirectorContact(contact));
}

/** Женнетексийн хүлээлгэн өгөх инженерүүд (Мөнхбат, Баярхүү) — зөвхөн
 *  Захирал гараар нэмнэ, автоматаар орохгүй. */
function handoverContacts(contacts: ActReceiverContact[]): ActReceiverContact[] {
  return contacts.filter((contact) => contact.is_active && contact.preset_group === HANDOVER_GROUP && !isDirectorContact(contact));
}

function hasHandover(receivers: ActReceiver[], contacts: ActReceiverContact[]): boolean {
  const ids = new Set(handoverContacts(contacts).map((contact) => contact.id));
  return receivers.some((receiver) => receiver.contact_id && ids.has(receiver.contact_id));
}

function buildReceivers(contacts: ActReceiverContact[], current: ActReceiver[] = []): ActReceiver[] {
  return contacts
    .slice()
    .sort((a, b) => {
      const groupOrder = Number(a.preset_group === HANDOVER_GROUP) - Number(b.preset_group === HANDOVER_GROUP);
      return groupOrder || a.sort_order - b.sort_order;
    })
    .map((contact) => {
      const previous = current.find((receiver) => receiver.contact_id === contact.id)
        || current.find((receiver) => receiver.organization === contact.organization && receiver.name === contact.name);
      return {
        type: contact.receiver_type,
        contact_id: contact.id,
        audience_type: contact.audience_type,
        is_enabled: true,
        organization: contact.organization.trim(),
        employee_id: contact.employee_id,
        name: contact.name,
        position: contact.position,
        signature_url: previous?.signature_url || contact.signature_url || '',
        // Женнетексийн тамга автоматаар орохгүй — Захирал баталгаажуулахад DB дээр нэмэгдэнэ.
        stamp_url: contact.preset_group === HANDOVER_GROUP ? previous?.stamp_url || '' : contact.preset_group ? contact.stamp_url || '' : previous?.stamp_url || contact.stamp_url || '',
        signature_preview_url: previous?.signature_preview_url || contact.signature_url || '',
        stamp_preview_url: contact.preset_group === HANDOVER_GROUP ? previous?.stamp_preview_url || '' : contact.preset_group ? contact.stamp_url || '' : previous?.stamp_preview_url || contact.stamp_url || '',
        signature_mode: previous?.signature_mode || (contact.signature_url ? 'upload' : 'none'),
      };
    });
}

/** Хүлээн авах байгууллагуудын жагсаалт — лавлахаас динамикаар (Женнетексийн
 *  хүлээлгэн өгөх бүрэлдэхүүнийг оруулахгүй). */
function receiverOrganizations(contacts: ActReceiverContact[]): string[] {
  const names = contacts
    .filter((contact) => contact.is_active && contact.preset_group !== HANDOVER_GROUP && contact.organization.trim())
    .map((contact) => contact.organization.trim());
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'mn'));
}

type CustomerOption = { label: string; organization: string };

/** “Захиалагч байгууллага”-ын сонголт — лавлахаас: байгууллага бол өөрийн
 *  нэрээр (Нексмайнд ХХК), өрх бол компанийн нэрээр (Юнивишн ХХК Төвийн бүс →
 *  Юнивишн ХХК) харагдаж, сонгоход тухайн бүрэлдэхүүн орно. */
function customerOptions(contacts: ActReceiverContact[]): CustomerOption[] {
  const options = new Map<string, CustomerOption>();
  contacts
    .filter((contact) => contact.is_active && contact.preset_group !== HANDOVER_GROUP && contact.organization.trim())
    .sort((a, b) => Number(a.audience_type === 'household') - Number(b.audience_type === 'household') || a.sort_order - b.sort_order)
    .forEach((contact) => {
      const organization = contact.organization.trim();
      const label = contact.audience_type === 'household'
        ? organization.match(/^.*?\s(?:Х?ХК|LLC)(?=\s|$)/i)?.[0] || organization
        : organization;
      if (!options.has(label)) options.set(label, { label, organization });
    });
  return [...options.values()];
}

/** Захиалагчийн нэрээс хүлээн авах байгууллага / өрхийг автоматаар тааруулна.
 *  Сонголттой таарвал түүний бүрэлдэхүүн; хувь хүн бол лавлах дахь өрх. */
function autoReceiverOrganization(contacts: ActReceiverContact[], customer: string): string {
  const options = customerOptions(contacts);
  const name = customer.trim().toLocaleLowerCase('mn');
  if (name) {
    const matched = options.find((option) => [option.label, option.organization].some((value) => {
      const text = value.toLocaleLowerCase('mn');
      const head = text.split(/\s+/)[0];
      return text === name || text.startsWith(name) || name.startsWith(text) || (head.length > 2 && name.includes(head));
    }));
    if (matched) return matched.organization;
  }
  const household = contacts.find((contact) => contact.is_active && contact.audience_type === 'household' && contact.preset_group !== HANDOVER_GROUP);
  return household?.organization.trim() || '';
}

/** Сонгосон байгууллагын хүмүүс + Женнетексийн Захирал. Мөнхбат, Баярхүүг
 *  Захирал аль хэдийн нэмсэн бол хэвээр үлдэнэ. */
function receiversFromOrganization(contacts: ActReceiverContact[], organization: string, current: ActReceiver[] = []): ActReceiver[] {
  const keepHandover = hasHandover(current, contacts);
  const selected = contacts.filter((contact) => contact.is_active
    && (isDirectorContact(contact) || (contact.preset_group === HANDOVER_GROUP ? keepHandover : contact.organization.trim() === organization.trim())));
  return buildReceivers(selected, current);
}

/** Тамга дарах эрхгүй хэрэглэгч автоматаар орсон тамгыг аваагүй байна —
 *  зөвхөн гарын үсэг үлдэнэ. */
function withoutStamps(receivers: ActReceiver[]): ActReceiver[] {
  return receivers.map((receiver) => ({ ...receiver, stamp_url: '', stamp_preview_url: '' }));
}

function asPrintable(draft: ActDraft, template?: ActTemplate): Act {
  return {
    ...draft,
    id: draft.id || 'preview', act_number: draft.act_number || 'ACT-YYYY-0000', status: draft.status || 'draft',
    created_by: '', created_by_name: null, created_at: '', updated_at: '', version: 1,
    template, audit: [],
  } as Act;
}

export default function ActEditorPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { profile } = useOutletContext<{ profile: { role?: string; email?: string | null; permissions?: Record<string, boolean> } }>();
  const routeId = params.id;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ActDraft>(() => emptyActDraft());
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [sources, setSources] = useState<ActSource[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [receiverContacts, setReceiverContacts] = useState<ActReceiverContact[]>([]);
  const [inventory, setInventory] = useState<ActInventoryItem[]>([]);
  const [erpPhotos, setErpPhotos] = useState<ActPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [toast, setToast] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');
  const [photoModal, setPhotoModal] = useState(false);
  const [selectedErpPhotos, setSelectedErpPhotos] = useState<Set<string>>(new Set());
  const [signatureIndex, setSignatureIndex] = useState<number | null>(null);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState('');
  const [zoom, setZoom] = useState(() => window.innerWidth < 640 ? .38 : .8);
  const [previewPage, setPreviewPage] = useState(1);
  const [exporting, setExporting] = useState('');
  const [forceApprovedEdit, setForceApprovedEdit] = useState(false);
  const [issueConfirm, setIssueConfirm] = useState(false);
  const [receiverOrg, setReceiverOrg] = useState('');
  const hydrated = useRef(false);
  const lastSaved = useRef('');
  const isAdmin = ['admin', 'superadmin'].includes(profile?.role || '') || Boolean(profile?.permissions?.['acts.delete']);
  const isSuperAdmin = profile?.role === 'superadmin';
  const isDirector = String(profile?.email || '').trim().toLowerCase() === DIRECTOR_EMAIL;
  const canFullEdit = ['menejer', 'manager', 'admin', 'superadmin'].includes(profile?.role || '') || Boolean(profile?.permissions?.['acts.edit']);
  const canStamp = Boolean(profile?.permissions?.['acts.stamp']) || profile?.role === 'superadmin';
  const locked = ['approved', 'delivered'].includes(draft.status || '') && !forceApprovedEdit;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [templateRows, sourceRows, employeeRows, inventoryRows, contactRows] = await Promise.all([
          fetchActTemplates(), fetchActSources(), fetchEmployees(), fetchActInventory().catch(() => []), fetchActReceiverContacts().catch(() => []),
        ]);
        setTemplates(templateRows); setSources(sourceRows); setEmployees(employeeRows); setInventory(inventoryRows); setReceiverContacts(contactRows);
        if (routeId) {
          const act = await fetchAct(routeId);
          const value = snapshotDraft(act);
          setDraft(value); lastSaved.current = JSON.stringify(value);
          if (!canFullEdit) setStep(0);
          if (act.source_type !== 'manual' && act.source_id) {
            fetchSourceSnapshot(act.source_type, act.source_id).then((snapshot) => setErpPhotos(normalizeSourcePhotos(snapshot.photos))).catch(() => null);
          }
        } else {
          const defaultTemplate = templateRows.find((row) => row.is_default) || templateRows[0];
          const value = emptyActDraft(defaultTemplate);
          value.receivers = buildReceivers(directorContacts(contactRows));
          setDraft(value); lastSaved.current = JSON.stringify(value);
        }
        hydrated.current = true;
      } catch (cause) { setToast(actError(cause)); }
      finally { setLoading(false); }
    })();
  }, [routeId]);

  useEffect(() => {
    if (!hydrated.current || !draft.id || locked || !canFullEdit) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSaved.current) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        await saveAct(draft.id, draft, forceApprovedEdit);
        lastSaved.current = serialized; setSaveState('saved');
      } catch (cause) { setSaveState('error'); setToast(actError(cause)); }
    }, 950);
    return () => clearTimeout(timer);
  }, [draft, locked, forceApprovedEdit, canFullEdit]);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer); }, [toast]);

  const template = useMemo(() => templates.find((row) => row.id === draft.template_id) || templates.find((row) => row.is_default) || templates[0], [templates, draft.template_id]);
  const printable = useMemo(() => asPrintable(draft, template), [draft, template]);
  const totalPages = actPageCount(printable);
  useEffect(() => { setPreviewPage((page) => Math.min(Math.max(1, page), totalPages)); }, [totalPages]);

  const patch = (value: Partial<ActDraft>) => setDraft((current) => ({ ...current, ...value }));
  const chooseTemplate = (id: string) => {
    const next = templates.find((row) => row.id === id);
    if (!next) return;
    patch({ template_id: id, contractor_name: next.company || draft.contractor_name, photo_layout: next.photo_layout,
      checklists: (next.configuration?.checklist || []).map((requirement) => ({ requirement, result: 'na', reason: '' })) });
  };

  const chooseSource = async (key: string) => {
    if (!key) return;
    const [sourceType, sourceId] = key.split(':');
    setLoading(true);
    try {
      const snapshot = await fetchSourceSnapshot(sourceType, sourceId);
      const matchingTemplate = templates.find((row) => row.project_types?.includes(snapshot.project_type || '')) || templates.find((row) => row.is_default) || templates[0];
      const base = emptyActDraft(matchingTemplate);
      const autoReceivers = receiversFromOrganization(receiverContacts, autoReceiverOrganization(receiverContacts, snapshot.customer_name || ''));
      base.receivers = canStamp ? autoReceivers : withoutStamps(autoReceivers);
      const next: ActDraft = {
        ...base, source_type: sourceType as ActDraft['source_type'], source_id: sourceId,
        project_name: snapshot.project_name || '', project_type: snapshot.project_type || '',
        customer_name: snapshot.customer_name || '', location: snapshot.location || '',
        work_description: snapshot.work_description || '', start_date: snapshot.start_date || '', end_date: snapshot.end_date || '',
        materials: normalizeSourceMaterials(snapshot.materials),
      };
      setErpPhotos(normalizeSourcePhotos(snapshot.photos));
      const id = await saveAct(undefined, next);
      const saved = await fetchAct(id);
      const value = snapshotDraft(saved); setDraft(value); lastSaved.current = JSON.stringify(value); setSaveState('saved');
      navigate(`/admin/documents/acts/${id}/edit`, { replace: true });
      setToast('Акт амжилттай үүслээ');
    } catch (cause) { setToast(actError(cause)); }
    finally { setLoading(false); }
  };

  const createManual = async () => {
    setLoading(true);
    try {
      const value = { ...draft, source_type: 'manual' as const, source_id: null };
      const id = await saveAct(undefined, value); const saved = await fetchAct(id); const next = snapshotDraft(saved);
      setDraft(next); lastSaved.current = JSON.stringify(next); navigate(`/admin/documents/acts/${id}/edit`, { replace: true }); setToast('Ноорог акт үүслээ');
    } catch (cause) { setToast(actError(cause)); } finally { setLoading(false); }
  };

  const persist = async () => {
    if (!draft.id) throw new Error('Эхлээд төсөл / объект сонгоно уу.');
    setSaveState('saving'); await saveAct(draft.id, draft, forceApprovedEdit); lastSaved.current = JSON.stringify(draft); setSaveState('saved'); return draft.id;
  };

  const importSourceMaterials = async (sourceType: ActSource['source_type'], sourceId: string) => {
    try {
      const snapshot = await fetchSourceSnapshot(sourceType, sourceId);
      const materials = normalizeSourceMaterials(snapshot.materials);
      patch({ source_type: sourceType, source_id: sourceId, materials });
      setErpPhotos(normalizeSourcePhotos(snapshot.photos));
      setToast(materials.length ? `${materials.length} материал ERP-с татагдлаа` : 'Энэ ERP source-д зарлагдсан материал олдсонгүй.');
    } catch (cause) { setToast(actError(cause)); }
  };

  const pullMaterials = async () => {
    if (draft.source_id && draft.source_type !== 'manual') {
      await importSourceMaterials(draft.source_type, draft.source_id);
      return;
    }
    const normalize = (value?: string | null) => (value || '').trim().toLocaleLowerCase('mn');
    const projectName = normalize(draft.project_name);
    const exactMatches = sources.filter((source) => projectName && [source.project_name, source.customer_name, source.location].some((value) => normalize(value) === projectName));
    if (exactMatches.length === 1) {
      await importSourceMaterials(exactMatches[0].source_type, exactMatches[0].source_id);
      return;
    }
    setToast('Материал татах ERP төсөл / ажлын захиалгаа сонгоно уу.');
  };

  const uploadPhotos = async (files: File[]) => {
    if (!draft.id) { setToast('Эхлээд төсөл / объект сонгож Draft үүсгэнэ үү.'); return; }
    setExporting('Зураг байршуулж байна...');
    try {
      const uploaded = await Promise.all(files.map(async (file): Promise<ActPhoto> => {
        const result = await uploadActImage(draft.id!, file, 'photos');
        return { storage_path: result.storagePath, image_url: '', preview_url: result.signedUrl, caption: '', taken_at: '', taken_by_employee_id: null, taken_by_employee_name: '', source_kind: 'upload', source_id: null };
      }));
      if (!canFullEdit) await Promise.all(uploaded.map((photo) => addActPhoto(draft.id!, photo)));
      patch({ photos: [...draft.photos, ...uploaded] }); setToast(`${uploaded.length} зураг нэмэгдлээ`);
    } catch (cause) { setToast(actError(cause)); } finally { setExporting(''); }
  };

  const issueMaterials = async () => {
    if (!draft.id) return;
    setIssueConfirm(false);
    setExporting('Агуулахаас зарлага гаргаж байна...');
    try {
      await persist();
      const result = await issueActMaterials(draft.id);
      const saved = await fetchAct(draft.id);
      const next = snapshotDraft(saved);
      setDraft(next); lastSaved.current = JSON.stringify(next); setSaveState('saved');
      setInventory(await fetchActInventory().catch(() => inventory));
      setToast(result.issued_count ? `${result.issued_count} төрлийн материал агуулахаас хасагдлаа` : 'Бүх материал өмнө нь зарлага болсон байна.');
    } catch (cause) { setToast(actError(cause)); }
    finally { setExporting(''); }
  };

  const removePhoto = async (index: number) => {
    const photo = draft.photos[index];
    if (photo.storage_path) await removeActImage(photo.storage_path).catch(() => null);
    patch({ photos: draft.photos.filter((_, photoIndex) => photoIndex !== index) });
  };

  const addErpPhotos = async () => {
    const additions = erpPhotos.filter((photo) => selectedErpPhotos.has(photo.image_url));
    const existing = new Set(draft.photos.map((photo) => photo.image_url));
    const unique = additions.filter((photo) => !existing.has(photo.image_url));
    try {
      if (!canFullEdit && draft.id) await Promise.all(unique.map((photo) => addActPhoto(draft.id!, photo)));
      patch({ photos: [...draft.photos, ...unique] });
      setPhotoModal(false); setSelectedErpPhotos(new Set()); setToast(`${unique.length} ERP зураг сонголоо`);
    } catch (cause) { setToast(actError(cause)); }
  };

  const uploadReceiverFile = async (index: number, kind: 'signature' | 'stamp', file: File) => {
    if (!draft.id) return;
    try {
      const result = await uploadActImage(draft.id, file, kind === 'signature' ? 'signatures' : 'stamps');
      const receivers = [...draft.receivers];
      receivers[index] = { ...receivers[index], ...(kind === 'signature' ? { signature_url: result.storagePath, signature_preview_url: result.signedUrl, signature_mode: 'upload' as const } : { stamp_url: result.storagePath, stamp_preview_url: result.signedUrl }) };
      patch({ receivers });
    } catch (cause) { setToast(actError(cause)); }
  };

  const saveDrawnSignature = async () => {
    if (signatureIndex === null || !signatureBlob || !draft.id) return;
    try {
      const result = await uploadActImage(draft.id, signatureBlob, 'signatures'); const receivers = [...draft.receivers];
      receivers[signatureIndex] = { ...receivers[signatureIndex], signature_url: result.storagePath, signature_preview_url: result.signedUrl || signaturePreview, signature_mode: 'draw' };
      patch({ receivers }); setSignatureIndex(null); setSignatureBlob(null); setSignaturePreview('');
    } catch (cause) { setToast(actError(cause)); }
  };

  const updateReceiver = (index: number, value: Partial<ActReceiver>) => { const rows = [...draft.receivers]; rows[index] = { ...rows[index], ...value }; patch({ receivers: rows }); };
  const addReceiver = () => patch({ receivers: [...draft.receivers, {
    type: 'custom', contact_id: null, audience_type: 'organization', is_enabled: false,
    organization: '', employee_id: null, name: '', position: '', signature_url: '', stamp_url: '', signature_mode: 'none',
  }] });
  const removeReceiver = (index: number) => patch({ receivers: draft.receivers.filter((_, rowIndex) => rowIndex !== index) });
  const chooseEmployee = (index: number, employeeId: string) => {
    const employee = employees.find((row) => row.user_id === employeeId || row.record_id === employeeId);
    updateReceiver(index, { contact_id: null, employee_id: employee?.user_id || null, name: [employee?.last_name, employee?.name].filter(Boolean).join(' '), position: employee?.position || '' });
  };
  const chooseReceiverContact = (index: number, contactId: string) => {
    const contact = receiverContacts.find((row) => row.id === contactId);
    if (!contact) { updateReceiver(index, { contact_id: null }); return; }
    updateReceiver(index, {
      contact_id: contact.id, audience_type: contact.audience_type, organization: contact.organization,
      employee_id: contact.employee_id, name: contact.name, position: contact.position,
      signature_url: contact.signature_url, stamp_url: contact.stamp_url,
      signature_preview_url: contact.signature_url, stamp_preview_url: contact.stamp_url,
      signature_mode: contact.signature_url ? 'upload' : 'none',
    });
  };
  const storeReceiverContact = async (index: number) => {
    const receiver = draft.receivers[index];
    if (!isSuperAdmin || !receiver) return;
    try {
      const master = receiverContacts.find((contact) => contact.id === receiver.contact_id);
      const contactId = await saveActReceiverContact({
        id: receiver.contact_id || undefined,
        audience_type: receiver.audience_type,
        preset_group: master?.preset_group || null,
        receiver_type: receiver.type,
        sort_order: master?.sort_order || 0,
        organization: receiver.organization,
        name: receiver.name,
        position: receiver.position,
        employee_id: receiver.employee_id,
        signature_url: master?.signature_url || '',
        stamp_url: master?.stamp_url || '',
        is_active: true,
      });
      const contacts = await fetchActReceiverContacts();
      setReceiverContacts(contacts);
      updateReceiver(index, { contact_id: contactId });
      setToast(receiver.contact_id ? 'Хүлээлцэх хүний лавлах мэдээлэл шинэчлэгдлээ' : 'Хүлээлцэх хүн лавлахад хадгалагдлаа');
    } catch (cause) { setToast(actError(cause)); }
  };
  const applyReceiverOrganization = (organization: string) => {
    setReceiverOrg(organization);
    if (!organization) return;
    const matched = receiversFromOrganization(receiverContacts, organization, draft.receivers);
    if (!matched.length) { setToast(`${organization}-ийн хүлээлцэх бүрэлдэхүүн лавлахад олдсонгүй.`); return; }
    patch({ receivers: canStamp ? matched : withoutStamps(matched) });
    setToast(`${organization}-ийн бүрэлдэхүүн автоматаар орлоо`);
  };
  /** Захиалагч сонгоход хүлээн авах бүрэлдэхүүн (Нексмайнд → байгууллага, Юнивишн → өрх) өөрөө орно. */
  const chooseCustomer = (option: CustomerOption) => {
    patch({ customer_name: option.label });
    applyReceiverOrganization(option.organization);
  };
  /** Мөнхбат, Баярхүү — зөвхөн Захирал нэмнэ. */
  const addHandover = () => {
    if (!isDirector) return;
    const existing = new Set(draft.receivers.map((receiver) => receiver.contact_id).filter(Boolean));
    const added = buildReceivers(handoverContacts(receiverContacts).filter((contact) => !existing.has(contact.id)), draft.receivers);
    if (!added.length) { setToast('Женнетексийн хүлээлгэн өгөх бүрэлдэхүүн аль хэдийн орсон байна'); return; }
    patch({ receivers: [...draft.receivers, ...(canStamp ? added : withoutStamps(added))] });
  };

  const action = async (kind: 'ready' | 'approve' | 'deliver' | 'archive') => {
    try {
      const id = await persist();
      if (kind === 'approve') {
        const invalid = draft.checklists.find((item) => item.result === 'no' && !item.reason.trim());
        if (invalid) { setStep(0); throw new Error('“Үгүй” гэж сонгосон шаардлагын шалтгааныг оруулна уу.'); }
      }
      await transitionAct(id, kind); const saved = await fetchAct(id); const next = snapshotDraft(saved); setDraft(next); lastSaved.current = JSON.stringify(next); setToast(`Төлөв: ${ACT_STATUS_LABELS[saved.status]}`);
    } catch (cause) { setToast(actError(cause)); }
  };

  const exportFile = async (format: 'pdf' | 'docx' | 'print') => {
    if (!draft.id) return;
    setExporting(format === 'pdf' ? 'PDF үүсгэж байна...' : format === 'docx' ? 'Word үүсгэж байна...' : 'Хэвлэхэд бэлтгэж байна...');
    try {
      await persist(); const act = await fetchAct(draft.id); const currentTemplate = templates.find((row) => row.id === act.template_id);
      if (format === 'pdf') { const { downloadActPdf } = await import('../lib/actExport'); await downloadActPdf(act, currentTemplate); }
      else if (format === 'docx') { const { downloadActDocx } = await import('../lib/actExport'); await downloadActDocx(act, currentTemplate); }
      else { await logActExport(act.id, 'print'); setTimeout(() => window.print(), 100); return; }
      await logActExport(act.id, format); setToast(`${format === 'pdf' ? 'PDF' : 'Word'} файл бэлэн боллоо`);
    } catch (cause) { setToast(actError(cause)); } finally { setExporting(''); }
  };

  const customers = useMemo(() => customerOptions(receiverContacts), [receiverContacts]);
  /** Захиалагч (Нексмайнд / Юнивишн) сонгосон бол хүлээлцэх хүмүүс автоматаар
   *  орох тул тэр алхам харагдахгүй — зөвхөн Захирал (инженер нэмэх) харна. */
  const hideReceivers = !isDirector && customers.some((option) => option.label === draft.customer_name);
  const visibleSteps = STEPS.map((_, index) => index).filter((index) => !(hideReceivers && index === 1));
  const moveStep = (direction: 1 | -1) => setStep((value) => {
    const position = visibleSteps.indexOf(value);
    const next = visibleSteps[Math.min(visibleSteps.length - 1, Math.max(0, (position < 0 ? 0 : position) + direction))];
    return next ?? value;
  });
  useEffect(() => { if (hideReceivers && step === 1) setStep(2); }, [hideReceivers, step]);

  /** Зураг оруулаад “Дараах” дарахад draft акт автоматаар “Бэлэн” болно. */
  const goNext = async () => {
    if (step === 0 && draft.status === 'draft' && draft.photos.length > 0 && canFullEdit && !locked) await action('ready');
    moveStep(1);
  };

  const organizations = useMemo(() => receiverOrganizations(receiverContacts), [receiverContacts]);
  const activeReceiverOrg = receiverOrg || autoReceiverOrganization(receiverContacts, draft.customer_name || '');
  const hasCustomerReceivers = draft.receivers.some((receiver) => receiver.type !== 'contractor');
  const canAutoFill = Boolean(draft.id) && !locked && canFullEdit;
  // Захиалагч тодорхой болмогц хүлээн авах бүрэлдэхүүнийг өөрөө бөглөнө.
  const missingDirector = directorContacts(receiverContacts).some((contact) => !draft.receivers.some((receiver) => receiver.contact_id === contact.id));
  useEffect(() => {
    if (!canAutoFill) return;
    if (hasCustomerReceivers || !activeReceiverOrg) {
      if (missingDirector) patch({ receivers: [...draft.receivers, ...buildReceivers(directorContacts(receiverContacts).filter((contact) => !draft.receivers.some((receiver) => receiver.contact_id === contact.id)))] });
      return;
    }
    const matched = receiversFromOrganization(receiverContacts, activeReceiverOrg, draft.receivers);
    if (matched.length) patch({ receivers: canStamp ? matched : withoutStamps(matched) });
  }, [canAutoFill, hasCustomerReceivers, activeReceiverOrg, receiverContacts, missingDirector]);

  const visibleSources = sources.filter((source) => !sourceSearch.trim() || `${source.project_name} ${source.customer_name} ${source.location}`.toLocaleLowerCase('mn').includes(sourceSearch.trim().toLocaleLowerCase('mn'))).slice(0, 100);
  if (loading) return <Loading text="Актын мэдээлэл ачаалж байна..." />;

  return (
    <div className="act-editor-shell">
      <PageHeader title={draft.act_number || 'Шинэ акт'} crumb="Баримт бичиг / Ажил гүйцэтгэлийн акт" description={draft.project_name || 'Төсөл сонгож актын мэдээллийг бөглөнө үү.'} actions={<>
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/admin/documents/acts')}>Жагсаалт</Button>
        <span className={`inline-flex h-9 items-center rounded-[7px] border px-3 text-[12px] font-medium ${saveState === 'error' ? 'border-danger/20 bg-danger-soft text-danger' : 'border-success/20 bg-success-soft text-success'}`}>{saveState === 'saving' ? 'Хадгалж байна...' : saveState === 'saved' ? '✓ Автоматаар хадгалагдлаа' : saveState === 'error' ? 'Хадгалж чадсангүй' : draft.status ? ACT_STATUS_LABELS[draft.status] : ACT_STATUS_LABELS.draft}</span>
      </>} />

      {locked ? <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning-soft p-4 text-[13px] text-warning"><span className="flex items-center gap-2"><CircleAlert size={18} />Баталгаажсан актыг өөрчлөх гэж байна. Snapshot түгжээтэй.</span>{isAdmin ? <Button variant="outline" onClick={() => setForceApprovedEdit(true)}>Админ эрхээр засах</Button> : null}</div> : null}

      <nav aria-label="Акт үүсгэх алхам" className="mb-5 overflow-x-auto border-b border-line">
        <ol className="flex min-w-max gap-6">{STEPS.map(([label], index) => {
          if (hideReceivers && index === 1) return null;
          const position = visibleSteps.indexOf(index);
          const state = index === step ? 'current' : index < step ? 'done' : 'todo';
          return <li key={label}>
            <button disabled={!draft.id && index > 0} onClick={() => setStep(index)} aria-current={state === 'current' ? 'step' : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${state === 'current' ? 'border-brand font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold tabular-nums ${state === 'current' ? 'bg-brand text-white' : state === 'done' ? 'bg-success-soft text-success' : 'bg-card2 text-subtle ring-1 ring-line'}`}>{state === 'done' ? <Check size={12} strokeWidth={2.5} /> : position + 1}</span>
              {label}
            </button>
          </li>;
        })}</ol>
      </nav>

      {step === 0 ? (!draft.id
        ? <SourcePicker sources={visibleSources} sourceSearch={sourceSearch} setSourceSearch={setSourceSearch} chooseSource={chooseSource} createManual={createManual} />
        : <div className="space-y-4">
          <EditorToolbar
            draft={draft} patch={patch} templates={templates} chooseTemplate={chooseTemplate} sources={sources}
            fieldsLocked={locked || !canFullEdit} photosLocked={locked} addOnly={!canFullEdit}
            onSource={(key) => { const [sourceType, sourceId] = key.split(':'); if (sourceId) void importSourceMaterials(sourceType as ActSource['source_type'], sourceId); }}
            onPull={pullMaterials} onIssue={() => setIssueConfirm(true)} onUpload={uploadPhotos} onOpenErp={() => setPhotoModal(true)}
          />
          <fieldset disabled={locked} className="min-w-0">
            <FitToWidth>
              <ActDocument act={printable} template={template} edit={{
                onChange: patch, inventory, customers, onChooseCustomer: chooseCustomer,
                onRemovePhoto: removePhoto, onDropFiles: locked ? undefined : uploadPhotos,
                onEditReceivers: hideReceivers ? undefined : () => setStep(1),
                photosLocked: locked || !canFullEdit,
              }} />
            </FitToWidth>
          </fieldset>
        </div>) : null}
      {step === 1 ? <fieldset disabled={locked || !canFullEdit} className="min-w-0 disabled:opacity-75"><ReceiversStep rows={draft.receivers} employees={employees} contacts={receiverContacts} isSuperAdmin={isSuperAdmin} canStamp={canStamp} organizations={organizations} organization={activeReceiverOrg} onChooseOrganization={applyReceiverOrganization} onAddHandover={isDirector ? addHandover : undefined} isDirector={isDirector} onAdd={addReceiver} onRemove={removeReceiver} onChange={updateReceiver} onChooseEmployee={chooseEmployee} onChooseContact={chooseReceiverContact} onSaveContact={storeReceiverContact} onUpload={uploadReceiverFile} onDraw={(index) => setSignatureIndex(index)} /></fieldset> : null}
      {step === 2 ? <PreviewStep act={printable} template={template} zoom={zoom} setZoom={setZoom} page={previewPage} setPage={setPreviewPage} total={totalPages} /> : null}
      {step === 3 ? <ExportStep draft={draft} exporting={exporting} onExport={exportFile} onAction={action} onEdit={() => setStep(0)} /> : null}

      <div className="sticky bottom-0 z-10 -mx-3 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[var(--bg-app)]/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 xl:-mx-8 xl:px-8">
        <Button className="flex-1 sm:flex-none" variant="outline" icon={<ChevronLeft size={16} />} disabled={step === 0} onClick={() => moveStep(-1)}>Өмнөх</Button>
        <div className="flex flex-1 gap-2 sm:flex-none">{draft.id && canFullEdit ? <Button className="flex-1 sm:flex-none" variant="outline" icon={<Save size={16} />} onClick={() => persist().then(() => setToast('Хадгалагдлаа')).catch((cause) => setToast(actError(cause)))}>Хадгалах</Button> : null}<Button className="flex-1 sm:flex-none" icon={<ArrowRight size={16} />} disabled={!draft.id || step === STEPS.length - 1} onClick={goNext}>Дараах</Button></div>
      </div>

      {photoModal ? <ErpPhotoModal photos={erpPhotos} selected={selectedErpPhotos} setSelected={setSelectedErpPhotos} onClose={() => setPhotoModal(false)} onAdd={addErpPhotos} /> : null}
      {signatureIndex !== null ? <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(35,38,36,0.42)] p-4 backdrop-blur-[2px]"><div className="surface w-full max-w-xl p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Гарын үсэг зурах</h2><button onClick={() => setSignatureIndex(null)} className="rounded-md p-1 text-muted hover:bg-hover"><X /></button></div><SignatureCanvas onChange={(blob, preview) => { setSignatureBlob(blob); setSignaturePreview(preview); }} /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSignatureIndex(null)}>Болих</Button><Button disabled={!signatureBlob} icon={<Signature size={16} />} onClick={saveDrawnSignature}>Гарын үсэг хадгалах</Button></div></div></div> : null}
      {issueConfirm ? <div className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(35,38,36,0.42)] p-4 backdrop-blur-[2px]"><div className="surface w-full max-w-lg p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning"><CircleAlert size={20} /></span><div><h2 className="text-lg font-semibold text-ink">Агуулахаас зарлага гаргах уу?</h2><p className="mt-2 text-[13px] leading-6 text-muted">Актын материалын тоо хэмжээгээр агуулахын үлдэгдэл бодитоор хасагдаж, stock movement үүснэ. Өмнө нь зарлага болсон мөрийг дахин хасахгүй.</p></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setIssueConfirm(false)}>Болих</Button><Button variant="danger" icon={<PackageOpen size={16} />} onClick={issueMaterials}>Зарлага гаргах</Button></div></div></div> : null}
      {exporting ? <div className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(35,38,36,0.42)] p-4 backdrop-blur-[2px]"><div className="surface flex items-center gap-3 px-6 py-5 text-[14px] text-ink"><span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />{exporting}</div></div> : null}
      {toast ? <div className="app-toast fixed bottom-4 left-4 right-4 z-[130] max-w-md rounded-[var(--radius-sm)] border border-line bg-card px-4 py-3 text-[13px] text-ink shadow-panel sm:left-auto sm:right-6">{toast}</div> : null}
      <div className="act-print-root hidden print:block"><ActDocument act={printable} template={template} /></div>
    </div>
  );
}

function SourcePicker({ sources, sourceSearch, setSourceSearch, chooseSource, createManual }: {
  sources: ActSource[]; sourceSearch: string; setSourceSearch: (value: string) => void; chooseSource: (key: string) => void; createManual: () => void;
}) {
  return <Card title="Акт үүсгэх"><div className="rounded-[var(--radius)] border border-brand/25 bg-brand-soft p-4"><h3 className="font-semibold text-ink">Эхлээд төсөл / объект / ажлын захиалга сонгоно уу</h3><p className="mt-1 text-[12px] text-muted">ERP-ийн дуудлага эсвэл ажлын байрнаас захиалагч, хаяг, гүйцэтгэсэн ажил, огноо автоматаар бөглөгдөж, актын загвар дээр шууд нээгдэнэ.</p><div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]"><Input value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} placeholder="Төсөл хайх..." /><Select className="w-full" defaultValue="" onChange={(e) => chooseSource(e.target.value)}><option value="" disabled>Төсөл / Объект сонгох</option>{sources.map((source) => <option key={`${source.source_type}:${source.source_id}`} value={`${source.source_type}:${source.source_id}`}>{source.project_name} · {source.location || source.customer_name || ''} · {source.source_status || ''}</option>)}</Select><Button variant="outline" onClick={createManual}>Гараар үүсгэх</Button></div></div></Card>;
}

/** Актын хуудсан дээр харагдахгүй тохиргоо (загвар, төрөл, ERP эх сурвалж, зураг) — бусад бүх мэдээллийг доорх актын загвар дээр шууд бичнэ. */
function EditorToolbar({ draft, patch, templates, chooseTemplate, sources, fieldsLocked, photosLocked, addOnly, onSource, onPull, onIssue, onUpload, onOpenErp }: {
  draft: ActDraft; patch: (value: Partial<ActDraft>) => void; templates: ActTemplate[]; chooseTemplate: (id: string) => void; sources: ActSource[];
  fieldsLocked: boolean; photosLocked: boolean; addOnly: boolean;
  onSource: (key: string) => void; onPull: () => void; onIssue: () => void; onUpload: (files: File[]) => void; onOpenErp: () => void;
}) {
  const sourceKey = draft.source_id && draft.source_type !== 'manual' ? `${draft.source_type}:${draft.source_id}` : '';
  return (
    <Card bodyClassName="!p-3 sm:!p-4">
      <div className="space-y-3">
        <fieldset disabled={fieldsLocked} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]">
          <Field label="Актын загвар"><Select className="w-full" value={draft.template_id || ''} onChange={(e) => chooseTemplate(e.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field>
          <Field label="Актын төрөл"><Select className="w-full" value={draft.act_type} onChange={(e) => patch({ act_type: e.target.value as ActDraft['act_type'] })}><option value="work_completion">Ажил гүйцэтгэлийн акт</option><option value="work_handover">Ажил хүлээлцэх акт</option></Select></Field>
          <Field label="Аль компанид"><Input value={draft.project_name} onChange={(e) => patch({ project_name: e.target.value })} /></Field>
          <Field label="Материал татах ERP эх сурвалж"><Select className="w-full" value={sourceKey} onChange={(event) => onSource(event.target.value)}><option value="">ERP source сонгох</option>{sources.map((source) => <option key={`${source.source_type}:${source.source_id}`} value={`${source.source_type}:${source.source_id}`}>{source.project_name} · {source.location || source.customer_name || ''} · {source.source_status || ''}</option>)}</Select></Field>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <fieldset disabled={fieldsLocked} className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<CloudDownload size={16} />} onClick={onPull}>ERP-с материал татах</Button>
            <Button variant="outline" icon={<PackageOpen size={16} />} disabled={!draft.materials.length} onClick={onIssue}>Агуулахаас зарлага</Button>
          </fieldset>
          <fieldset disabled={photosLocked} className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button variant="outline" icon={<ImagePlus size={16} />} onClick={onOpenErp}>ERP-с зураг</Button>
            <label className={`focus-ring inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] bg-brand px-3 py-2.5 text-[12px] font-semibold text-white sm:px-4 sm:text-[13px] ${photosLocked ? 'pointer-events-none opacity-50' : ''}`}><Upload size={16} />Зураг нэмэх<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { onUpload(Array.from(event.target.files || [])); event.target.value = ''; }} /></label>
            {!addOnly ? <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-line p-0.5" role="group" aria-label="Нэг хуудсанд зураг">{([1, 2, 4] as const).map((value) => <button key={value} type="button" onClick={() => patch({ photo_layout: value })} className={`rounded-[5px] px-2.5 py-1.5 text-[12px] font-medium ${draft.photo_layout === value ? 'bg-brand text-white' : 'text-muted hover:bg-hover'}`}>{value} зураг</button>)}</div> : null}
          </fieldset>
        </div>
        <p className="text-[11px] text-muted">Доорх актын хуудсан дээр шууд бичнэ — хэвлэгдэх PDF / Word яг ийм харагдана. Тийм / Үгүй / N/A нүдийг дарж сонгоно.</p>
      </div>
    </Card>
  );
}

/** A4 хуудсыг дэлгэцийн өргөнд багтааж жижигрүүлнэ (бичих боломж хэвээр). */
function FitToWidth({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / 810)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="overflow-hidden rounded-[var(--radius)] bg-[#e6e1d6] p-2 sm:p-4 md:p-8"><div style={{ zoom: scale }}>{children}</div></div>;
}

function ReceiversStep({ rows, employees, contacts, isSuperAdmin, canStamp, organizations, organization, onChooseOrganization, onAddHandover, isDirector, onAdd, onRemove, onChange, onChooseEmployee, onChooseContact, onSaveContact, onUpload, onDraw }: {
  rows: ActReceiver[];
  employees: Employee[];
  contacts: ActReceiverContact[];
  isSuperAdmin: boolean;
  canStamp: boolean;
  organizations: string[];
  organization: string;
  onChooseOrganization: (organization: string) => void;
  onAddHandover?: () => void;
  isDirector: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: Partial<ActReceiver>) => void;
  onChooseEmployee: (index: number, id: string) => void;
  onChooseContact: (index: number, id: string) => void;
  onSaveContact: (index: number) => void;
  onUpload: (index: number, kind: 'signature'|'stamp', file: File) => void;
  onDraw: (index: number) => void;
}) {
  const labels: Record<ActReceiver['type'], string> = {
    customer: 'Захиалагч байгууллагыг төлөөлөн хүлээж авсан',
    site: 'Өрхийг төлөөлөн хүлээж авсан',
    contractor: 'Женнетекс ХХК-г төлөөлж хүлээлгэн өгсөн',
    nextmind: 'Нексмайнд байгууллагыг төлөөлөн хүлээж авсан',
    custom: 'Хүлээлцэх хүн',
  };
  return (
    <div className="space-y-4">
      <Card title="2. Хүлээлцэх хүмүүс" actions={<div className="flex flex-wrap gap-2">{onAddHandover ? <Button variant="ghost" icon={<Plus size={16} />} onClick={onAddHandover}>Женнетекс (Мөнхбат, Баярхүү)</Button> : null}<Button icon={<Plus size={16} />} onClick={onAdd}>Хүн нэмэх</Button></div>}>
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,420px)_1fr]">
          <Field label="Хүлээн авах байгууллага" required><Select className="w-full" value={organization} onChange={(event) => onChooseOrganization(event.target.value)}><option value="">Байгууллага сонгох</option>{organizations.map((name) => <option key={name} value={name}>{name}</option>)}</Select></Field>
          <p className="text-[12px] leading-5 text-muted">Захиалагчаас хамаарч байгууллага / өрх автоматаар сонгогдож, хүлээн авах хүмүүс нь өөрөө орно. Шаардлагатай бол өөр байгууллага сонгож болно. Женнетексийн хүлээлгэн өгөх инженерүүдийг зөвхөн Захирал нэмнэ. Доорх “Хадгалсан хүн” жагсаалтад зөвхөн энэ байгууллагын хүмүүс харагдана. Чагтласан хүн л урьдчилан харах, PDF, Word дээр гарна.</p>
        </div>
      </Card>
      {rows.map((receiver, index) => {
        const handoverRow = receiver.type === 'contractor';
        const availableContacts = contacts.filter((contact) => {
          if (contact.id === receiver.contact_id) return true;
          if (!contact.is_active) return false;
          if (contact.preset_group === HANDOVER_GROUP) return handoverRow && isDirector;
          if (handoverRow) return false;
          if (!organization) return true;
          return contact.organization.trim() === organization.trim();
        });
        const title = receiver.is_enabled ? labels[receiver.type] : `Хүлээлцэх хүн ${index + 1}`;
        const masterLocked = !isSuperAdmin && Boolean(receiver.contact_id);
        return (
          <Card
            key={`${receiver.id || receiver.contact_id || receiver.type}-${index}`}
            title={<label className="flex cursor-pointer items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={receiver.is_enabled} onChange={(event) => onChange(index, { is_enabled: event.target.checked })} /><span>{index + 1}. {title}</span></label>}
            actions={<Button aria-label={`${index + 1}-р хүлээлцэх хүн устгах`} variant="ghost" className="!p-2 !text-danger" onClick={() => onRemove(index)}><Trash2 size={16} /></Button>}
          >
            {receiver.is_enabled ? <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Хүлээлцэх хэсэг" required><Select className="w-full" value={receiver.type} onChange={(event) => {
                  const type = event.target.value as ActReceiver['type'];
                  const organization = type === 'contractor' ? 'Женнетекс ХХК' : type === 'nextmind' ? 'Нексмайнд' : receiver.organization;
                  onChange(index, { type, organization });
                }}><option value="customer">Захиалагч байгууллага</option><option value="site">Өрх</option><option value="contractor">Женнетекс ХХК</option><option value="nextmind">Нексмайнд</option><option value="custom">Бусад</option></Select></Field>
                <Field label="Хадгалсан хүн"><Select className="w-full" value={receiver.contact_id || ''} onChange={(event) => onChooseContact(index, event.target.value)}><option value="">Хадгалсан хүн сонгох</option>{availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.organization ? ` · ${contact.organization}` : ''}{contact.position ? ` · ${contact.position}` : ''}</option>)}</Select></Field>
                <Field label="ERP ажилтнаас сонгох"><Select className="w-full" value={receiver.employee_id || ''} onChange={(event) => onChooseEmployee(index, event.target.value)}><option value="">ERP ажилтан сонгох</option>{employees.map((employee) => <option key={employee.record_id} value={employee.user_id || employee.record_id}>{[employee.last_name, employee.name].filter(Boolean).join(' ')} · {employee.position || 'Албан тушаалгүй'}</option>)}</Select></Field>
                <Field label="Байгууллага / Өрх"><Input readOnly={masterLocked} value={receiver.organization} onChange={(event) => onChange(index, { organization: event.target.value })} /></Field>
                <Field label="Нэр" required><Input readOnly={masterLocked} value={receiver.name} onChange={(event) => onChange(index, { name: event.target.value })} /></Field>
                <Field label="Албан тушаал"><Input readOnly={masterLocked} value={receiver.position} onChange={(event) => onChange(index, { position: event.target.value })} /></Field>
                {isSuperAdmin ? <div className="flex items-end"><Button variant="outline" disabled={!receiver.name.trim()} onClick={() => onSaveContact(index)}>{receiver.contact_id ? 'Лавлах мэдээлэл шинэчлэх' : 'Лавлахад хадгалах'}</Button></div> : <div className="flex items-end"><p className="rounded-[var(--radius-sm)] bg-card2 px-3 py-2.5 text-[11px] text-muted">Мастер нэр, албан тушаалыг зөвхөн system admin засна.</p></div>}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[var(--radius-sm)] border border-line bg-card2 p-4"><p className="mb-3 text-[12px] font-semibold text-muted">Гарын үсэг</p><div className="flex flex-wrap gap-2"><label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line px-3 py-2 text-[12px] text-ink"><Upload size={15} />Upload<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => event.target.files?.[0] && onUpload(index, 'signature', event.target.files[0])} /></label><Button variant="outline" icon={<Signature size={15} />} onClick={() => onDraw(index)}>Зурах</Button><Button variant="ghost" onClick={() => onChange(index, { signature_mode: 'none', signature_url: '', signature_preview_url: '' })}>Гарын үсэггүй</Button></div>{receiver.signature_preview_url || receiver.signature_url ? <img className="mt-3 h-20 w-full object-contain object-left" src={receiver.signature_preview_url || receiver.signature_url} alt="Гарын үсэг" /> : null}</div>
                {canStamp ? <div className="rounded-[var(--radius-sm)] border border-line bg-card2 p-4"><p className="mb-1 text-[12px] font-semibold text-muted">Байгууллагын тамга</p><p className="mb-3 text-[11px] leading-4 text-muted">Тамга тухайн хүний гарын үсгийн оронд томоор байрлана. Женнетексийн master бүрэлдэхүүнд зөвхөн Захирал дээр автоматаар холбоно.</p><div className="flex flex-wrap gap-2"><label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line px-3 py-2 text-[12px] text-ink"><Upload size={15} />Тамга upload<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => event.target.files?.[0] && onUpload(index, 'stamp', event.target.files[0])} /></label>{receiver.stamp_preview_url || receiver.stamp_url ? <Button variant="ghost" onClick={() => onChange(index, { stamp_url: '', stamp_preview_url: '' })}>Тамга арилгах</Button> : null}</div>{receiver.stamp_preview_url || receiver.stamp_url ? <img className="mt-3 h-32 w-32 rounded bg-card object-contain p-1" src={receiver.stamp_preview_url || receiver.stamp_url} alt="Тамга" /> : null}</div> : <div className="rounded-[var(--radius-sm)] border border-dashed border-line bg-card2 p-4"><p className="mb-1 text-[12px] font-semibold text-muted">Байгууллагын тамга</p><p className="text-[11px] leading-4 text-muted">Танд тамга дарах эрх олгогдоогүй тул актад зөвхөн гарын үсэг гарна.</p></div>}
              </div>
            </> : <p className="rounded-[var(--radius-sm)] border border-dashed border-line bg-card2 px-4 py-5 text-center text-[12px] text-muted">Актанд оруулах бол дээрх checkbox-ийг сонгоно уу.</p>}
          </Card>
        );
      })}
      {!rows.length ? <EmptyState text="Хүлээлцэх хүн нэмээгүй байна. “Хүн нэмэх” товчоор нэмнэ үү." /> : null}
    </div>
  );
}

function PreviewStep({ act, template, zoom, setZoom, page, setPage, total }: { act: Act; template?: ActTemplate; zoom: number; setZoom: (value: number) => void; page: number; setPage: (value: number) => void; total: number }) {
  return <Card title="3. Урьдчилан харах" actions={<><Button aria-label="Жижигрүүлэх" variant="outline" className="!px-2" onClick={() => setZoom(Math.max(.3, zoom - .1))}><ZoomOut size={15} /></Button><span className="w-12 text-center text-[12px] font-medium text-muted">{Math.round(zoom * 100)}%</span><Button aria-label="Томруулах" variant="outline" className="!px-2" onClick={() => setZoom(Math.min(1.2, zoom + .1))}><ZoomIn size={15} /></Button><Button variant="ghost" onClick={() => setZoom(window.innerWidth < 640 ? .38 : .75)}>Хуудсанд тааруулах</Button></>} bodyClassName="!p-0"><div className="overflow-auto bg-[#e6e1d6] p-2 sm:p-4 md:p-8"><div style={{ width: `${210 * zoom}mm`, height: `${297 * zoom}mm`, margin: '0 auto' }}><div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: '210mm' }}><ActDocument act={act} template={template} onlyPage={page} /></div></div></div><div className="flex flex-wrap items-center justify-center gap-2 border-t border-line p-3 sm:gap-4"><Button variant="outline" icon={<ChevronLeft size={15} />} disabled={page <= 1} onClick={() => setPage(page - 1)}>Өмнөх</Button><span className="text-[13px] text-muted">Хуудас: <b className="text-ink">{page} / {total}</b></span><Button variant="outline" icon={<ChevronRight size={15} />} disabled={page >= total} onClick={() => setPage(page + 1)}>Дараах</Button></div></Card>;
}

function ExportStep({ draft, exporting, onExport, onAction, onEdit }: { draft: ActDraft; exporting: string; onExport: (format: 'pdf'|'docx'|'print') => void; onAction: (kind: 'ready'|'approve'|'deliver'|'archive') => void; onEdit: () => void }) {
  return <Card title="4. PDF / Word үүсгэх"><div className="grid gap-4 md:grid-cols-3"><ActionCard icon={<Download />} title="PDF татах" text="A4, Монгол кирилл, vector хүснэгт, page number, өндөр нягтралтай зураг." button={<Button disabled={Boolean(exporting)} onClick={() => onExport('pdf')}>PDF татах</Button>} /><ActionCard icon={<FileText />} title="Word татах" text="Editable text/table, image, signature, header/footer бүхий DOCX." button={<Button variant="outline" disabled={Boolean(exporting)} onClick={() => onExport('docx')}>Word татах</Button>} /><ActionCard icon={<Printer />} title="Хэвлэх" text="ERP navigation нууж зөвхөн A4 баримтыг хэвлэнэ." button={<Button variant="outline" disabled={Boolean(exporting)} onClick={() => onExport('print')}>Хэвлэх</Button>} /></div><div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5"><Button variant="outline" onClick={onEdit}>Засах</Button><Button variant="outline" onClick={() => onAction('ready')}>Бэлэн болгох</Button><Button variant="success" onClick={() => onAction('approve')}>Баталгаажуулах</Button>{draft.status === 'approved' ? <Button onClick={() => onAction('deliver')}>Хүлээлгэн өгөх</Button> : null}<Button variant="ghost" onClick={() => onAction('archive')}>Архивлах</Button></div></Card>;
}

function ActionCard({ icon, title, text, button }: { icon: React.ReactNode; title: string; text: string; button: React.ReactNode }) { return <div className="rounded-[var(--radius)] border border-line bg-card p-5 shadow-sm"><span className="mb-4 grid h-10 w-10 place-items-center rounded-lg border border-blue-100 bg-brand-soft text-brand">{icon}</span><h3 className="font-semibold text-ink">{title}</h3><p className="mb-4 mt-2 min-h-12 text-[12px] leading-5 text-muted">{text}</p>{button}</div>; }

function ErpPhotoModal({ photos, selected, setSelected, onClose, onAdd }: { photos: ActPhoto[]; selected: Set<string>; setSelected: (value: Set<string>) => void; onClose: () => void; onAdd: () => void }) {
  const toggle = (url: string) => { const next = new Set(selected); if (next.has(url)) next.delete(url); else next.add(url); setSelected(next); };
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(35,38,36,0.42)] p-2 backdrop-blur-[2px] sm:p-4"><div className="surface flex max-h-[94vh] w-full max-w-5xl flex-col"><div className="flex items-center justify-between border-b border-line p-4 sm:p-5"><div><h2 className="text-base font-semibold text-ink sm:text-lg">ERP-с зураг сонгох</h2><p className="text-[12px] text-muted">Актанд оруулах ажлын зургаа сонгоно уу</p></div><button aria-label="Хаах" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-hover"><X /></button></div><div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:gap-3 sm:p-5 lg:grid-cols-3">{photos.map((photo, index) => <button key={photo.image_url} onClick={() => toggle(photo.image_url)} className={`relative overflow-hidden rounded-[var(--radius-sm)] border-2 bg-card2 text-left ${selected.has(photo.image_url) ? 'border-brand' : 'border-transparent'}`}><img src={photo.preview_url || photo.image_url} className="h-32 w-full object-contain sm:h-48" alt={photo.caption || `Зураг ${index + 1}`} /><div className="p-2 text-[11px] sm:p-3 sm:text-[12px]"><b className="block text-ink">Зураг {index + 1}</b><span className="line-clamp-2 text-muted">{photo.caption || 'Тайлбаргүй'}</span></div>{selected.has(photo.image_url) ? <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-brand text-white"><Check size={15} /></span> : null}</button>)}{!photos.length ? <div className="col-span-full"><EmptyState text="Энэ ERP source-д холбоотой зураг олдсонгүй." /></div> : null}</div><div className="flex justify-end gap-2 border-t border-line p-3 sm:p-4"><Button variant="ghost" onClick={onClose}>Болих</Button><Button disabled={!selected.size} onClick={onAdd}>{selected.size} зураг нэмэх</Button></div></div></div>;
}
