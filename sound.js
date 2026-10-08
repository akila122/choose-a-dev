const Sound = (() => {
  const SONG_VOLUME = 0.5;

  let ctx = null;
  let master, sfxBus;
  let muted = false;
  try {
    muted = localStorage.getItem("muted") === "1";
  } catch {}

  const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.3;
      sfxBus.connect(master);
      loadOhYeah();
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function tone(hz, start, dur, { type = "square", vol = 1, slideTo } = {}) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(env).connect(sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function arpeggio(notes, gap, opts) {
    ensure();
    const t = ctx.currentTime;
    notes.forEach((n, i) => tone(freq(n), t + i * gap, opts.last && i === notes.length - 1 ? opts.last : gap * 1.6, opts));
  }

  const song = new Audio("sfx/song.mp3");
  song.loop = true;
  song.volume = SONG_VOLUME;
  song.muted = muted;

  // Browsers block autoplay until the first interaction.
  function startSong() {
    ensure();
    if (song.paused) song.play().catch(() => {});
  }
  for (const type of ["pointerdown", "keydown"]) addEventListener(type, startSong);

  function duck(ms) {
    song.volume = SONG_VOLUME * 0.3;
    setTimeout(() => (song.volume = SONG_VOLUME), ms);
  }

  const DEEP_VOICES = ["Daniel", "Fred", "Ralph", "Alex", "Google UK English Male", "Microsoft David", "Microsoft Guy"];

  let ohYeahBuffer = null;

  function loadOhYeah() {
    fetch("sfx/oh-yeah.mp3")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buf) => (ohYeahBuffer = buf))
      .catch(() => {});
  }

  function ohYeah() {
    if (ohYeahBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = ohYeahBuffer;
      src.connect(master);
      src.start();
      return;
    }
    if (muted || !("speechSynthesis" in window)) return;
    const say = new SpeechSynthesisUtterance("Ohhh yeahhh!");
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
    say.voice = DEEP_VOICES.map((name) => voices.find((v) => v.name.includes(name))).find(Boolean) || voices[0] || null;
    say.pitch = 0.1;
    say.rate = 0.6;
    say.volume = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(say);
  }

  return {
    good() {
      arpeggio([88, 95], 0.06, { vol: 0.5 });
    },
    bad() {
      ensure();
      tone(150, ctx.currentTime, 0.35, { type: "sawtooth", vol: 0.6, slideTo: 60 });
    },
    bonus() {
      arpeggio([84, 88, 91, 96], 0.05, { type: "triangle", vol: 0.7 });
    },
    miss() {
      ensure();
      tone(320, ctx.currentTime, 0.18, { type: "sine", vol: 0.7, slideTo: 110 });
    },
    levelUp() {
      arpeggio([72, 76, 79, 84], 0.08, { vol: 0.5, last: 0.35 });
    },
    win() {
      duck(3500);
      arpeggio([72, 76, 79, 84, 79, 84], 0.12, { vol: 0.5, last: 0.8 });
      setTimeout(ohYeah, 900);
    },
    lose() {
      duck(2000);
      arpeggio([67, 66, 65, 64], 0.35, { type: "sawtooth", vol: 0.4, last: 1.0 });
    },
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem("muted", muted ? "1" : "0");
      } catch {}
      if (master) master.gain.value = muted ? 0 : 1;
      song.muted = muted;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
})();
