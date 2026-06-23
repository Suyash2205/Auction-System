"use client";

import { useState } from "react";
import { Camera, CheckCircle2, Send } from "lucide-react";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen bg-[#f6fbf7]">
      <section className="court-grid bg-court-ink px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-court-lime">Player registration</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Lush Pickleball League 4.0</h1>
          <p className="mt-4 max-w-2xl text-white/70">
            Submit your details once and the organizer can reuse your player profile for future tournaments.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {submitted ? (
          <div className="rounded-lg border border-court-green/20 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto text-court-green" size={48} />
            <h2 className="mt-4 text-2xl font-semibold">Registration saved</h2>
            <p className="mt-2 text-court-ink/60">In the connected version, this will be stored in Supabase with the uploaded photo.</p>
            <button onClick={() => setSubmitted(false)} className="mt-6 rounded-md bg-court-ink px-5 py-3 text-sm font-semibold text-white">
              Add Another Player
            </button>
          </div>
        ) : (
          <form
            className="grid gap-5 rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm sm:p-7"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Full Name
                <input required name="name" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" placeholder="Player name" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Mobile Number
                <input required name="phone" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" placeholder="10 digit number" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Playing Experience
                <input required name="experience" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" placeholder="Eg. 2 years" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                City
                <input name="city" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" placeholder="Mumbai" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Dominant Hand
                <select name="dominantHand" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal">
                  <option>Right</option>
                  <option>Left</option>
                </select>
              </label>
            </div>

            <label className="grid min-h-40 place-items-center rounded-lg border border-dashed border-court-green/50 bg-court-mint/35 p-5 text-center">
              <Camera className="text-court-green" size={30} />
              <span className="mt-2 font-semibold">Upload Player Photo</span>
              <span className="mt-1 text-sm text-court-ink/55">JPG or PNG, square photo preferred</span>
              <input type="file" accept="image/*" name="photo" className="sr-only" />
            </label>

            <div className="flex flex-col gap-3 border-t border-court-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-court-ink/55">Mobile number stays private. Tournament category is assigned later by the admin.</p>
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white shadow-glow">
                <Send size={17} /> Submit Registration
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
