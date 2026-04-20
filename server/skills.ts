export const SKILLS = {
  PREMIUM_AESTHETIC: `
    Skill: Premium Aesthetic
    - Use sophisticated, low-contrast shadows.
    - Implement a harmonious color palette (e.g., Indigo/Slate or Rose/Cream).
    - Favor generous whitespace (p-12, p-24, gap-12).
    - Use high-end typography terms in copy.
  `,
  ANIMATION_FOCUS: `
    Skill: Framer Motion / Animation
    - Describe where subtle entrances should happen.
    - Use staggered reveals for list items or features.
    - Focus on 'Float' and 'Fade' micro-interactions.
  `,
  CONVERSION_ENGINE: `
    Skill: Conversion Engineering
    - Headline must be benefit-driven, not feature-driven.
    - CTA buttons should use high-contrast colors.
    - Add 'Social Proof' elements (trusted by X companies, 5-star ratings).
    - Use the AIDA framework (Attention, Interest, Desire, Action).
  `,
  DARK_MODE: `
    Skill: Futuristic Dark Mode
    - Primary background: #000000 or #020617.
    - Secondary background: #0f172a.
    - Border colors: white/10 or white/5.
    - Glow effects: primary-glow (bg-primary/20 blur-3xl).
  `
};

export type SkillKey = keyof typeof SKILLS;
