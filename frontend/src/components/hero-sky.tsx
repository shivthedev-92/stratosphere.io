/**
 * The landing and sign-in sky (design/handoff-landing): gradient, stars,
 * comets, drifting objects and the hover car. Purely decorative, so it is
 * hidden from assistive tech. Placement, animation and the Night/Dawn swap
 * live in globals.css ("Landing and sign-in sky").
 *
 * The artwork is the handoff's placeholder SVGs, served as files so their
 * provenance data stays intact; each object has a Night and a Dawn file.
 */

type Star = { x: number; y: number; size: number; opacity: number; twinkle: string | null };

/**
 * 120 stars from the reference's seeded generator. Deterministic, so the
 * server and the browser render the same sky (no hydration mismatch).
 */
function makeStars(): Star[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const stars: Star[] = [];
  for (let i = 0; i < 120; i += 1) {
    const x = rnd() * 100;
    const y = rnd() * 82;
    const size = rnd() < 0.15 ? 2.4 : rnd() < 0.5 ? 1.6 : 1;
    const twinkles = rnd() < 0.3;
    const opacity = 0.35 + rnd() * 0.6;
    const twinkle = twinkles ? `twinkle ${(3 + rnd() * 4).toFixed(2)}s ease-in-out ${(rnd() * 4).toFixed(2)}s infinite` : null;
    stars.push({ x, y, size, opacity, twinkle });
  }
  return stars;
}

const STARS = makeStars();

function ThemedArt({ name, alt = "" }: { name: string; alt?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/landing/night/${name}.svg`} alt={alt} className="only-night" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/landing/dawn/${name}.svg`} alt={alt} className="only-dawn" />
    </>
  );
}

export function HeroSky() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      {STARS.map((star, i) => (
        <span
          key={i}
          className={`sky-star absolute rounded-full ${star.y > 34 ? "low-star" : ""}`}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            background: "var(--star)",
            opacity: star.opacity,
            animation: star.twinkle ?? undefined,
          }}
        />
      ))}
      <div className="sun-glow" />
      <span className="sky-comet" style={{ top: "12%", left: "72%", ["--delay" as string]: "2s" }} />
      <span className="sky-comet" style={{ top: "26%", left: "38%", ["--delay" as string]: "8.5s" }} />

      <div className="sky-object sky-planet">
        <ThemedArt name="planet" />
      </div>
      <div className="sky-object sky-moon">
        <ThemedArt name="moon" />
      </div>
      <div className="sky-object sky-sat-a">
        <ThemedArt name="satellite" />
      </div>
      <div className="sky-object sky-sat-b">
        <ThemedArt name="satellite" />
      </div>
      <div className="sky-object sky-aster">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/aster-float.svg" alt="" />
      </div>
      <div className="sky-car">
        <div>
          <ThemedArt name="hover-car" />
        </div>
      </div>
    </div>
  );
}

/** The glowing horizon the page content rises out of. */
export function EarthLimb() {
  return <div aria-hidden="true" className="earth-limb" />;
}
