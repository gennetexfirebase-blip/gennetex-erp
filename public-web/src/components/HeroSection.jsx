import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Network, Cable, ShieldCheck } from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';
const icons = [Network, Cable, ShieldCheck];
export default function HeroSection() {
  const { hero, services } = useSiteContent();
  return (
    <section className="public-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="eyebrow"><span />{hero.badge}</div>
        <h1 id="hero-title">{hero.title1}<br /><span>{hero.title2}</span></h1>
        <p className="hero-description">{hero.description}</p>
        <div className="hero-actions">
          <Link className="action-primary" to="/services">{hero.btnServices}<ArrowUpRight size={20} /></Link>
          <Link className="action-secondary" to="/contact">{hero.btnContact}<ArrowRight size={18} /></Link>
        </div>
        <p className="hero-tagline">{hero.tagline}</p>
        <div className="hero-proof">{[hero.stat1, hero.stat2, hero.stat3].map((stat,i)=><div key={i}>{stat}</div>)}</div>
      </div>
      <div className="hero-solutions">
        <div className="solutions-heading"><span>{services.label}</span><Network size={20} /></div>
        <div className="network-art" aria-hidden="true"><div className="network-orbit orbit-one" /><div className="network-orbit orbit-two" /><div className="network-center"><Network size={42} strokeWidth={1.3} /></div><span className="network-point point-one" /><span className="network-point point-two" /><span className="network-point point-three" /></div>
        <div className="solution-links">{services.items.slice(0,3).map((service,i)=>{const Icon=icons[i];return <Link to="/services" key={service.title} className="solution-link"><span className="solution-icon"><Icon size={20} /></span><span>{service.title}</span><ArrowUpRight size={17} /></Link>;})}</div>
        <Link to="/about" className="solutions-footer">{hero.btnAbout}<ArrowRight size={16} /></Link>
      </div>
    </section>
  );
}
