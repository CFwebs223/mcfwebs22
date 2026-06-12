'use client';

import { useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import Ambient3DBackground from './Ambient3DBackground';

const tiers = [
  {
    name: 'Starter Website',
    price: 'R2,500',
    description: 'Get found on Google.',
    detail: '3–5 pages, Google SEO, WhatsApp button, mobile-friendly, domain + hosting yr 1. Live in 5 days.',
  },
  {
    name: 'Business Website',
    price: 'R4,500',
    description: 'Book clients on autopilot.',
    detail: 'Everything in Starter + booking system, gallery, Google Maps. Perfect for salons, trades & services.',
    popular: true,
  },
  {
    name: 'Premium / Store',
    price: 'R7,500',
    description: 'Sell online 24/7.',
    detail: 'Full online store, payment gateway, inventory. Ideal for product businesses and e-commerce.',
  },
  {
    name: 'Growth Consulting',
    price: 'R1,500',
    description: 'Strategy session.',
    detail: '90-min deep-dive: growth audit, 90-day action plan, marketing strategy, sales scripts. Book via WhatsApp.',
    badge: 'New',
  },
];

export default function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // CPU Optimization: Only play video when visible
  const isInView = useInView(sectionRef, { margin: "200px 0px" });

  useEffect(() => {
    if (videoRef.current) {
      if (isInView) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isInView]);

  return (
    <section ref={sectionRef} id="pricing" className="relative z-10 min-h-screen w-full bg-black overflow-hidden flex items-center py-24">
      {/* Subtle ambient 3D background */}
      <Ambient3DBackground particleCount={20} hueRange={[40, 60]} className="opacity-40" />

      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 flex flex-col lg:flex-row items-center gap-12 lg:gap-24 relative z-10">

        {/* Left Side: Pricing Info */}
        <div className="flex-1 w-full order-2 lg:order-1">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <p className="text-yellow-500/80 font-light tracking-[0.2em] uppercase text-sm mb-4 drop-shadow-[0_0_10px_rgba(234,179,8,0.15)]">Premium Development</p>
            <h2 className="text-3xl md:text-5xl font-medium drop-shadow-xl text-white tracking-wide">Investment</h2>
            <div className="h-px w-24 bg-gradient-to-r from-yellow-500/50 to-transparent mt-6" />
            <div className="absolute -top-20 left-0 w-64 h-64 bg-gradient-to-r from-yellow-500/5 to-transparent blur-3xl pointer-events-none" />
          </motion.div>

          <div className="flex flex-col gap-6">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className={`relative group/premium p-5 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between border-l-2 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${tier.popular ? 'border-yellow-500 bg-yellow-950/10' : 'border-white/20 bg-white/[0.03] hover:bg-white/[0.06]'}`}
              >
                {/* Ambient hover glow */}
                <div className={`absolute inset-0 opacity-0 group-hover/premium:opacity-100 transition-opacity duration-700 pointer-events-none ${tier.popular ? 'bg-[radial-gradient(ellipse_at_left,rgba(234,179,8,0.06),transparent_70%)]' : 'bg-[radial-gradient(ellipse_at_left,rgba(255,255,255,0.03),transparent_70%)]'}`} />

                <div className="flex-1 mb-4 sm:mb-0 relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-medium text-white group-hover/premium:text-white transition-colors duration-300">{tier.name}</h3>
                    {tier.popular && (
                      <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-white/50 text-sm font-light max-w-xs group-hover/premium:text-white/70 transition-colors duration-300">{tier.description}</p>
                  <p className="text-white/30 text-xs font-light max-w-xs mt-1.5 group-hover/premium:text-white/40 transition-colors duration-300">{tier.detail}</p>
                </div>

                <div className="flex flex-col items-start sm:items-end justify-between sm:ml-6 relative z-10">
                  <span className="text-3xl font-light text-white mb-2 group-hover/premium:drop-shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all duration-300">{tier.price}</span>
                  <span className="text-[10px] text-white/20 font-mono tracking-wider mb-3">one-time project</span>
                  <a
                    href="#contact"
                    className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap hover-target ${tier.popular ? 'bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'glass border border-white/20 text-white hover:bg-white/10'}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Start Project
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Side: Vertical Video Container */}
        <div className="flex-1 w-full flex justify-center lg:justify-end order-1 lg:order-2">
          <motion.div 
            initial={{ opacity: 0, y: 50, rotateY: -15 }}
            whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative w-full max-w-sm aspect-[9/16] rounded-3xl overflow-hidden glass border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] edge-glow"
            style={{ perspective: "1000px", willChange: "transform" }}
          >
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover scale-110"
            >
              <source src="/videos/mp4.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none mix-blend-overlay" />
          </motion.div>
        </div>

      </div>
    </section>
  );
}
