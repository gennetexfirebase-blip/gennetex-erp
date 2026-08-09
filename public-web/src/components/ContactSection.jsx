import { MapPin, Phone, Mail, Globe, Clock } from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';

export default function ContactSection({ embedded = false }) {
  const { contact } = useSiteContent();

  const rows = [
    { icon: MapPin, label: 'Хаяг', value: contact.address },
    { icon: Phone, label: 'Утас', value: contact.phone, href: contact.phoneHref },
    { icon: Mail, label: 'Имэйл', value: contact.email, href: contact.emailHref },
    { icon: Globe, label: 'Вэб', value: contact.website },
  ];

  return (
    <section className={`relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 sm:px-6 md:px-12 ${embedded ? 'py-12 md:py-16' : 'py-20 md:py-28'}`}>
      <div className="mx-auto max-w-6xl">
        {!embedded ? (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">{contact.label}</p>
            <h2 className="mb-12 text-3xl font-normal tracking-tightest md:text-5xl">{contact.title}</h2>
          </>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="section-glass space-y-5 p-8">
            {rows.map((item) => (
              <div key={item.label} className="flex items-start gap-4">
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-graphite-500" />
                <div>
                  <div className="text-xs font-medium text-gray-500">{item.label}</div>
                  {item.href ? (
                    <a href={item.href} className="text-white transition hover:text-gray-300">
                      {item.value}
                    </a>
                  ) : (
                    <div className="text-white">{item.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="section-glass p-8">
            <div className="mb-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-graphite-500" />
              <h3 className="text-lg font-medium">{contact.hoursTitle}</h3>
            </div>
            <div className="space-y-2 text-gray-300">
              <p>{contact.hoursWeekday}</p>
              <p>{contact.hoursSaturday}</p>
              <p>{contact.hoursSunday}</p>
            </div>
            <p className="mt-6 text-sm text-gray-400">{contact.hoursNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
