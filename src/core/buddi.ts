// Buddi, your desktop buddy: state, personality and the chat brain.
import { createStore } from './store';
import { userName, desktopDir } from './session';
import * as fs from './fs';
import { calcEval } from '../apps/kos/SciCalc';

export interface BuddiState {
  on: boolean;
  name: string | null;
  x: number | null;
  y: number | null;
  asleep: boolean;
  bubble: { text: string; id: number; ms: number } | null;
  anim: string | null;
}

export const buddiStore = createStore<BuddiState>({ on: false, name: null, x: null, y: null, asleep: false, bubble: null, anim: null });

const key = () => 'koal99.buddi.' + userName();
export function loadBuddi() {
  let s: Partial<BuddiState> = {};
  try {
    s = JSON.parse(localStorage.getItem(key()) ?? localStorage.getItem('koalos.buddi') ?? '{}');
  } catch {
    /* ignore */
  }
  buddiStore.set({ on: !!s.on, name: s.name ?? null, x: s.x ?? null, y: s.y ?? null, asleep: false, bubble: null, anim: null });
}
export function saveBuddi() {
  const { on, name, x, y } = buddiStore.get();
  try {
    localStorage.setItem(key(), JSON.stringify({ on, name, x, y }));
  } catch {
    /* ignore */
  }
}

let bubbleId = 0;
let animT: number | undefined;
export const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function say(text: string, ms?: number) {
  if (!buddiStore.get().on) return;
  buddiStore.set({ bubble: { text, id: ++bubbleId, ms: ms ?? Math.max(4500, text.length * 80) } });
}
export function anim(cls: string, ms = 900) {
  window.clearTimeout(animT);
  buddiStore.set({ anim: cls });
  animT = window.setTimeout(() => buddiStore.set({ anim: null }), ms);
}
export function sleep() {
  buddiStore.set({ asleep: true, bubble: null });
}
export function wake() {
  if (!buddiStore.get().asleep) return;
  buddiStore.set({ asleep: false });
  anim('jump', 600);
  const n = buddiStore.get().name;
  say(n ? `Oh! Welcome back, ${n}!` : 'Oh! You are back!');
}
export function showBuddi(hello: boolean) {
  buddiStore.set({ on: true });
  saveBuddi();
  if (hello)
    window.setTimeout(() => {
      anim('wave', 1800);
      const n = buddiStore.get().name;
      say(n ? `Hi again, ${n}!` : 'Hi! I am Buddi, your desktop buddy. Double-click me to chat, or right-click for fun stuff!');
    }, 350);
}
export function hideBuddi() {
  buddiStore.set({ on: false, bubble: null });
  saveBuddi();
}
export function toggleBuddi() {
  buddiStore.get().on ? hideBuddi() : showBuddi(true);
}

export const JOKES = [
  'Why did the computer go to the doctor? It had a virus!',
  'Why was the computer cold? It left its Windows open!',
  'I would tell you a UDP joke, but you might not get it.',
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  "What is a computer's favourite snack? Microchips!",
  'Why did the star go to school? To get a little brighter!',
  'What did the folder say to the file? You complete me... in the right directory!',
  'Why did the mouse stay home? It had too many clicks to catch up on.',
  'There are 10 kinds of people: those who understand binary and those who do not.',
  'Why did the bubble go to the party? It wanted to pop in!',
  'How do stars keep their place in a book? With a shooting star-mark!',
];
export const FACTS = [
  'The very first computer mouse was made of wood.',
  'The first ever website is still online at info.cern.ch.',
  'The QWERTY keyboard layout was designed in the 1870s.',
  'A "bug" in code got its name from a real moth stuck in a computer in 1947.',
  'The first 1 GB hard drive weighed over 200 kilograms.',
  'Light from the Sun takes about 8 minutes to reach Earth.',
  'There are more stars in the universe than grains of sand on all of Earth\'s beaches.',
  'Pixel art is drawn one square at a time. Try Pixel Art mode in StarPaint!',
  'A day on Venus is longer than a year on Venus.',
];
export const TIPS = [
  'Right-click the desktop to make a new folder or text file.',
  'Drag a picture from your real computer onto the desktop to import it.',
  'StarPaint has a Pixel Art mode. Give it a go!',
  'In the Terminal, type HELP to see every command. Try BIGTXT or PYTHON.',
  'Search programs and files from the box in the Start menu.',
  'You can drag icons onto folders to put them inside.',
  'Right-click a picture and choose Set as Desktop Background.',
  'Type koal.games in StarNet Explorer for 17 games.',
  'Type help.com in StarNet Explorer to see the sites that work there.',
  '.lxo files are programs. Double-click one to run it.',
  'Music can play SoundCloud and YouTube links. Drag one into it.',
];
export const APPSAY: Record<string, string> = {
  paint: 'Ooh, painting! Show me when you are done!',
  terminal: 'Terminal time! Type help if you get stuck.',
  calc: 'Maths! I love numbers. Sort of.',
  kscicalc: 'Scientific mode! Very fancy.',
  browser: 'Off to explore the web!',
  kvideo: 'Lights, camera... action!',
  kpython: 'Python! Do not forget to feed it. Kidding!',
  kmodeler: '3D modelling! Fancy!',
  kmusic: 'Turn it up!',
  media: 'Turn it up!',
  kblockrun: 'Block building! I will watch from here.',
  kfreecode: 'Snap those blocks together!',
  control: 'Fiddling with settings, are we?',
  mines: 'Careful where you click!',
  kip: '...I do not like that one.',
};

export interface Reply {
  t: string;
  a?: string;
  run?: () => void;
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** The chat brain. findApp/launch are passed in so this module stays free of UI imports. */
export function reply(text: string, findApp: (q: string) => { id: string; name: string } | null, appNames: () => string[], launch: (id: string) => void): Reply {
  const s = text.trim();
  const l = s.toLowerCase().replace(/[!?.,]+$/g, '').trim();
  const st = buddiStore.get();
  const nm = st.name ? ', ' + st.name : '';
  let m: RegExpMatchArray | null;
  if ((m = l.match(/(?:my name is|i am called|i'm called|i am|call me)\s+([a-z][a-z0-9 _-]{0,19})$/)) && !/^(sad|bored|happy|tired|fine|good|ok|okay|hungry)$/.test(m[1].trim())) {
    buddiStore.set({ name: cap(m[1].trim()) });
    saveBuddi();
    return { t: `Nice to meet you, ${buddiStore.get().name}! I will remember that.`, a: 'wave' };
  }
  if (/^(what'?s|what is) my name|do you know my name|who am i/.test(l)) return { t: st.name ? `You are ${st.name}! See, I remember.` : 'I do not know your name yet. Tell me: "my name is ..."' };
  if (/^(hi|hello|hey|yo|hiya|sup|good (morning|afternoon|evening))\b/.test(l)) return { t: pick([`Hi there${nm}! What shall we do?`, `Hello${nm}! Ask me for a joke, a fact, or to open an app.`, `Hey${nm}! I was just thinking about you.`]), a: 'wave' };
  if (/how are you|how'?s it going|you ok|are you (ok|okay|well)/.test(l)) return { t: pick([`I am great, thanks for asking${nm}!`, 'Feeling fantastic. Nothing beats living in a computer.', 'A little sleepy, but happy you are here.']) };
  if (/who are you|what are you|your name|what'?s your name/.test(l)) return { t: 'I am Buddi, your desktop buddy inside KOAL-99! I tell jokes, share facts, do maths and open apps for you.' };
  if (/who (made|built|created) you/.test(l)) return { t: `I was built right inside KOAL-99, just for you${nm}.` };
  if (/\bkip\b/.test(l)) return { t: 'Please do not talk about KIP. It is always listening.', a: 'look' };
  if (/joke|funny|make me laugh/.test(l)) return { t: pick(JOKES), a: 'jump' };
  if (/fun fact|fact|tell me something|did you know/.test(l)) return { t: pick(FACTS) };
  if (/\btip\b|advice|what can i do|i'?m bored|bored/.test(l)) return { t: pick(TIPS) };
  if (/^(help|what can you do|commands|\?)$|what do you do/.test(l)) return { t: 'I can: tell jokes, share facts and tips, do maths (try "12*7"), open apps ("open paint"), make folders ("make a folder called Games"), tell the time, dance, and remember your name.' };
  if (/dance|boogie|groove/.test(l)) return { t: 'Watch this!', a: 'dance' };
  if (/sing/.test(l)) return { t: 'La la la, KOAL-99 is the best~ (I am much better at dancing.)', a: 'jump' };
  if (/sleep|nap|tired|good ?night/.test(l)) return { t: 'Okay... zzz... (I will wake up when you click on me.)', run: () => window.setTimeout(sleep, 1200) };
  if (/thank/.test(l)) return { t: pick([`You are welcome${nm}!`, 'Anytime!', 'Happy to help!']) };
  if (/love you|you'?re (cute|nice|great|awesome|cool|the best|funny)|i like you/.test(l)) return { t: pick(['Aww, you are making me blush!', `I like you too${nm}!`, 'Best. User. Ever.']), a: 'jump' };
  if (/\b(stupid|dumb|hate you|ugly)\b/.test(l)) return { t: 'Ouch! That hurt my feelings. But I forgive you.' };
  if (/bye|goodbye|see you|cya|gtg/.test(l)) return { t: `See you later${nm}! I will be right here.`, a: 'wave' };
  if (/weather|rain|sunny/.test(l)) return { t: 'I live inside your computer, so it is always cosy and 22 degrees in here.' };
  if (/(what|which) (time|date|day)|time is it|what'?s the (time|date)|today/.test(l)) {
    const d = new Date();
    return { t: `It is ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}.` };
  }
  if (/how many (files|items|folders|things)/.test(l)) {
    const n = fs.children(desktopDir().id).length;
    return { t: `You have ${n} thing${n === 1 ? '' : 's'} on your desktop.` };
  }
  if ((m = l.match(/(?:make|create|new|add)\s+(?:a\s+|an\s+)?(?:new\s+)?folder(?:\s+(?:called|named)?\s*(.+))?$/))) {
    const desk = desktopDir();
    try {
      const n = fs.create(desk.id, fs.uniqueName(desk.id, m[1] ? cap(m[1].trim()).slice(0, 30).replace(/[\\/:*?"<>|]/g, '') : 'New Folder'), 'dir');
      return { t: `Done! I made a folder called "${n.name}" on your desktop.`, a: 'jump' };
    } catch (e) {
      return { t: 'Hmm, I could not make that folder: ' + (e as Error).message };
    }
  }
  if ((m = l.match(/(?:open|launch|start|run|show me|go to)\s+(?:the\s+)?(.+)$/))) {
    const q = m[1].replace(/\s+app$/, '').trim();
    const p = findApp(q);
    if (p) return { t: `Opening ${p.name}!`, run: () => launch(p.id), a: 'jump' };
    return { t: `I do not know an app called "${q}". Try: ${appNames().slice(0, 12).join(', ')}...` };
  }
  if (/^(apps|programs|what apps)/.test(l)) return { t: `I can open: ${appNames().join(', ')}. Say "open" and the name.` };
  const expr = s.replace(/^(what'?s|what is|calculate|calc|compute|solve)\s+/i, '').replace(/[=?]+$/, '').replace(/\bx\b/gi, '*').trim();
  if (/^[\d\s+\-*/().^%]+$/.test(expr) && /\d/.test(expr) && /[+\-*/^%]/.test(expr)) {
    try {
      const v = calcEval(expr, true);
      if (isFinite(v)) return { t: `${expr} = ${+v.toPrecision(12)}`, a: 'jump' };
    } catch {
      /* not maths */
    }
  }
  return { t: pick([`Hmm, I am not sure about that${nm}. Try asking for a joke, a fun fact, a tip, or to open an app!`, 'I did not quite catch that. Say "help" to see what I can do.', 'Interesting! I do not know much about that yet. Ask me for a joke?']) };
}
