import { useSiteContent } from '../context/SiteContentContext';
import { COMPANY_COPY, COMPANY_PROJECTS } from '../data/companyProfile';
import './company-overview.css';

function SectionTitle({ index, title }) {
  const Heading = index === 0 ? 'h1' : 'h2';
  return <div className="company-heading"><Heading>{title}</Heading></div>;
}

export default function CompanyOverview() {
  const { language = 'mn' } = useSiteContent();
  const copy = COMPANY_COPY[language];
  return (
    <div className="company-overview" lang={language}>
      <div className="company-wrap">
        <section id="introduction" className="company-section company-introduction">
          <div><SectionTitle index={0} title={copy.nav[0]} /><div className="company-prose">{copy.intro.map(text => <p key={text}>{text}</p>)}</div></div>
          <aside className="company-founded"><img src="/logo.png" alt="Gennetex" width="180" height="180" /><strong>2011</strong><span>{copy.established}</span></aside>
        </section>

        <section id="values" className="company-section">
          <SectionTitle index={1} title={copy.nav[1]} />
          <div className="company-three-columns">{copy.principles.map(item => <article className="company-card" key={item.title}><h3>{item.title}</h3>{item.text && <p>{item.text}</p>}{item.items && <ul>{item.items.map(text => <li key={text}>{text}</li>)}</ul>}</article>)}</div>
        </section>

        <section id="activities" className="company-section">
          <SectionTitle index={2} title={copy.nav[2]} />
          <div className="company-three-columns">{copy.services.map(item => <article className="company-card" key={item.title}><h3>{item.title}</h3><p>{item.text}</p>{item.items && <ul>{item.items.map(text => <li key={text}>{text}</li>)}</ul>}</article>)}</div>
        </section>

        <section id="experience" className="company-section">
          <SectionTitle index={3} title={copy.nav[3]} />
          <div className="company-prose">{copy.experience.map(text => <p key={text}>{text}</p>)}</div>
          <div className="company-stats">{copy.stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
          <img className="company-work-image" src="/company/network-work.jpg" alt={copy.nav[3]} loading="lazy" width="1259" height="332" />
        </section>

        <section id="partners" className="company-section">
          <SectionTitle index={4} title={copy.nav[4]} /><p className="company-note">{copy.partnersNote}</p>
          <ul className="company-partners">{copy.partners.map(name => <li key={name}>{name}</li>)}</ul>
        </section>

        <section id="projects" className="company-section">
          <SectionTitle index={5} title={copy.projectsTitle} />
          <div className="company-project-grid">{COMPANY_PROJECTS.map(([id, mn, en, type]) => {
            const name = language === 'mn' ? mn : en;
            return <figure className="company-project" key={id}>
              <img src={`/company/${id}.jpg`} alt={`${name} — ${copy.captions[type]}`} loading="lazy" width={id === 'bella-vista' ? 1002 : 482} height={id === 'bella-vista' ? 285 : 379} />
              <figcaption><h3>{name}</h3><p>{copy.captions[type]}</p></figcaption>
            </figure>;
          })}</div>
        </section>

        <section id="contact" className="company-section company-contact">
          <SectionTitle index={6} title={copy.nav[6]} /><h3>{copy.company}</h3>
          <dl><div><dt>{copy.addressLabel}</dt><dd>{copy.address}</dd></div><div><dt>{copy.phoneLabel}</dt><dd><a href="tel:+97688071414">8807-1414</a><a href="tel:+97677061414">7706-1414</a></dd></div><div><dt>{copy.emailLabel}</dt><dd><a href="mailto:gennetexllc@gmail.com">gennetexllc@gmail.com</a></dd></div></dl>
        </section>
      </div>
    </div>
  );
}
