/**
 * Applies white-label branding globally: CSS variables, document title,
 * favicon. Every visual surface (sidebar, docs, receipts, report cards)
 * inherits these values — nothing is hardcoded.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSchool } from '../../lib/useSchool';
import { defaultLogoSVG, shade } from '../../lib/utils';

export function BrandingProvider(props: { children: ReactNode }): React.JSX.Element {
  const school = useSchool();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', school.primaryColor);
    root.style.setProperty('--brand-primary-dark', shade(school.primaryColor, -0.22));
    root.style.setProperty('--brand-primary-light', shade(school.primaryColor, 0.85));
    root.style.setProperty('--brand-secondary', school.secondaryColor);
    root.style.setProperty('--brand-accent', school.accentColor);
    document.title = `${school.name} — ERP`;
    const favicon = school.favicon || school.logo || defaultLogoSVG(school.primaryColor, school.name);
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [school]);

  return <>{props.children}</>;
}

/** School crest: uploaded logo or a generated monogram tinted with brand color. */
export function SchoolLogo(props: { size?: number; rounded?: string }): React.JSX.Element {
  const school = useSchool();
  const size = props.size ?? 40;
  const src = school.logo || defaultLogoSVG(school.primaryColor, school.name);
  return (
    <img
      src={src}
      alt={`${school.name} logo`}
      width={size}
      height={size}
      className={props.rounded ?? 'rounded-xl'}
      style={{ width: size, height: size, objectFit: 'cover' }}
    />
  );
}

/** Shared letterhead for all printable documents (invoices, report cards, …). */
export function DocLetterhead(props: { subtitle?: string; right?: ReactNode }): React.JSX.Element {
  const school = useSchool();
  return (
    <div className="border-b-2 pb-4" style={{ borderColor: school.primaryColor }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <SchoolLogo size={56} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: school.secondaryColor }}>
              {school.name}
            </h1>
            {school.tagline ? <p className="text-xs font-medium uppercase tracking-widest text-slate-500">{school.tagline}</p> : null}
            <p className="mt-1 text-xs text-slate-500">
              {[school.address, school.city, school.country].filter(Boolean).join(', ')}
              {school.phone ? ` · ${school.phone}` : ''}
            </p>
            <p className="text-xs text-slate-500">
              {[school.email, school.website].filter(Boolean).join(' · ')}
              {school.registrationNo ? ` · Reg: ${school.registrationNo}` : ''}
            </p>
          </div>
        </div>
        {props.right ? <div className="shrink-0 text-right">{props.right}</div> : null}
      </div>
      {props.subtitle ? (
        <p className="mt-3 text-center text-sm font-bold uppercase tracking-widest" style={{ color: school.primaryColor }}>
          {props.subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function DocSignatures(props: { left?: string; right?: string }): React.JSX.Element {
  const school = useSchool();
  return (
    <div className="mt-14 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
      <div>
        <div className="mx-auto w-48 border-t border-slate-400 pt-1 font-semibold">{props.left ?? 'Class Teacher'}</div>
      </div>
      <div>
        <div className="mx-auto w-48 border-t border-slate-400 pt-1 font-semibold">
          {props.right ?? `Principal — ${school.principalName}`}
        </div>
      </div>
    </div>
  );
}
