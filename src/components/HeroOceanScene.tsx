'use client';

import { useRef, useCallback, useEffect } from 'react';
import {
  motion,
  useMotionValue, useSpring, useMotionTemplate,
  useScroll, useTransform,
} from 'framer-motion';
import Image from 'next/image';

const TOTAL_FRAMES = 160;

export default function HeroOceanScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<(HTMLImageElement | null)[]>([]);
  const currentFrameRef = useRef(0);

  // ── Scroll progress ────────────────────────────────────────────
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Hero fades out fast; canvas fades in at same pace
  const heroOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);
  const canvasOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1]);

  // ── Hover ink reveal ───────────────────────────────────────────
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const revealRadius = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 600, damping: 38 });
  const smoothY = useSpring(mouseY, { stiffness: 600, damping: 38 });
  const smoothRadius = useSpring(revealRadius, { stiffness: 100, damping: 18 });
  const clipPath = useMotionTemplate`circle(${smoothRadius}px at ${smoothX}px ${smoothY}px)`;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }, [mouseX, mouseY]);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
    revealRadius.set(110);
  }, [mouseX, mouseY, revealRadius]);

  const handleMouseLeave = useCallback(() => revealRadius.set(0), [revealRadius]);

  // ── Canvas frame rendering ─────────────────────────────────────
  const drawFrame = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    const img = framesRef.current[idx];
    if (!canvas || !img?.complete || !img.naturalWidth) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width: cw, height: ch } = canvas;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }, []);

  // Resize canvas to viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame(currentFrameRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawFrame]);

  // Preload all frames; render frame 0 immediately when it lands
  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new window.Image();
      img.src = `/frames/koi/frame_${String(i + 1).padStart(4, '0')}.jpg`;
      if (i === 0) img.onload = () => drawFrame(0);
      imgs.push(img);
    }
    framesRef.current = imgs;
  }, [drawFrame]);

  // Drive frame index from scroll
  useEffect(() => {
    return scrollYProgress.on('change', (v) => {
      const idx = Math.min(Math.floor(v * TOTAL_FRAMES), TOTAL_FRAMES - 1);
      if (idx !== currentFrameRef.current) {
        currentFrameRef.current = idx;
        drawFrame(idx);
      }
    });
  }, [scrollYProgress, drawFrame]);

  return (
    <section ref={sectionRef} className="relative h-[600vh] w-full">
      <div
        className="sticky top-0 h-screen w-full overflow-hidden bg-[#fdfcf7]"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >

        {/* ── HERO LAYER — fades out on first scroll ── */}
        <motion.div className="absolute inset-0 z-[5]" style={{ opacity: heroOpacity }}>

          {/* Warm center glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_50%_50%,rgba(200,168,75,0.08)_0%,transparent_70%)] pointer-events-none" />

          {/* Decorative frame */}
          <div className="absolute inset-5 border border-[#c8a84b]/20 pointer-events-none" />
          <div className="absolute inset-[23px] border border-[#c8a84b]/[0.08] pointer-events-none" />
          <div className="absolute top-4 left-4   w-9 h-9 border-t-[1.5px] border-l-[1.5px] border-[#c8a84b]/55 pointer-events-none" />
          <div className="absolute top-4 right-4  w-9 h-9 border-t-[1.5px] border-r-[1.5px] border-[#c8a84b]/55 pointer-events-none" />
          <div className="absolute bottom-4 left-4  w-9 h-9 border-b-[1.5px] border-l-[1.5px] border-[#c8a84b]/55 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-9 h-9 border-b-[1.5px] border-r-[1.5px] border-[#c8a84b]/55 pointer-events-none" />


          {/* Colorful koi — full screen base */}
          <div className="absolute inset-0 pointer-events-none">
            <Image src="/koi-color.png" alt="Koi fish" fill className="object-contain select-none" priority draggable={false} />
          </div>

          {/* Ink koi — hover reveal, full screen */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ clipPath: clipPath as unknown as string }}
          >
            <Image src="/koi-ink.png" alt="" fill className="object-contain select-none" draggable={false} />
          </motion.div>

          {/* Brand — top center */}
          <motion.div
            className="absolute top-10 inset-x-0 flex flex-col items-center pointer-events-none"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <span
              className="text-[2.6rem] font-bold tracking-[-0.02em] text-[#1a1208] leading-none"
              style={{ fontFamily: 'Georgia, Cambria, serif' }}
            >MCF</span>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-7 h-px bg-[#c8a84b]" />
              <span className="text-[0.58rem] tracking-[0.55em] uppercase text-[#8a7340] font-light">Websites</span>
              <div className="w-7 h-px bg-[#c8a84b]" />
            </div>
          </motion.div>

          {/* Headline + CTAs — bottom left */}
          <motion.div
            className="absolute bottom-12 left-12 max-w-[45%] pointer-events-auto"
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
              >Start Project</button>
              <button
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-2.5 border border-[#1a1208]/20 text-[#1a1208] text-[0.72rem] font-light tracking-[0.2em] uppercase hover:border-[#c8a84b] hover:text-[#c8a84b] transition-colors duration-300"
              >Our Work</button>
            </div>
          </motion.div>

          {/* Vertical hint — right */}
          <motion.div
            className="absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ writingMode: 'vertical-rl' }}
          >
            <span className="text-[0.55rem] tracking-[0.5em] uppercase text-[#8a7340]/40 font-light">Hover to reveal</span>
          </motion.div>

          {/* Scroll indicator — bottom right */}
          <motion.div
            className="absolute bottom-12 right-12 pointer-events-none flex flex-col items-center gap-2"
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
        </motion.div>

        {/* ── VIDEO CANVAS — scroll animation ── */}
        <motion.canvas
          ref={canvasRef}
          className="absolute inset-0 z-[6]"
          style={{ opacity: canvasOpacity, width: '100%', height: '100%' }}
        />
      </div>
    </section>
  );
}
