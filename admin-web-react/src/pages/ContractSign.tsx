import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileSignature, LogOut, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, Loading, Textarea } from '../components/ui';
import ContractPdfView from '../components/ContractPdfView';
import SignaturePad, { type SignaturePadHandle } from '../components/SignaturePad';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';
import {
  CONTRACT_HOST,
  DIRECTOR_EMAIL,
  STATUS_LABEL,
  decideContract,
  directorStampUrl,
  fetchContractBySlug,
  fetchMyContracts,
  signContract,
  signatureUrl,
  type Contract,
} from '../lib/contracts';
import type { ContractImages } from '../lib/contractPdf';

/**
 * geree.gennetex.com/<slug> — ажилтан гэрээтэйгээ танилцаж гарын үсэг
 * зурна; Захирал баталгаажуулна. Admin-ийн Layout-аас ГАДУУР (энгийн
 * ажилтан админ самбарт хандахгүй).
 */
export default function ContractSignPage() {
  const { slug } = useParams();
  const [session, setSession] = useState<{ email: string } | null | undefined>(undefined);
  const [contract, setContract] = useState<Contract | null | undefined>(undefined);
  const [mine, setMine] = useState<Contract[]>([]);
  const [images, setImages] = useState<ContractImages>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return setSession(null);
    const read = () =>
      supabase.auth.getUser().then(({ data }) => setSession(data?.user ? { email: String(data.user.email || '').toLowerCase() } : null));
    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setError('');
    try {
      if (!slug) {
        setMine(await fetchMyContracts(session.email));
        setContract(null);
        return;
      }
      const c = await fetchContractBySlug(slug);
      setContract(c);
      if (c) {
        const [sig, dir] = await Promise.all([
          signatureUrl(c.employee_signature_path),
          directorStampUrl().catch(() => ({ stamp: '', signature: '' })),
        ]);
        setImages({ employeeSignature: sig, directorStamp: dir.stamp, directorSignature: dir.signature });
      }
    } catch (e: any) {
      setError(e?.message || 'Гэрээ ачаалж чадсангүй.');
    }
  }, [session, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const signIn = async () => {
    const returnTo = window.location.href;
    rememberAuthReturn(returnTo);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo, queryParams: { prompt: 'select_account' } } });
  };
  const signOut = () => supabase.auth.signOut().then(() => window.location.reload());

  return (
    <div className="min-h-screen bg-app">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[980px] items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[13px] font-black text-white">G</span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-ink">ЖЕННЕТЕКС ХХК</div>
            <div className="text-[12px] text-muted">Хөдөлмөрийн гэрээ</div>
          </div>
          {session ? (
            <Button variant="ghost" icon={<LogOut size={15} />} onClick={signOut} title={session.email}>
              <span className="hidden sm:inline">{session.email}</span>
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[980px] px-3 py-5 sm:px-4">
        {session === undefined ? (
          <Loading text="Түр хүлээнэ үү…" />
        ) : session === null ? (
          <Card title="Нэвтрэх" icon={<FileSignature size={17} />}>
            <p className="mb-4 text-[14px] text-ink">Гэрээтэйгээ танилцахын тулд гэрээ ирсэн имэйл хаягтай Google дансаараа нэвтэрнэ үү.</p>
            <Button onClick={signIn}>Google-ээр нэвтрэх</Button>
          </Card>
        ) : error ? (
          <Card title="Алдаа"><p className="text-[13px] text-danger">{error}</p></Card>
        ) : !slug ? (
          <MyContracts list={mine} />
        ) : contract === undefined ? (
          <Loading text="Гэрээг ачаалж байна…" />
        ) : contract === null ? (
          <Card title="Гэрээ олдсонгүй">
            <p className="mb-3 text-[14px] text-ink">
              Энэ гэрээ олдсонгүй эсвэл <b>{session.email}</b> хаягаар харах эрхгүй байна. Гэрээ ирсэн имэйл хаягаараа нэвтэрнэ үү.
            </p>
            <Button variant="outline" onClick={signOut}>Өөр дансаар нэвтрэх</Button>
          </Card>
        ) : (
          <ContractView contract={contract} images={images} email={session.email} onChanged={load} />
        )}
      </main>
    </div>
  );
}

function MyContracts({ list }: { list: Contract[] }) {
  return (
    <Card title="Миний гэрээнүүд" icon={<FileSignature size={17} />}>
      {list.length === 0 ? (
        <p className="text-[14px] text-muted">Танд ирсэн гэрээ алга.</p>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <Link key={c.id} to={`${window.location.hostname === CONTRACT_HOST ? '' : '/geree'}/${c.slug}`} className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-card2 px-4 py-3 hover:border-brand">
              <span className="font-semibold text-ink">№{c.contract_number}</span>
              <span className="text-[13px] text-muted">{c.fields.contract_date}</span>
              <Badge tone={c.status === 'approved' ? 'success' : c.status === 'sent' ? 'warning' : 'brand'} className="ml-auto">{STATUS_LABEL[c.status]}</Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function ContractView({ contract, images, email, onChanged }: { contract: Contract; images: ContractImages; email: string; onChanged: () => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [agreed, setAgreed] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const isEmployee = email === contract.employee_email.toLowerCase();
  const isDirector = email === DIRECTOR_EMAIL;
  const pdfImages = useMemo(() => images, [images]);

  const submitSignature = async () => {
    if (!agreed || !drawn || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const blob = await pad.current?.toBlob();
      if (!blob) throw new Error('Гарын үсэг уншиж чадсангүй.');
      await signContract(contract, blob);
      setMsg('Гарын үсэг амжилттай илгээгдлээ. Захирал баталгаажуулахыг хүлээнэ үү.');
      onChanged();
    } catch (e: any) {
      setMsg(e?.message || 'Илгээж чадсангүй.');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (approve: boolean) => {
    if (busy) return;
    if (!approve && !note.trim()) return setMsg('Буцаах шалтгааныг бичнэ үү.');
    setBusy(true);
    setMsg('');
    try {
      await decideContract(contract.id, approve, note);
      setMsg(approve ? 'Гэрээ баталгаажлаа. Ажилтанд имэйлээр мэдэгдлээ.' : 'Гэрээг буцаалаа.');
      onChanged();
    } catch (e: any) {
      setMsg(e?.message || 'Алдаа гарлаа.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title={`Ажил гүйцэтгэх гэрээ №${contract.contract_number}`}
        icon={<FileSignature size={17} />}
        actions={<Badge tone={contract.status === 'approved' ? 'success' : contract.status === 'returned' ? 'danger' : 'warning'}>{STATUS_LABEL[contract.status]}</Badge>}
      >
        <p className="mb-3 text-[13px] text-muted">
          {[contract.family_name, contract.given_name].filter(Boolean).join(' ')} · {contract.fields.contract_date}
        </p>
        <ContractPdfView contract={contract} images={pdfImages} height={720} />
      </Card>

      {isEmployee && contract.status === 'sent' ? (
        <Card title="Гарын үсэг зурах" icon={<FileSignature size={17} />}>
          <label className="mb-3 flex items-start gap-2 text-[14px] text-ink">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            Гэрээ болон Хавсралт-1-тэй бүрэн танилцаж, нөхцөлийг зөвшөөрч байна.
          </label>
          <p className="mb-2 text-[13px] text-muted">Доорх талбарт хуруу эсвэл хулганаараа гарын үсгээ зурна уу.</p>
          <SignaturePad ref={pad} onChange={(empty) => setDrawn(!empty)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" icon={<RotateCcw size={15} />} onClick={() => pad.current?.clear()}>Арилгах</Button>
            <Button icon={<Send size={15} />} disabled={!agreed || !drawn || busy} onClick={submitSignature}>
              {busy ? 'Илгээж байна…' : 'Гарын үсэг зурж илгээх'}
            </Button>
          </div>
        </Card>
      ) : null}

      {isDirector && contract.status === 'signed' ? (
        <Card title="Захирлын баталгаажуулалт" icon={<ShieldCheck size={17} />}>
          <p className="mb-3 text-[14px] text-ink">Ажилтан гэрээтэй танилцаж гарын үсэг зурсан. Баталгаажуулахад гэрээнд Женнетексийн тамга дарагдана.</p>
          <Textarea rows={2} placeholder="Буцаах бол шалтгаанаа бичнэ үү" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="success" icon={<CheckCircle2 size={15} />} disabled={busy} onClick={() => decide(true)}>Баталгаажуулах</Button>
            <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Буцаах</Button>
          </div>
        </Card>
      ) : null}

      {isEmployee && contract.status === 'signed' ? (
        <Card><p className="text-[14px] text-ink">Та гарын үсгээ зурсан. Захирал баталгаажуулахыг хүлээж байна.</p></Card>
      ) : null}
      {contract.status === 'approved' ? (
        <Card><p className="text-[14px] text-success">Гэрээ баталгаажсан. PDF-ийг дээрх «PDF татах» товчоор хадгална уу.</p></Card>
      ) : null}
      {msg ? <p className="text-[14px] font-semibold text-ink" role="status">{msg}</p> : null}
    </div>
  );
}
