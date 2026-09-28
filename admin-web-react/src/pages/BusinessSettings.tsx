import { useEffect, useState } from 'react';
import { Save, Settings2 } from 'lucide-react';
import { Button, Card, Input, Loading, PageHeader } from '../components/ui';
import {
  DEFAULT_COMPANY_SETTINGS,
  companyLateFromLabel,
  companyWorkStartLabel,
  fetchCompanySettings,
  saveCompanySettings,
  type CompanySettings,
} from '../lib/data';

const ALERT_OPTIONS: Array<{ key: keyof CompanySettings; title: string; note: string }> = [
  { key: 'low_stock_alert_enabled', title: 'Бага үлдэгдэл', note: 'Бараа доод хэмжээнд хүрэхэд анхааруулна.' },
  { key: 'training_alert_enabled', title: 'Сургалтын хугацаа', note: 'Заавал суух сургалтын хугацааг хянана.' },
  { key: 'vehicle_alert_enabled', title: 'Машины хугацаа', note: 'Үзлэг болон даатгалын хугацааг хянана.' },
];

export default function BusinessSettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [reminderText, setReminderText] = useState('30, 7, 1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetchCompanySettings()
      .then((value) => {
        if (!active) return;
        setSettings(value);
        setReminderText(value.reminder_days.join(', '));
      })
      .catch((error) => active && setMessage((error as Error).message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const change = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage('');
  };

  const save = async () => {
    const start = companyWorkStartLabel(settings);
    const days = reminderText
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 365);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !days.length) {
      setMessage('Ирэх цаг болон сануулах хоногийн утгыг шалгана уу.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCompanySettings({ ...settings, work_start_time: start, reminder_days: days });
      setSettings(saved);
      setReminderText(saved.reminder_days.join(', '));
      setMessage('Тохиргоо амжилттай хадгалагдлаа.');
    } catch (error) {
      setMessage((error as Error).message || 'Хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Тохиргооны төв"
        crumb="Системийн тохиргоо"
        actions={<Button icon={<Save size={15} />} onClick={save} disabled={saving || loading}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</Button>}
      />
      {loading ? <Loading /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Ирцийн дүрэм" icon={<Settings2 size={17} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] text-muted">
                <span className="mb-1.5 block font-semibold text-ink">Ажилд ирэх цаг</span>
                <Input type="time" value={companyWorkStartLabel(settings)} onChange={(event) => change('work_start_time', event.target.value)} />
              </label>
              <label className="text-[13px] text-muted">
                <span className="mb-1.5 block font-semibold text-ink">Зөвшөөрөх минут</span>
                <Input type="number" min={0} max={120} value={settings.late_grace_minutes} onChange={(event) => change('late_grace_minutes', Number(event.target.value))} />
              </label>
            </div>
            <p className="mt-4 rounded-[var(--radius-sm)] bg-brand-soft px-4 py-3 text-[13px] font-medium text-brand">
              {companyWorkStartLabel(settings)} хүртэл цагтаа · {companyLateFromLabel(settings)}-ээс хоцорсонд тооцно.
            </p>
          </Card>

          <Card title="Агуулах ба сануулга" icon={<Settings2 size={17} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] text-muted">
                <span className="mb-1.5 block font-semibold text-ink">Үндсэн доод үлдэгдэл</span>
                <Input type="number" min={0} value={settings.default_min_stock} onChange={(event) => change('default_min_stock', Number(event.target.value))} />
              </label>
              <label className="text-[13px] text-muted">
                <span className="mb-1.5 block font-semibold text-ink">Сануулах хоногууд</span>
                <Input value={reminderText} onChange={(event) => setReminderText(event.target.value)} placeholder="30, 7, 1" />
              </label>
            </div>
            <div className="mt-5 divide-y divide-line">
              {ALERT_OPTIONS.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-ink">{option.title}</span>
                    <span className="mt-0.5 block text-[12px] text-subtle">{option.note}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--brand)]"
                    checked={Boolean(settings[option.key])}
                    onChange={(event) => change(option.key, event.target.checked as never)}
                  />
                </label>
              ))}
            </div>
          </Card>
        </div>
      )}
      {message ? <p role="status" className="mt-4 rounded-[var(--radius-sm)] border border-line bg-card px-4 py-3 text-[13px] text-ink">{message}</p> : null}
    </>
  );
}
