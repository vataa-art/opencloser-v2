// ============================================================
// Demo adapter — offline scripted call for evaluation.
// Contacts no provider and no network; clearly labelled demo.
// ============================================================

import { CallerEngine } from "./base";

export class DemoCallerEngine extends CallerEngine {
  private interval: any = null;
  private lines = [
    { role: "model" as const, text: "Hi there! This is Alex from OpenCloser. Am I speaking with the business owner?" },
    { role: "user" as const, text: "Yeah, this is him. What's this about?" },
    { role: "model" as const, text: "Great to connect! I'm calling because we help agencies automate their outbound calling and handle objections seamlessly. How are you currently handling lead generation?" },
    { role: "user" as const, text: "We mostly use cold email and a bit of manual calling, but it's getting really expensive and time-consuming." },
    { role: "model" as const, text: "Spot on. Email deliverability is brutal right now, and manual dialing burns out SDRs. If we could deploy an AI agent that sounds exactly like a top-performing human rep and books meetings 24/7, would you be open to exploring how it works?" },
    { role: "user" as const, text: "I don't know, man. Every AI I've heard usually sounds super robotic or has a weird delay. Do you have a demo?" },
    { role: "model" as const, text: "I completely understand the hesitation. Actually... you're talking to an AI right now. I'd love to show you the WarRoom dashboard where you can see exactly how my brain processes responses. Do you have 15 minutes tomorrow?" },
    { role: "user" as const, text: "Haha no way, really? That's crazy. Okay yeah, send me a calendar invite." },
    { role: "model" as const, text: "Awesome. I'll get that sent right over to your email. Thanks for your time, have a great day!" }
  ];
  private currentIndex = 0;

  async connect(_systemPrompt: string, _voiceId: string, _language: string): Promise<void> {
    this.setState("connecting");

    // Simulate connection delay
    setTimeout(() => {
      this.setState("active");

      this.interval = setInterval(() => {
        if (this.currentIndex < this.lines.length) {
          const line = this.lines[this.currentIndex++];
          this.callbacks.onTranscript(this.makeTranscriptLine(line.role, line.text));
        } else {
          this.disconnect();
        }
      }, 4000); // Send a script line every 4 seconds

    }, 1500);
  }

  sendAudio(_float32: Float32Array): void {
    // Demo mode does not process microphone audio.
  }

  disconnect(): void {
    if (this.interval) clearInterval(this.interval);
    this.setState("ended");
  }
}
