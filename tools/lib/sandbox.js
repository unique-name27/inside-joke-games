'use strict';
/* ======================================================================
   tools/lib/sandbox.js -- a minimal Node `vm` sandbox that stands in for
   a browser tab: fake canvas/2D-context, fake AudioContext/audio-node
   graph, fake DOM elements, real localStorage/URL/URLSearchParams, a
   controllable fetch stub, and a `document.currentScript` stub (so
   ENGINE_ROOT computes correctly). This is the SAME verification
   methodology this project's engine/config rounds have used throughout
   development (Node `vm` + a stubbed sandbox, never a live browser) --
   promoted here from a one-off session script into a real, checked-in
   module so tools/verify-config.js (and anything else that wants a fast,
   headless playthrough of a CONFIG) can reuse it without reinventing it.
   Zero dependencies -- only Node's own `vm`/`fs` (used by callers, not
   this file) and standard globals.
   ====================================================================== */
function makeEventTarget(){
  const listeners = {};
  return {
    addEventListener(type, fn){ (listeners[type]=listeners[type]||[]).push(fn); },
    removeEventListener(type, fn){ if(listeners[type]) listeners[type]=listeners[type].filter(f=>f!==fn); },
    dispatch(type, evt){
      evt = evt || {};
      if(!evt.preventDefault) evt.preventDefault = function(){};
      if(!evt.stopPropagation) evt.stopPropagation = function(){};
      (listeners[type]||[]).slice().forEach(fn=>{ fn(evt); });
    }
  };
}
function makeFakeCtx(canvasObj){
  const state = { fillStyle:'', strokeStyle:'', globalAlpha:1, font:'', textAlign:'left', textBaseline:'alphabetic', lineWidth:1, imageSmoothingEnabled:true };
  const special = {
    canvas: canvasObj,
    measureText(text){ return { width: (text? String(text).length : 0) * 6 }; },
    createLinearGradient(){ return { addColorStop(){} }; },
    createRadialGradient(){ return { addColorStop(){} }; },
    getImageData(w,h){ return { data: new Uint8ClampedArray(4), width:w||1, height:h||1 }; },
    createImageData(w,h){ return { data: new Uint8ClampedArray(4), width:w||1, height:h||1 }; },
    setTransform(){}, resetTransform(){}, getTransform(){ return { a:1,b:0,c:0,d:1,e:0,f:0 }; },
  };
  const handler = {
    get(target, prop){
      if(prop in target) { const v = target[prop]; return typeof v==='function' ? v.bind(target) : v; }
      if(prop in state) return state[prop];
      if(typeof prop === 'symbol') return undefined;
      return function(){ return undefined; };
    },
    set(target, prop, value){
      if(prop in state){ state[prop]=value; return true; }
      target[prop]=value; return true;
    },
    has(){ return true; }
  };
  return new Proxy(special, handler);
}
function makeFakeCanvas(w,h){
  const c = {
    width: w||960, height: h||540,
    style: {},
    _ctx: null,
    getContext(){ if(!c._ctx) c._ctx = makeFakeCtx(c); return c._ctx; },
    getBoundingClientRect(){ return { left:0, top:0, width:c.width, height:c.height, right:c.width, bottom:c.height }; },
    addEventListener(){}, removeEventListener(){},
    toDataURL(){ return 'data:,'; },
    captureStream(){ return { getVideoTracks(){ return []; }, getAudioTracks(){ return []; } }; },
  };
  return c;
}
function makeFakeElement(tag){
  const listeners = {};
  return {
    tagName: (tag||'div').toUpperCase(),
    style: {}, children: [], _attrs: {},
    setAttribute(k,v){ this._attrs[k]=v; },
    getAttribute(k){ return this._attrs[k]; },
    appendChild(child){ this.children.push(child); return child; },
    removeChild(){}, remove(){},
    addEventListener(type, fn){ (listeners[type]=listeners[type]||[]).push(fn); },
    removeEventListener(){}, click(){},
    set href(v){ this._href = v; }, get href(){ return this._href; },
    set download(v){ this._download = v; },
  };
}
class FakeImage {
  constructor(){ this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; this._src = ''; this.onload = null; this.onerror = null; }
  set src(v){ this._src = v; }
  get src(){ return this._src; }
}
class FakeAudioParam {
  constructor(value){ this.value = value===undefined?1:value; this._events=[]; }
  setValueAtTime(v, t){ this.value = v; this._events.push(['set',v,t]); return this; }
  linearRampToValueAtTime(v, t){ this.value = v; this._events.push(['lin',v,t]); return this; }
  exponentialRampToValueAtTime(v, t){ this.value = v; this._events.push(['exp',v,t]); return this; }
  cancelScheduledValues(t){ this._events.push(['cancel',t]); return this; }
  setTargetAtTime(v,t,c){ this.value = v; return this; }
}
function makeFakeAudioNode(extra){
  const node = Object.assign({
    connect(target){ node._connectedTo = node._connectedTo||[]; node._connectedTo.push(target); return node; },
    disconnect(){}, start(t){ node._started = true; }, stop(t){ node._stopped = true; }, close(){},
  }, extra||{});
  return node;
}
function makeFakeAudioContext(){
  let _time = 0;
  const ctx = {
    get currentTime(){ return _time; },
    __advance(dt){ _time += dt; }, __setTime(t){ _time = t; },
    sampleRate: 44100, destination: makeFakeAudioNode(), state: 'running',
    resume(){ ctx.state='running'; return Promise.resolve(); },
    suspend(){ ctx.state='suspended'; return Promise.resolve(); },
    createGain(){ return makeFakeAudioNode({ gain: new FakeAudioParam(1) }); },
    createDynamicsCompressor(){ return makeFakeAudioNode({ threshold:new FakeAudioParam(-24), knee:new FakeAudioParam(30), ratio:new FakeAudioParam(12), attack:new FakeAudioParam(0.003), release:new FakeAudioParam(0.25) }); },
    createBiquadFilter(){ return makeFakeAudioNode({ frequency:new FakeAudioParam(350), Q:new FakeAudioParam(1), type:'lowpass' }); },
    createOscillator(){ return makeFakeAudioNode({ frequency:new FakeAudioParam(440), type:'sine', onended:null }); },
    createBufferSource(){ return makeFakeAudioNode({ buffer:null, loop:false, playbackRate:new FakeAudioParam(1), onended:null }); },
    createBuffer(channels, length, sampleRate){
      const data = new Float32Array(length);
      return { numberOfChannels:channels, length, sampleRate, duration:length/sampleRate, getChannelData(){ return data; } };
    },
    createMediaStreamDestination(){ return makeFakeAudioNode({ stream: { getAudioTracks(){ return []; } } }); },
    createStereoPanner(){ return makeFakeAudioNode({ pan: new FakeAudioParam(0) }); },
    createDelay(){ return makeFakeAudioNode({ delayTime: new FakeAudioParam(0) }); },
    createWaveShaper(){ return makeFakeAudioNode({ curve:null, oversample:'none' }); },
    createConvolver(){ return makeFakeAudioNode({ buffer:null }); },
    createChannelMerger(){ return makeFakeAudioNode(); },
    createChannelSplitter(){ return makeFakeAudioNode(); },
    createAnalyser(){ return makeFakeAudioNode({ fftSize:2048, frequencyBinCount:1024, getByteFrequencyData(){}, getByteTimeDomainData(){} }); },
    __decodeShouldSucceed: false,
    decodeAudioData(arrayBuffer, successCb, errorCb){
      const err = new Error('decode failed (harness)');
      Promise.resolve().then(()=>{ if(errorCb) errorCb(err); });
      return Promise.reject(err);
    },
  };
  return ctx;
}
function buildSandbox(opts){
  opts = opts || {};
  const network = opts.network || 'fail';
  const localStorageData = {};
  const localStorage = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(localStorageData,k) ? localStorageData[k] : null; },
    setItem(k,v){ localStorageData[k] = String(v); },
    removeItem(k){ delete localStorageData[k]; },
    clear(){ for(const k of Object.keys(localStorageData)) delete localStorageData[k]; },
  };
  const mainCanvas = makeFakeCanvas(960,540);
  const rafState = { cb: null, id: 0 };
  const document = Object.assign(makeEventTarget(), {
    getElementById(id){ return id==='c' ? mainCanvas : null; },
    createElement(tag){ return tag==='canvas' ? makeFakeCanvas(16,16) : makeFakeElement(tag); },
    body: makeFakeElement('body'), documentElement: makeFakeElement('html'),
    currentScript: { src: opts.currentScriptSrc || 'https://example.test/game/index.html' },
  });
  const windowTarget = makeEventTarget();
  const location = { search: opts.locationSearch || '', hash: opts.locationHash || '', href: '', pathname:'/game/' };
  const speechState = { calls: [], voices: [] };
  const speechSynthesis = { getVoices(){ return speechState.voices; }, speak(u){ speechState.calls.push(u); }, cancel(){}, onvoiceschanged: null };
  class FakeSpeechSynthesisUtterance {
    constructor(text){ this.text=text; this.volume=1; this.rate=1; this.pitch=1; this.lang=''; this.onend=null; }
  }
  const fetchCalls = [];
  function fakeFetch(url){
    fetchCalls.push(url);
    if(network==='succeed') return Promise.resolve({ ok: true, status: 200, arrayBuffer(){ return Promise.resolve(new ArrayBuffer(16)); } });
    return Promise.reject(new Error('no network in harness'));
  }
  const audioContexts = [];
  function FakeAudioContextCtor(){ const c = makeFakeAudioContext(); c.__decodeShouldSucceed = network==='succeed'; audioContexts.push(c); return c; }
  const sandbox = {
    console, Math, JSON, Array, Object, Date, RegExp, Map, Set, Promise, Error, isFinite, isNaN, parseFloat, parseInt,
    Uint8ClampedArray, Uint8Array, Float32Array, ArrayBuffer, URL, URLSearchParams,
    TextEncoder, TextDecoder,
    performance: (function(){ let t=0; return { now(){ return t; }, __set(v){ t=v; }, __advance(dt){ t+=dt; } }; })(),
    navigator: { getGamepads(){ return []; }, userAgent:'node-harness' },
    location, document, canvas: mainCanvas, Image: FakeImage,
    AudioContext: FakeAudioContextCtor, webkitAudioContext: undefined,
    SpeechSynthesisUtterance: FakeSpeechSynthesisUtterance, fetch: fakeFetch, localStorage,
    requestAnimationFrame(cb){ rafState.id++; rafState.cb = cb; return rafState.id; },
    cancelAnimationFrame(){}, MediaRecorder: undefined, MediaStream: undefined,
    Blob: function(){ return {}; }, setTimeout, clearTimeout, setInterval, clearInterval,
    __rafState: rafState, __speechState: speechState, __localStorageData: localStorageData,
    __fetchCalls: fetchCalls, __audioContexts: audioContexts,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.window.location = location;
  sandbox.window.addEventListener = windowTarget.addEventListener;
  sandbox.window.removeEventListener = windowTarget.removeEventListener;
  sandbox.__windowDispatch = windowTarget.dispatch;
  sandbox.window.speechSynthesis = speechSynthesis; sandbox.speechSynthesis = speechSynthesis;
  sandbox.window.localStorage = localStorage;
  sandbox.window.AudioContext = sandbox.AudioContext; sandbox.window.webkitAudioContext = undefined;
  sandbox.window.innerWidth = 960; sandbox.window.innerHeight = 540; sandbox.window.devicePixelRatio = 1;
  sandbox.window.fetch = sandbox.fetch; sandbox.window.MediaRecorder = undefined;
  sandbox.window.location.href = '';
  return sandbox;
}
module.exports = { buildSandbox, makeFakeAudioContext };
