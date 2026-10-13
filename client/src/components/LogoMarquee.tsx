import React from "react";

export interface LogoItem {
  src: string;
  alt: string;
  featured?: boolean;
}

interface LogoMarqueeProps {
  logos: LogoItem[];
}

export default function LogoMarquee({ logos }: LogoMarqueeProps) {
  // Split logos evenly across two rows
  const midpoint = Math.ceil(logos.length / 2);
  const row1 = logos.slice(0, midpoint);
  const row2 = logos.slice(midpoint);

  return (
    <div
      className="lp-clients-marquee-container"
      role="region"
      aria-label="Our Clients"
    >
      {/* Row 1: Moves Left */}
      <div className="lp-marquee-viewport" tabIndex={-1}>
        <div className="lp-marquee-track lp-marquee-track-left">
          <div className="lp-marquee-group">
            {row1.map((logo, i) => (
              <img
                key={`r1-orig-${i}`}
                src={logo.src}
                alt={logo.alt}
                className={logo.featured ? "featured" : ""}
                loading="lazy"
                width={logo.featured ? 72 : 50}
                height={logo.featured ? 72 : 50}
              />
            ))}
          </div>
          {/* Duplicated track for continuous seamless loop */}
          <div className="lp-marquee-group" aria-hidden="true">
            {row1.map((logo, i) => (
              <img
                key={`r1-dup-${i}`}
                src={logo.src}
                alt=""
                className={logo.featured ? "featured" : ""}
                loading="lazy"
                width={logo.featured ? 72 : 50}
                height={logo.featured ? 72 : 50}
                tabIndex={-1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Moves Right */}
      <div className="lp-marquee-viewport lp-marquee-viewport-row2" tabIndex={-1}>
        <div className="lp-marquee-track lp-marquee-track-right">
          <div className="lp-marquee-group">
            {row2.map((logo, i) => (
              <img
                key={`r2-orig-${i}`}
                src={logo.src}
                alt={logo.alt}
                className={logo.featured ? "featured" : ""}
                loading="lazy"
                width={logo.featured ? 72 : 50}
                height={logo.featured ? 72 : 50}
              />
            ))}
          </div>
          {/* Duplicated track for continuous seamless loop */}
          <div className="lp-marquee-group" aria-hidden="true">
            {row2.map((logo, i) => (
              <img
                key={`r2-dup-${i}`}
                src={logo.src}
                alt=""
                className={logo.featured ? "featured" : ""}
                loading="lazy"
                width={logo.featured ? 72 : 50}
                height={logo.featured ? 72 : 50}
                tabIndex={-1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
