export class GameAudio {
  private ctx?: AudioContext;
  private water?: GainNode;
  enabled = false;
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      try {
        this.ctx ??= new AudioContext();
        await this.ctx.resume();
        if (!this.water) {
          const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
          const channel = buffer.getChannelData(0);
          for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * .25;
          const source = this.ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
          const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1700;
          this.water = this.ctx.createGain(); this.water.gain.value = 0;
          source.connect(filter).connect(this.water).connect(this.ctx.destination); source.start();
        }
      } catch { this.enabled = false; }
    }
    this.spray(false);
    return this.enabled;
  }
  spray(active: boolean) { if (this.ctx && this.water) this.water.gain.setTargetAtTime(active && this.enabled ? .38 : 0, this.ctx.currentTime, .07); }
  chime(kind: 'win' | 'resident' | 'rescue' | 'checkpoint' | 'mud' | 'achievement' | 'fail') {
    if (!this.enabled || !this.ctx) return;
    const frequencies = kind === 'win' ? [523,659,784,1047] : kind === 'achievement' ? [659,784,988,1319] : kind === 'fail' ? [330,247,165] : kind === 'rescue' ? [310,220] : [660,880];
    frequencies.forEach((frequency, i) => {
      const oscillator = this.ctx!.createOscillator(), volume = this.ctx!.createGain(), start = this.ctx!.currentTime + i * .12;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start); volume.gain.linearRampToValueAtTime(.06, start + .02); volume.gain.exponentialRampToValueAtTime(.001, start + .35);
      oscillator.connect(volume).connect(this.ctx!.destination); oscillator.start(start); oscillator.stop(start + .4);
    });
  }
}
