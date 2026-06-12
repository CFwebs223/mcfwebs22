'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { Layout, Smartphone, CalendarDays, ShoppingBag, Globe, Zap, TrendingUp, Users } from 'lucide-react';
import FrameSequence from './FrameSequence';

const TOTAL_FRAMES = 40;

const services = [
  { icon: <Globe className="w-5 h-5" />, title: 'AI-Built Websites', desc: 'Fast, modern websites for a professional online presence.' },
  { icon: <Layout className="w-5 h-5" />, title: 'Landing Pages', desc: 'High-converting pages for campaigns and services.' },
  { icon: <Smartphone className="w-5 h-5" />, title: 'Digital Menus', desc: 'Online menus for restaurants and hospitality.' },
  { icon: <CalendarDays className="w-5 h-5" />, title: 'Booking Systems', desc: 'Simple booking flows for services and appointments.' },
  { icon: <ShoppingBag className="w-5 h-5" />, title: 'Online Stores', desc: 'Lightweight e-commerce experiences.' },
  { icon: <Zap className="w-5 h-5" />, title: 'Business Automation', desc: 'Forms, lead capture, and AI-assisted workflows.' },
  { icon: <TrendingUp className="w-5 h-5" />, title: 'Growth Consulting', desc: '90-min strategy sessions to unlock revenue and scale your business.' },
  { icon: <Users className="w-5 h-5" />, title: 'Marketing Strategy', desc: 'Custom WhatsApp, social, and SEO plans for more clients every month.' },
];

export default function ServicesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const lastFrameRef = useRef(-1);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"]
  });

  // Frame tracking
  const [frameIndex, setFrameIndex] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const idx = Math.min(Math.floor(latest * TOTAL_FRAMES), TOTAL_FRAMES - 1);
    if (idx !== lastFrameRef.current) {
      lastFrameRef.current = idx;
      setFrameIndex(idx);
    }
  });

  // UI visibility: stays visible through most of the scroll
  const uiOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const uiY = useTransform(scrollYProgress, [0, 0.55], [0, -40]);

  return (
    <section ref={sectionRef} id="services" className="relative h-[200vh] w-full bg-black">
      <div className="sticky top-0 w-full h-screen overflow-hidden">

        {/* Full-screen frame sequence */}
        <FrameSequence
          path="/frames/waterfall/frame_"
          totalFrames={TOTAL_FRAMES}
          progress={frameIndex / TOTAL_FRAMES}
        />

        {/* Blur watermark corner — no black block */}
        <div className="absolute bottom-0 right-0 w-20 h-10 backdrop-blur-[4px] pointer-events-none z-10" />

        {/* White backdrop for text readability */}
        <div className="absolute left-0 right-0 top-0 bottom-0 z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
        </div>

        {/* Animated UI — fades and slides up on scroll */}
        <motion.div
          className="absolute inset-0 z-20 flex flex-col justify-center px-5 md:px-16 lg:px-24"
          style={{ opacity: uiOpacity, y: uiY }}
        >
          <div className="max-w-4xl mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-10 md:mb-14"
            >
              <span className="text-black text-[10px] md:text-xs font-mono tracking-[0.25em] uppercase block mb-2 md:mb-3 opacity-70">What We Build</span>
              <h2 className="text-3xl md:text-6xl font-bold text-black mb-2 md:mb-3">Digital Capabilities</h2>
              <div className="w-14 md:w-20 h-0.5 bg-black/30" />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 md:gap-y-6">
              {services.map((service, i) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="flex items-start gap-3 md:gap-4 group"
                >
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-black/15 flex items-center justify-center shrink-0 mt-0.5 text-black group-hover:bg-black/25 transition-colors duration-300">
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="text-black font-bold text-sm md:text-base mb-0.5">{service.title}</h3>
                    <p className="text-black/80 text-xs md:text-sm font-medium">{service.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}