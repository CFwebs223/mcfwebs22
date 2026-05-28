'use client';

import { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import Image from 'next/image';

export default function HeroOceanScene() {
  const sectionRef = useRef<HTMLElement>(null);

  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const revealRadius = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 600, damping: 38 });
  const smoothY = useSpring(mouseY, { stiffness: 600, damping: 38 });
  const smoothRadius = useSpring(revealRadius, { stiffness: 100, damping: 18 });

  const clipPath = useMotionTemplate`circle(${smoothRadius}px at ${smoothX}px ${smoothY}px)`;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }, [mouseX, mouseY]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
    revealRadius.set(110);
  }, [mouseX, mouseY, revealRadius]);

  const handleMouseLeave = useCallback(() => {
    revealRadius.set(0);
  }, [revealRadius]);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-[#fdfcf7]"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Warm radial glow behind koi */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_50%_50%,rgba(200,168,75,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Outer double frame */}
      <div className="absolute inset-5 border border-[#c8a84b]/20 pointer-events-none z-20" />
      <div className="absolute inset-[23px] border border-[#c8a84b]/08 pointer-events-none z-20" />

      {/* Corner ornaments */}
      <div className="absolute top-4 left-4 w-9 h-9 border-t-[1.5px] border-l-[1.5px] border-[#c8a84b]/55 pointer-events-none z-20" />
      <div className="absolute top-4 right-4 w-9 h-9 border-t-[1.5px] border-r-[1.5px] border-[#c8a84b]/55 pointer-events-none z-20" />
      <div className="absolute bottom-4 left-4 w-9 h-9 border-b-[1.5px] border-l-[1.5px] border-[#c8a84b]/55 pointer-events-none z-20" />
      <div className="absolute bottom-4 right-4 w-9 h-9 border-b-[1.5px] border-r-[1.5px] border-[#c8a84b]/55 pointer-events-none z-20" />

      {/* Large faint enso circle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="w-[106vmin] h-[106vmin] rounded-full border border-[#c8a84b]/10" />
      </div>

      {/* Large faint 鯉 kanji watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none">
        <span
          className="text-[30vmin] font-bold text-[#c8a84b]/[0.028]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1 }}
          aria-hidden="true"
        >
          鯉
        </span>
      </div>

      {/* Colorful koi — base layer */}
      <div
        className="absolute inset-0 flex items-center justify-center z-[1] pointer-events-none"
        style={{ mixBlendMode: 'multiply' }}
      >
        <div className="relative w-[104vmin] h-[104vmin]">
          <Image
            src="/koi-color.png"
            alt="Koi fish"
            fill
            className="object-contain select-none"
            priority
            draggable={false}
          />
        </div>
      </div>

      {/* Ink koi — hover reveal via spring clip-path */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center z-[2] pointer-events-none"
        style={{ clipPath: clipPath as unknown as string, mixBlendMode: 'multiply' }}
      >
        <div className="relative w-[104vmin] h-[104vmin]">
          <Image
            src="/koi-ink.png"
            alt="Koi ink art"
            fill
            className="object-contain select-none"
            draggable={false}
          />
        </div>
      </motion.div>

      {/* Brand — top center */}
      <motion.div
        className="absolute top-10 inset-x-0 flex flex-col items-center z-30 pointer-events-none"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <span
          className="text-[2.6rem] font-bold tracking-[-0.02em] text-[#1a1208] leading-none"
          style={{ fontFamily: 'Georgia, Cambria, serif' }}
        >
          MCF
        </span>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="w-7 h-px bg-[#c8a84b]" />
          <span className="text-[0.58rem] tracking-[0.55em] uppercase text-[#8a7340] font-light">
            Websites
          </span>
          <div className="w-7 h-px bg-[#c8a84b]" />
        </div>
      </motion.div>

      {/* Headline + CTA — bottom left */}
      <motion.div
        className="absolute bottom-12 left-12 z-30 max-w-[45%] pointer-events-auto"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[0.6rem] tracking-[0.45em] uppercase text-[#c8a84b] font-medium mb-3">
          Premium Web Design &amp; Development
        </p>
        <h1
          className="font-light text-[#1a1208] leading-[1.1] tracking-tight mb-4"
          style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)', fontFamily: 'Georgia, Cambria, serif' }}
        >
          Digital Experiences<br />
          <span className="italic">That Move </span>
          <span className="text-[#c8a84b] not-italic font-normal">Effortlessly.</span>
        </h1>
        <p className="text-[0.82rem] text-[#5a4a2a]/55 font-light mb-7 leading-relaxed tracking-wide max-w-sm">
          High-performance websites &amp; immersive web experiences for businesses that refuse to settle for average.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-2.5 bg-[#1a1208] text-[#fdfcf7] text-[0.72rem] font-medium tracking-[0.2em] uppercase hover:bg-[#c8a84b] transition-colors duration-300"
          >
            Start Project
          </button>
          <button
            onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-2.5 border border-[#1a1208]/20 text-[#1a1208] text-[0.72rem] font-light tracking-[0.2em] uppercase hover:border-[#c8a84b] hover:text-[#c8a84b] transition-colors duration-300"
          >
            Our Work
          </button>
        </div>
      </motion.div>

      {/* Vertical hint — right side */}
      <motion.div
        className="absolute right-9 top-1/2 -translate-y-1/2 z-30 pointer-events-none"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        <span className="text-[0.55rem] tracking-[0.5em] uppercase text-[#8a7340]/40 font-light">
          Hover to reveal
        </span>
      </motion.div>

      {/* Scroll indicator — bottom right */}
      <motion.div
        className="absolute bottom-12 right-12 z-30 pointer-events-none flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
      >
        <motion.div
          className="w-px h-10 bg-gradient-to-b from-[#c8a84b]/60 to-transparent"
          animate={{ scaleY: [1, 0.6, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          style={{ transformOrigin: 'top' }}
        />
        <span className="text-[0.55rem] tracking-[0.45em] uppercase text-[#8a7340]/40">Scroll</span>
      </motion.div>
    </section>
  );
}
