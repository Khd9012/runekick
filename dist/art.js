/**
 * RuneKick's generated sprite atlases and procedural pixel effects.
 * drawPitch(ctx, { width, height, time, opponentColor, phase, animation, heroMomentum, boss, reducedMotion })
 * drawCardArt(ctx, type, { width, height, upgraded, id })
 * drawPlayer(ctx, x, y, { scale, team, shirt, facing, pose, selected })
 * Player x/y is the centre of the player's feet. Time is in milliseconds.
 */

const C = {
  ink: '#102b29', deep: '#102f2b', night: '#0d2425',
  grass: '#235c43', stripe: '#28674b', grassDark: '#1d503d',
  line: '#c2d0a0', mint: '#a4e1b1', cream: '#f4e4be',
  home: '#e88060', homeLight: '#f5a17e', away: '#76a9b4',
  awayDark: '#324f65', gold: '#e7b956', skin: '#e8ae7d',
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, p) => a + (b - a) * p;
const snap = n => Math.round(n / 2) * 2;

const rasterArt = { striker: null, rival: null, stadium: null, coaches: null, equipment: null, legends: null, eliteRelics: null, cardTechnique: null, cardAttack: null, cardControl: null };
const atlasFrames = { striker: [], coaches: [], equipment: [], legends: [], eliteRelics: [], cardTechnique: [], cardAttack: [], cardControl: [] };
const CARD_ART = Object.freeze({
  'through-pass': ['cardTechnique', 0], 'quick-pass': ['cardTechnique', 1], 'one-two': ['cardTechnique', 2],
  'wall-pass': ['cardTechnique', 3], 'long-pass': ['cardTechnique', 4], dribble: ['cardTechnique', 5],
  feint: ['cardAttack', 0], sprint: ['cardAttack', 1], shot: ['cardAttack', 2],
  'power-shot': ['cardAttack', 3], volley: ['cardAttack', 4], clutch: ['cardAttack', 5],
  cover: ['cardControl', 0], intercept: ['cardControl', 1], tackle: ['cardControl', 2],
  focus: ['cardControl', 3], switch: ['cardControl', 4], captain: ['cardControl', 5],
});
const CARD_TYPE_DEFAULTS = Object.freeze({ pass: 'through-pass', dribble: 'dribble', shot: 'shot', defense: 'cover', tactic: 'focus' });
const COACH_FRAMES = Object.freeze({
  'coach-mourinho': 0, 'coach-ancelotti': 1, 'coach-guardiola': 2, 'coach-arteta': 3,
  'coach-wenger': 4, 'coach-ferguson': 5, 'coach-klopp': 6,
});
const LEGEND_FRAMES = Object.freeze({ legend: 0, 'legend-zidane': 1, 'legend-ronaldo': 2, elite: 3 });
const ELITE_RELIC_FRAMES = Object.freeze({
  'libero-seal': 0, 'catenaccio-band': 1, 'clean-sheet-crest': 2, 'maestro-touch': 3,
  'roulette-rune': 4, 'playmaker-lens': 5, 'fenom-cleats': 6, 'nine-crest': 7,
  'burst-laces': 8, 'street-rhythm': 9, 'ankle-tape': 10, 'tempo-charm': 11,
});
const EQUIPMENT_FRAMES = Object.freeze({
  'swift-boots': 0, 'power-cleats': 1, 'training-kit': 2, 'captain-band': 3,
  'grip-socks': 4, 'scouting-bag': 5, 'energy-flask': 6, 'lucky-coin': 7,
  'golden-whistle': 8, 'libero-seal': 9,
});
const EQUIPMENT_CATEGORIES = Object.freeze({ boots: 0, uniform: 2, jersey: 2, band: 3, socks: 4, bag: 5, bottle: 6, coin: 7, charm: 7, whistle: 8, medal: 9 });
let artLoading;

function characterBounds(pixels, imageWidth, x, y, width, height) {
  const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);
  let best=null,bestCount=0;
  const visible=index=>pixels[((y+Math.floor(index/width))*imageWidth+x+index%width)*4+3]>64;
  for(let start=0;start<seen.length;start++){
    if(seen[start])continue;seen[start]=1;
    if(!visible(start))continue;
    let read=0,write=1,left=width,top=height,right=0,bottom=0;queue[0]=start;
    while(read<write){
      const index=queue[read++],px=index%width,py=Math.floor(index/width);
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if((!dx&&!dy)||px+dx<0||px+dx>=width||py+dy<0||py+dy>=height)continue;
        const next=(py+dy)*width+px+dx;
        if(!seen[next]){seen[next]=1;if(visible(next))queue[write++]=next;}
      }
    }
    if(write>bestCount){bestCount=write;best=[x+left,y+top,x+right,y+bottom];}
  }
  return best;
}

function readAtlasFrames(picture, columns, rows, characters = false, rowEdges = null, characterPadding = 8) {
  const width=picture.naturalWidth,height=picture.naturalHeight;
  const frames=Array.from({length:columns*rows},(_,index)=>{
    const col=index%columns,row=Math.floor(index/columns),x=Math.round(col*width/columns),y=Math.round((rowEdges?.[row]??row/rows)*height);
    return [x,y,Math.round((col+1)*width/columns)-x,Math.round((rowEdges?.[row+1]??(row+1)/rows)*height)-y];
  });
  if(typeof document==='undefined')return frames;
  try {
    // Trim transparent margins once during loading; no pixel readback occurs in the frame loop.
    const surface=document.createElement('canvas');surface.width=width;surface.height=height;
    const scan=surface.getContext('2d',{willReadFrequently:true});
    if(!scan)return frames;
    scan.drawImage(picture,0,0);
    const pixels=scan.getImageData(0,0,width,height).data;
    return frames.map(([cellX,cellY,cellW,cellH])=>{
      // A pointing hand can cross a nominal cell edge. Keep the main connected
      // silhouette, excluding stray pixels from an adjacent coach or row.
      const pad=characters?characterPadding:0,x=Math.max(0,cellX-pad),y=Math.max(0,cellY-pad);
      const w=Math.min(width,cellX+cellW+pad)-x,h=Math.min(height,cellY+cellH+pad)-y;
      let left=x+w,top=y+h,right=-1,bottom=-1;
      if(characters){
        const bounds=characterBounds(pixels,width,x,y,w,h);
        if(bounds)[left,top,right,bottom]=bounds;
      } else for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(pixels[(py*width+px)*4+3]>64){
          left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
      }
      if(right<0)return null;
      left=Math.max(x,left-3);top=Math.max(y,top-3);right=Math.min(x+w-1,right+3);bottom=Math.min(y+h-1,bottom+3);
      return [left,top,right-left+1,bottom-top+1];
    });
  } catch { return frames; }
}

/** Load the original PNG assets once. Missing assets retain their procedural fallback. */
export function initArt() {
  if (artLoading) return artLoading;
  if (typeof Image === 'undefined') return Promise.resolve(Object.fromEntries(Object.keys(rasterArt).map(key => [key, false])));
  const sources = { striker: 'striker-football.png', rival: 'rival.png', stadium: 'youth-stadium.png', coaches: 'coaches.png', equipment: 'equipment.png', legends: 'legends.png', eliteRelics: 'elite-relics.png', cardTechnique: 'cards-technique.png', cardAttack: 'cards-attack.png', cardControl: 'cards-control.png' };
  artLoading = Promise.all(Object.entries(sources).map(([key, filename]) => new Promise(resolve => {
    const picture = new Image();
    picture.decoding = 'async';
    picture.onload = () => {
      rasterArt[key] = picture;
      // Scan all visible pieces so the normal football remains in the crop
      // even if a small transparent gap separates it from the player's boot.
      if(key==='striker')atlasFrames.striker=readAtlasFrames(picture,1,1);
      if(key==='coaches')atlasFrames.coaches=readAtlasFrames(picture,4,2,true);
      if(key==='equipment')atlasFrames.equipment=readAtlasFrames(picture,4,3);
      // Use each atlas's empty gutters; connected bounds keep the wide Ronaldo
      // stance intact without including a neighbouring figure's boots.
      if(key==='legends')atlasFrames.legends=readAtlasFrames(picture,2,2,true,[0,.52,1],24);
      if(key==='eliteRelics')atlasFrames.eliteRelics=readAtlasFrames(picture,4,3,false,[0,1/3,.65,1]);
      // The focus halo begins above the mathematical midline; all three sheets
      // have an empty gutter at 46%, so no adjacent action leaks into a crop.
      if(key.startsWith('card'))atlasFrames[key]=readAtlasFrames(picture,3,2,false,[0,.46,1]);
      resolve([key, true]);
    };
    picture.onerror = () => resolve([key, false]);
    picture.src = new URL('./assets/' + filename, import.meta.url).href;
  }))).then(entries => Object.fromEntries(entries));
  return artLoading;
}

function drawRasterFighter(ctx, picture, x, footY, options = {}) {
  const height = options.height || 248;
  const crop = options.crop || [0, 0, picture.naturalWidth, picture.naturalHeight];
  const width = height * crop[2] / crop[3];
  ctx.save();
  ctx.translate(Math.round(x), Math.round(footY));
  ctx.rotate(options.lean || 0);
  ctx.drawImage(picture, ...crop, -width / 2, -height, width, height);
  if (options.hit) {
    ctx.globalAlpha = options.hit;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(picture, ...crop, -width / 2, -height, width, height);
  }
  ctx.restore();
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(snap(x), snap(y), Math.max(2, snap(w)), Math.max(2, snap(h)));
}

function frame(ctx, x, y, w, h, color, thickness = 2) {
  rect(ctx, x, y, w, thickness, color);
  rect(ctx, x, y + h - thickness, w, thickness, color);
  rect(ctx, x, y, thickness, h, color);
  rect(ctx, x + w - thickness, y, thickness, h, color);
}

function pixelEllipse(ctx, x, y, rx, ry, color, thickness = 0, cell = 2) {
  ctx.fillStyle = color;
  const ix = Math.max(0, rx - thickness), iy = Math.max(0, ry - thickness);
  for (let py = -ry; py <= ry; py += cell) {
    for (let px = -rx; px <= rx; px += cell) {
      const outside = px * px / (rx * rx) + py * py / (ry * ry);
      const inside = thickness && ix && iy ? px * px / (ix * ix) + py * py / (iy * iy) : 2;
      if (outside <= 1 && inside >= 1) ctx.fillRect(snap(x + px), snap(y + py), cell, cell);
    }
  }
}

function dashedPath(ctx, x1, y1, x2, y2, color, arc = 0, count = 14) {
  for (let i = 1; i < count; i++) {
    if (i % 3 === 0) continue;
    const p = i / count;
    rect(ctx, lerp(x1, x2, p), lerp(y1, y2, p) - Math.sin(p * Math.PI) * arc, 4, 4, color);
  }
}

function cross(ctx, x, y, size, color) {
  rect(ctx, x - size, y - 1, size * 2 + 2, 2, color);
  rect(ctx, x - 1, y - size, 2, size * 2 + 2, color);
}

function ball(ctx, x, y, scale = 2) {
  ctx.save();
  ctx.translate(snap(x), snap(y));
  ctx.scale(scale, scale);
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  r(-4, 2, 10, 3, '#143e30');
  r(-3, -5, 6, 1, C.ink); r(-4, -4, 8, 8, C.ink); r(-3, 4, 6, 1, C.ink);
  r(-3, -4, 6, 8, '#fbf0d0'); r(-4, -2, 8, 4, '#fbf0d0');
  r(-1, -2, 3, 3, C.ink); r(-3, -4, 2, 2, C.ink);
  r(2, 2, 2, 2, C.ink); r(-4, 1, 2, 2, C.ink); r(3, -2, 1, 2, C.ink);
  r(0, -4, 2, 1, '#ffffff');
  ctx.restore();
}

/** A readable 16-by-24 pixel footballer, anchored at the feet. */
export function drawPlayer(ctx, x, y, options = {}) {
  const { scale = 2, team = 'home', facing = 1, pose = 'idle', selected = false } = options;
  const shirt = options.shirt || (team === 'home' ? C.home : team === 'keeper' ? C.gold : C.away);
  const trim = team === 'home' ? C.homeLight : team === 'keeper' ? '#f4d57f' : '#a9ced1';
  const shorts = team === 'home' ? '#583e3f' : '#294252';
  ctx.save();
  ctx.translate(snap(x), snap(y));
  ctx.scale(scale * (facing < 0 ? -1 : 1), scale);
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  r(-7, -1, 15, 3, '#174331'); r(-5, -2, 11, 5, '#174331');
  if (selected) {
    r(-9, 1, 4, 2, C.gold); r(6, 1, 4, 2, C.gold);
    r(-5, 3, 11, 1, C.gold);
  }
  const running = pose === 'run' || pose === 'kick';
  // Two separate socks and boots keep the silhouette legible at small sizes.
  r(-4, -8, 3, 7, C.ink); r(2, -8, 3, running ? 5 : 7, C.ink);
  r(-3, -6, 2, 4, C.cream); r(3, -6, 2, running ? 2 : 4, C.cream);
  r(-5, -2, 5, 2, '#112b2b');
  r(running ? 4 : 2, running ? -4 : -2, 5, 2, '#112b2b');
  if (pose === 'kick') { r(5, -7, 4, 2, C.cream); r(8, -7, 3, 2, C.ink); }
  r(-5, -12, 11, 5, C.ink); r(-4, -12, 9, 4, shorts);
  r(-5, -19, 11, 9, C.ink); r(-4, -18, 9, 8, shirt);
  r(-4, -18, 2, 6, trim); r(-3, -11, 8, 1, trim);
  r(2, -16, 2, 4, C.cream); r(3, -16, 1, 1, shirt);
  const raised = pose === 'celebrate';
  r(-7, raised ? -22 : -17, 3, raised ? 8 : 5, shirt);
  r(6, raised ? -22 : -17, 3, raised ? 8 : 5, shirt);
  r(-7, raised ? -24 : -13, 2, 3, C.skin);
  r(7, raised ? -24 : running ? -16 : -13, 2, 3, C.skin);
  r(-2, -20, 5, 3, C.skin);
  r(-3, -26, 7, 7, C.ink); r(-2, -25, 6, 6, C.skin);
  r(-3, -26, 7, 3, '#302e2b'); r(-3, -23, 2, 3, '#302e2b');
  r(4, -23, 1, 3, C.skin); r(2, -23, 1, 1, '#43342b');
  r(-1, -20, 4, 1, '#c98d68');
  ctx.restore();
}

function cone(ctx, x, y, scale = 1) {
  rect(ctx, x - 7 * scale, y, 16 * scale, 4 * scale, '#194b36');
  rect(ctx, x - 6 * scale, y - 2 * scale, 14 * scale, 4 * scale, '#ae7a35');
  rect(ctx, x - 4 * scale, y - 6 * scale, 10 * scale, 4 * scale, C.gold);
  rect(ctx, x - 2 * scale, y - 10 * scale, 6 * scale, 4 * scale, '#f0cb6c');
  rect(ctx, x, y - 14 * scale, 2 * scale, 4 * scale, '#f0cb6c');
  rect(ctx, x - 2 * scale, y - 6 * scale, 6 * scale, 2 * scale, '#fff0b6');
}

/** A large, side-on character. Four canvas pixels make one sprite pixel. */
function drawDuelist(ctx, x, y, options = {}) {
  const home = options.home !== false, facing = home ? 1 : -1;
  const shirt = home ? '#d87256' : options.shirt || '#629aa9';
  const shade = home ? '#a94f43' : '#35616d';
  const light = home ? '#f39a70' : '#a6c8c7';
  const trim = '#efdfb5', skin = home ? '#eab17f' : '#cc956b';
  const skinShade = home ? '#bd765c' : '#99674f';
  const outline = '#122b28';
  ctx.save();
  ctx.translate(snap(x), snap(y));
  ctx.scale(4 * facing, 4);
  const r = (a,b,w,h,c) => {ctx.fillStyle=c;ctx.fillRect(a,b,w,h);};
  // Strong separate legs, striped socks and oversized studded boots.
  r(-11,-23,11,13,outline); r(-10,-13,8,12,outline);
  r(2,-23,12,13,outline); r(5,-13,8,12,outline);
  r(-9,-15,7,5,skinShade); r(4,-15,8,5,skin);
  r(-9,-10,6,8,trim); r(6,-10,6,8,trim);
  r(-9,-9,6,2,shade); r(6,-9,6,2,shade);
  r(-8,-6,4,4,'#d0c4a2'); r(7,-6,4,4,'#fff1c8');
  r(-15,-3,13,4,outline); r(4,-3,16,4,outline);
  r(-14,-3,11,2,home?'#914839':'#3b626a'); r(6,-3,12,2,home?'#bd6549':'#4b7f89');
  r(-10,-3,4,1,trim); r(10,-3,5,1,trim);
  r(-14,1,3,1,'#b4bd9a'); r(-7,1,3,1,'#b4bd9a');
  r(6,1,3,1,'#b4bd9a'); r(15,1,3,1,'#b4bd9a');
  // Shorts with hems and pocket seams.
  r(-12,-25,27,11,outline); r(-10,-24,23,8,home?'#493839':'#243d4a');
  r(-9,-23,3,8,shade); r(10,-23,2,7,shade);
  r(-9,-17,8,2,trim); r(4,-17,8,2,trim); r(0,-19,3,5,outline);
  // Arms hold an athletic, slightly forward stance.
  r(-17,-38,8,14,outline); r(-19,-29,8,8,outline);
  r(-16,-37,6,10,shade); r(-17,-28,5,6,skinShade);
  r(-18,-24,6,4,skin); r(-18,-22,5,2,skinShade);
  r(11,-38,8,13,outline); r(14,-29,7,8,outline);
  r(12,-37,6,9,shirt); r(15,-29,5,6,skin);
  r(16,-24,5,4,skinShade); r(17,-24,3,2,skin);
  r(-16,-29,6,2,trim); r(13,-29,5,2,trim);
  // Neck, shirt silhouette, shoulder highlights, collar and seam detail.
  r(-4,-44,11,7,outline); r(-3,-44,9,6,skinShade);
  r(-12,-41,25,5,outline); r(-14,-37,29,15,outline); r(-10,-23,23,3,outline);
  r(-11,-40,23,5,shirt); r(-12,-36,25,13,shirt); r(-9,-23,20,2,shade);
  r(-12,-36,4,11,shade); r(-8,-39,3,5,light); r(9,-37,4,12,light);
  r(-10,-40,5,2,trim); r(7,-40,5,2,trim);
  r(-5,-40,12,2,trim); r(-3,-38,8,2,trim); r(-1,-37,4,1,shade);
  r(6,-35,4,4,'#e6c17a'); r(7,-34,2,2,home?'#9c4f40':'#385b65');
  r(-8,-25,17,1,light); r(-6,-24,13,1,shade);
  // The protagonist's 09 and the rival's 11 are actual pixel glyphs.
  const digits = home ? ['111','101','101','101','111','000','111','101','111','001','111'] : ['010','110','010','010','111','000','010','110','010','010','111'];
  for(let row=0;row<5;row++) for(let col=0;col<3;col++) {
    if(digits[row][col]==='1') r(-5+col,-33+row,1,1,trim);
    if(digits[row+6][col]==='1') r(-1+col,-33+row,1,1,trim);
  }
  // Large profile: visible eye, brow, nose, cheek and short natural hair.
  r(-10,-57,20,15,outline); r(-7,-55,16,13,skin);
  r(-10,-50,5,7,skinShade); r(-9,-49,3,4,skin);
  r(-6,-44,14,3,skinShade); r(-5,-43,10,2,skin);
  r(9,-49,3,5,skin); r(10,-46,2,1,skinShade);
  r(2,-50,6,2,'#f7e8c5'); r(6,-50,2,2,'#24312c');
  r(2,-52,6,1,home?'#4d2c27':'#3b302a');
  r(5,-44,4,1,'#754c3c'); r(7,-45,2,1,'#e6a077');
  r(-10,-58,19,5,home?'#372b29':'#3a332c');
  r(-7,-60,8,3,home?'#372b29':'#3a332c'); r(1,-59,6,3,home?'#372b29':'#3a332c');
  r(-11,-56,5,7,home?'#372b29':'#3a332c');
  r(-8,-57,6,2,home?'#724333':'#6b5a3c'); r(-1,-56,6,1,home?'#9b503b':'#8d7950');
  if(!home) {
    r(-10,-53,20,2,trim); r(-12,-53,3,3,'#cfc5a2');
    r(-16,-53,5,2,trim); r(-16,-51,3,4,'#cfc5a2');
  }
  r(-10,-51,3,3,home?'#372b29':'#3a332c');
  // A warm side highlight keeps the profile clear against the dark stands.
  r(8,-52,1,2,'#ffd3a1'); r(8,-46,1,2,'#ffd3a1');
  if(options.hit) {
    ctx.globalAlpha=options.hit;
    r(-12,-39,26,17,'#ffe6ba'); r(-8,-55,17,12,'#ffe6ba');
  }
  ctx.restore();
}

function duelStadium(ctx) {
  rect(ctx,0,0,960,400,'#102925');
  rect(ctx,0,0,960,64,'#102824');
  rect(ctx,0,64,960,46,'#15342c');
  // Dark roof trusses and warm floodlights make a theatrical little arena.
  rect(ctx,0,14,960,6,'#213e31'); rect(ctx,0,28,960,2,'#294332');
  for(let x=30;x<960;x+=90) {
    rect(ctx,x,18,4,60,'#203e31');
    for(let j=0;j<8;j++) rect(ctx,x+j*6,22+j*6,8,3,'#1c392d');
  }
  for(const x of [64,876]) {
    rect(ctx,x+4,28,6,135,'#375343'); rect(ctx,x-18,30,52,18,'#61715a');
    rect(ctx,x-22,34,60,10,'#7b8466');
    for(let k=0;k<6;k++) { rect(ctx,x-17+k*9,32,6,5,'#d3d0a0'); rect(ctx,x-17+k*9,40,6,4,'#aeb88a'); }
    ctx.globalAlpha=.035;
    for(let j=0;j<8;j++) rect(ctx,x-16-j*12,52+j*14,48+j*24,14,'#fff0b5');
    ctx.globalAlpha=1;
  }
  // A faded cup emblem, behind the characters and away from their faces.
  rect(ctx,454,44,52,6,'#6b7150'); rect(ctx,460,50,40,24,'#5b6748');
  rect(ctx,448,50,8,18,'#5b6748'); rect(ctx,504,50,8,18,'#5b6748');
  rect(ctx,452,66,12,6,'#5b6748'); rect(ctx,496,66,12,6,'#5b6748');
  rect(ctx,466,74,28,6,'#5b6748'); rect(ctx,476,80,8,12,'#5b6748'); rect(ctx,466,92,28,4,'#69714d');
  const colors=['#b8a071','#6a8f73','#9d7357','#8ba083','#cca472','#596f60'];
  for(let row=0;row<3;row++) {
    const y=112+row*25;
    rect(ctx,0,y+13,960,4,'#3a5840'); rect(ctx,0,y+17,960,7,'#152f27');
    for(let col=0;col<53;col++) {
      if(col%17===0) continue;
      const x=10+col*18+(row%2)*4;
      const color=colors[(col*3+row+Math.floor(col/4))%colors.length];
      rect(ctx,x,y,6,6,color); rect(ctx,x-2,y+6,10,7,(col+row)%3?'#49664e':'#785c43');
    }
  }
  rect(ctx,0,185,960,34,'#18392c'); rect(ctx,0,185,960,4,'#75906a');
  for(let i=0;i<8;i++) {
    const x=14+i*120;
    rect(ctx,x,194,108,16,i%2?'#304e39':'#4e5540');
    rect(ctx,x+8,200,30,3,i%2?'#68815a':'#8b8c61');
    rect(ctx,x+44,198,6,8,i%2?'#68815a':'#8b8c61');
    rect(ctx,x+58,200,40,3,i%2?'#68815a':'#8b8c61');
  }
  rect(ctx,0,219,960,181,'#24503a');
  rect(ctx,0,238,960,32,'#28583e'); rect(ctx,0,302,960,42,'#2b5c40'); rect(ctx,0,380,960,20,'#1e4934');
  rect(ctx,0,231,960,3,'#78976b'); rect(ctx,0,235,960,2,'#153b2a');
  // Perspective field markings, decorative rather than a top-down map.
  ctx.globalAlpha=.33;
  for(let i=0;i<42;i++) {
    rect(ctx,175-i*5,236+i*4,8,4,'#b7c48f');
    rect(ctx,780+i*5,236+i*4,8,4,'#b7c48f');
  }
  pixelEllipse(ctx,480,342,186,38,'#a6b987',2);
  rect(ctx,476,236,6,78,'#a6b987'); rect(ctx,476,380,6,20,'#a6b987');
  ctx.globalAlpha=1;
  for(let i=0;i<28;i++) {
    const x=18+i*35, y=258+(i*43)%114;
    rect(ctx,x,y,10,2,'#356547'); rect(ctx,x+4,y-2,2,2,'#47754f');
  }
  rect(ctx,0,397,960,3,'#173e2c');
}

function drawDefenderShield(ctx, x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  rect(ctx,-16,-18,32,24,'#17352e');
  rect(ctx,-12,6,24,8,'#17352e'); rect(ctx,-6,14,12,6,'#17352e');
  rect(ctx,-14,-16,28,22,'#d7b363');
  rect(ctx,-10,6,20,6,'#d7b363'); rect(ctx,-4,12,8,6,'#d7b363');
  rect(ctx,-12,-14,24,4,'#ffe2a0'); rect(ctx,10,-10,2,14,'#ffe2a0');
  rect(ctx,-10,-10,20,14,'#36596a'); rect(ctx,-6,4,12,6,'#36596a');
  rect(ctx,-8,-8,6,10,'#4a7480');
  rect(ctx,-2,-8,4,18,'#efcf87'); rect(ctx,-8,-2,16,4,'#efcf87');
  rect(ctx,-2,-2,4,4,'#fff1c1');
  ctx.restore();
}

function drawLegendRune(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.globalAlpha=.25; pixelEllipse(ctx,0,6,88,20,'#e6bd68');
  ctx.globalAlpha=.9; pixelEllipse(ctx,0,6,88,20,'#e2bd73',2);
  pixelEllipse(ctx,0,6,68,12,'#b99c5e',2);
  for(const [rx,ry] of [[-88,6],[88,6],[0,-14],[0,26]]) {
    rect(ctx,rx-4,ry-2,8,4,'#f7dda0'); rect(ctx,rx-2,ry-4,4,8,'#f7dda0');
  }
  rect(ctx,-20,27,40,2,'#e5c47e'); rect(ctx,-12,31,24,2,'#d8b96b');
  ctx.restore();
}

function drawMomentumAura(ctx, x, y, scale, momentum, time) {
  if (!Number.isFinite(momentum) || momentum <= 0) return;
  const strength = Math.sqrt(clamp(momentum, 0, 12) / 12);
  const animated = Number.isFinite(time) && time > 0;
  const clock = animated ? time : 0;
  const shimmer = animated ? .93 + Math.sin(clock / 540) * .07 : .85;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  // A few stepped bands keep the glow pixel-shaped and cheap on mobile.
  // Everything is behind the sprite, inside the character's own stage space.
  ctx.globalAlpha = (.075 + strength * .1) * shimmer;
  for (let row = 0; row < 11; row++) {
    const breadth = 48 + Math.sin((row + .5) / 11 * Math.PI) * (25 + strength * 8);
    rect(ctx, -breadth, -238 + row * 21, breadth * 2, 22, '#e7b956');
  }
  const flameOpacity = (.22 + strength * .25) * shimmer;
  const wispWidths = [8, 12, 10, 8, 4, 2], wispBends = [0, -3, 2, 5, 1, 8];
  for (const side of [-1, 1]) {
    for (let flame = 0; flame < 3; flame++) {
      const height = 76 + strength * (54 + flame * 24);
      const lift = animated ? Math.sin(clock / 680 + flame * 2.1) * 5 : 0;
      const edge = side * (62 + flame * 12);
      // Broken, narrowing steps bend into a wisp instead of a solid pillar.
      for (let step = 0; step < 6; step++) {
        const breadth = wispWidths[step];
        const bend = side * wispBends[step];
        const rise = height / 6;
        ctx.globalAlpha = flameOpacity * (.72 + step * .055);
        rect(ctx, edge + bend - breadth / 2, -24 - (step + 1) * rise + lift,
          breadth, Math.max(4, rise - 3), step > 3 ? '#ffe3a0' : '#e7b956');
      }
    }
  }
  ctx.globalAlpha = (.42 + strength * .34) * shimmer;
  for (let segment = 0; segment < 16; segment++) {
    const angle = segment * Math.PI / 8;
    rect(ctx, Math.cos(angle) * (65 + strength * 9) - 4, Math.sin(angle) * 11 - 1, 8, 2, '#efc76d');
  }
  const count = 6 + Math.floor(strength * 8);
  for (let i = 0; i < count; i++) {
    const travel = (clock / (1900 + (i % 3) * 350) + i * .381966) % 1;
    const side = i % 2 ? -1 : 1;
    const px = side * (64 + (i * 7) % 22) + Math.sin(travel * Math.PI * 2 + i) * 4;
    const py = -24 - travel * 220;
    ctx.globalAlpha = (.36 + strength * .44) * (.55 + Math.sin(travel * Math.PI) * .45) * shimmer;
    const size = i % 3 === 0 ? 6 : 4;
    rect(ctx, px, py, size, size, i % 3 === 0 ? '#fff0bd' : '#efc76d');
  }
  ctx.restore();
}

// Tactical diagrams use a small fixed number of pixel stamps, independent of
// canvas size or damage. They stay at boot/waist height so faces remain clear.
function fxLine(ctx, x1, y1, x2, y2, color, width = 3, steps = 10, dashed = false) {
  for(let i=0;i<=steps;i++) {
    if(dashed && i%3===2)continue;
    const t=i/steps;rect(ctx,lerp(x1,x2,t)-width/2,lerp(y1,y2,t)-width/2,width,width,color);
  }
}
function fxArrow(ctx, x1, y1, x2, y2, color, width = 3) {
  fxLine(ctx,x1,y1,x2,y2,color,width,12);
  const a=Math.atan2(y2-y1,x2-x1),size=12;
  for(const side of [-1,1])fxLine(ctx,x2,y2,x2-Math.cos(a+side*.65)*size,y2-Math.sin(a+side*.65)*size,color,width,4);
}
function fxRing(ctx,x,y,radius,color,progress=0,count=16,spread=1,stamp=4) {
  for(let i=0;i<count;i++) {
    const a=i*Math.PI*2/count+progress;
    rect(ctx,x+Math.cos(a)*radius-stamp/2,y+Math.sin(a)*radius*spread-stamp/2,stamp,stamp,color);
  }
}
function drawBossTactics(ctx, heroX, enemyX, footY, fit, boss, animation, time, reduced) {
  if(!boss && !animation?.bossId)return;
  const id=animation?.bossId||boss.id,effect=animation?.bossEffect||boss?.effect||'normal';
  const p=clamp(Number(animation?.progress)||0,0,1),active=!!animation?.bossId;
  const weight=active&&!reduced?1.6:1;
  const beat=reduced?0:Math.sin((Number(time)||0)/600)*.5+.5;
  const progress=clamp((Number(boss?.progress)||0)/Math.max(1,Number(boss?.max)||1),0,1);
  const broken=!!animation?.bossCountered||effect==='setpiece-broken'||!!boss?.countered;
  const reach=Math.min(250,(enemyX-heroX)/fit-110),centre=(heroX+enemyX)/2;
  ctx.save();ctx.translate(centre,footY);ctx.scale(fit,fit);
  const left=(heroX-centre)/fit,right=(enemyX-centre)/fit;
  ctx.globalAlpha=reduced?.55:active?.96:.46+beat*.1;
  if(id==='coach-mourinho') {
    const x=right-94;
    for(let row=0;row<4;row++)for(let col=0;col<2;col++) {
      const fracture=broken&&!reduced?(p*16*(col?1:-1)):0;
      frame(ctx,x+col*22+(row%2)*4+fracture,-108+row*23+(broken?p*row*5:0),20,20,broken?'#829aa6':'#85ceee',2*weight);
    }
    if(effect==='counter')fxArrow(ctx,right-65,-50,left+75+(reduced?0:(1-p)*32),-50,'#b8e8ff',5*weight);
  } else if(id==='coach-guardiola') {
    const close=reduced?progress*18:progress*18+(active?Math.sin(p*Math.PI)*22:beat*4);
    for(const side of [-1,1]) {
      const x=side*(reach*.35-close);
      fxLine(ctx,x-side*28,-108,x,-60,'#81d6cc',3*weight,8,true);
      fxLine(ctx,x,-60,x-side*28,-12,'#81d6cc',3*weight,8,true);
      cross(ctx,x,-60,5*weight,'#d8f4df');
    }
    fxLine(ctx,-reach*.35+close,-60,reach*.35-close,-60,broken?'#687e7e':'#92d9cb',2*weight,9,true);
  } else if(id==='coach-klopp') {
    const recovering=effect==='recover',color=recovering?'#8da69c':'#ef8e75';
    for(let row=0;row<3;row++) {
      const travel=reduced?0:active?p*22:beat*7;
      const y=-24-row*26;
      if(recovering)fxLine(ctx,-32+row*10,y,20+row*10,y,color,3*weight,6,true);
      else fxArrow(ctx,reach*.32+row*12-travel,y,-reach*.3+row*12-travel,y,color,3*weight);
    }
  } else if(id==='coach-ancelotti') {
    const color=effect==='adapt-attack'?'#85d7fa':effect==='adapt-defense'?'#efac82':'#9fd5ae';
    const rotation=reduced?0:active?p*.7:Math.sin((Number(time)||0)/1700)*.08;
    const nodes=Array.from({length:3},(_,i)=>{const a=i*Math.PI*2/3+rotation;return[Math.cos(a)*54,-63+Math.sin(a)*34];});
    for(let i=0;i<3;i++) {const a=nodes[i],b=nodes[(i+1)%3];fxArrow(ctx,...a,...b,color,2*weight);frame(ctx,a[0]-5,a[1]-5,10,10,'#e6d4b3',2*weight);}
  } else if(id==='coach-arteta') {
    const color=broken?'#809289':effect==='setpiece-shot'?'#ffd396':'#e0bc7d';
    const arcSteps=active?24:16,travel=!reduced&&active&&effect==='setpiece-shot'?clamp(p*1.6,0,1):1;
    for(let i=0;i<=arcSteps;i++) {
      if(i%3===2 || (broken&&i%2))continue;
      const t=i/arcSteps;
      if(t>travel)continue;
      rect(ctx,lerp(right+48,left+48,t),-18-Math.sin(t*Math.PI)*106,6*weight,4*weight,color);
    }
    if(active&&!reduced&&!broken&&effect==='setpiece-shot')ball(ctx,lerp(right+48,left+48,travel),-18-Math.sin(travel*Math.PI)*106,1.6);
    const tx=left+48,ty=-18;
    for(const side of [-1,1]){fxLine(ctx,tx+side*20,ty-14,tx+side*20,ty+14,color,3*weight,4);fxLine(ctx,tx+side*20,ty-14,tx+side*10,ty-14,color,3*weight,3);}
    if(broken){fxLine(ctx,-12,-100,12,-76,'#b0d4bd',4*weight,6);fxLine(ctx,12,-100,-12,-76,'#b0d4bd',4*weight,6);}
    else {rect(ctx,right+45,-50,3,33,color);rect(ctx,right+48,-50,15,10,color);}
  } else if(id==='coach-wenger') {
    const shift=reduced?0:Math.sin((Number(time)||0)/900)*3;
    const nodes=[[-62,-22],[0,-70-shift],[62,-22]];
    for(let i=0;i<2;i++) {
      const a=nodes[i],b=nodes[i+1];
      if(!broken)fxLine(ctx,...a,...b,'#a1d5b2',3*weight,10,true);
      else {const dx=(b[0]-a[0])*.32,dy=(b[1]-a[1])*.32;fxLine(ctx,...a,a[0]+dx,a[1]+dy,'#7c9d86',3*weight,4);fxLine(ctx,b[0]-dx,b[1]-dy,...b,'#7c9d86',3*weight,4);}
    }
    for(const [x,y] of nodes)fxRing(ctx,x,y,8,'#d3e7b4',0,6,1,4*weight);
  } else if(id==='coach-ferguson') {
    const overtime=effect==='overtime',radius=(active&&!reduced?43:37)+(!reduced&&overtime?beat*4:0);
    const color=overtime?'#ffca76':'#a79a82';
    fxRing(ctx,0,-56,radius,color,0,12,1,4*weight);
    const angle=reduced?-Math.PI/2:-Math.PI/2+(active?p*1.5:progress)*Math.PI;
    fxLine(ctx,0,-56,Math.cos(angle)*(active?28:22),-56+Math.sin(angle)*(active?28:22),color,3*weight,9);
    fxLine(ctx,0,-56,12,-48,color,3*weight,4);
    rect(ctx,-8,-104,16,4,color);
    if(overtime)for(const side of [-1,1])fxLine(ctx,side*50,-48,side*65,-68,color,3*weight,5);
  }
  ctx.restore();
}
function drawImpactBurst(ctx,x,y,fit,life,intensity,reduced,color='#f3b75f') {
  if(life<0||life>=1)return;
  ctx.save();ctx.translate(x,y);ctx.scale(fit,fit);
  ctx.globalAlpha=reduced?.65:Math.pow(1-life,.7);
  if(reduced){cross(ctx,0,0,9+intensity*4,color);ctx.restore();return;}
  const count=10+Math.floor(intensity*14),radius=12+life*(40+intensity*66);
  for(let i=0;i<count;i++) {
    const angle=i*Math.PI*2/count+i*.17,reach=radius*(.65+(i%4)*.12),size=(i%3===0?6:4)+intensity*4;
    rect(ctx,Math.cos(angle)*reach,Math.sin(angle)*reach*.72+life*life*16,size,size,i%3?'#f4c97c':'#fff0c5');
  }
  if(life<.62){
    ctx.globalAlpha=(1-life/.7)*.94;
    const length=18+intensity*30;
    if(intensity>.55&&life<.42) {
      ctx.beginPath();
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8,r=i%2?length*.24:length*(i%4?1:.78);
        const px=Math.cos(a)*r,py=Math.sin(a)*r*.78;
        if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
      }
      ctx.closePath();ctx.fillStyle='#ffd181';ctx.fill();
    }
    fxLine(ctx,-length,-length*.35,length,length*.35,'#ffe4a5',4+intensity*4,9);
    fxLine(ctx,-length*.35,length,length*.35,-length,'#fff2d5',4+intensity*3,9);
  }
  if(intensity>.55){ctx.globalAlpha=(1-life)*.92;fxRing(ctx,0,0,20+life*62,color,0,12,.65);}
  ctx.restore();
}
function drawGuardImpact(ctx,x,y,fit,life,broken,reduced,gain=false) {
  if(life<0||life>=1)return;
  const rise=gain&&!reduced?(1-life)*16:0;
  ctx.save();ctx.translate(x,y+rise);ctx.scale(fit,fit);ctx.globalAlpha=reduced?.62:Math.sin(Math.min(.98,life+.12)*Math.PI)*.84;
  const grow=reduced?1:.88+life*.2,points=[[-28,-33],[0,-43],[28,-33],[24,8],[0,32],[-24,8],[-28,-33]];
  ctx.scale(grow,grow);ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();
  ctx.fillStyle='#83d6fa22';ctx.fill();ctx.strokeStyle='#9bdef8';ctx.lineWidth=3;ctx.stroke();
  if(broken){fxLine(ctx,-7,-24,7,-8,'#dff6ff',3,5);fxLine(ctx,7,-8,-3,8,'#dff6ff',3,5);}
  else {rect(ctx,-2,-23,4,34,'#d9f6ff');rect(ctx,-13,-8,26,4,'#d9f6ff');}
  if(!reduced&&!gain)for(let i=0;i<8;i++){const a=i*Math.PI/4;rect(ctx,Math.cos(a)*(32+life*28),Math.sin(a)*(35+life*18),4,4,'#b7eaff');}
  ctx.restore();
}

/** Responsive stage: cover the background, keep people and effects uniformly scaled. */
export function drawPitch(ctx, options = {}) {
  const width=options.width||ctx.canvas.width||960, height=options.height||ctx.canvas.height||400;
  const animation=options.animation,reduced=!!(options.reducedMotion||animation?.reducedMotion);
  const rawProgress=clamp(Number(animation?.progress)||0,0,1),p=reduced?.64:rawProgress,type=animation?.type;
  const damage=Math.max(0,Number(animation?.damage)||0),blocked=Math.max(0,Number(animation?.blocked)||0),defenseGain=Math.max(0,Number(animation?.defenseGain)||0);
  const intensity=clamp(Number(animation?.intensity)||damage/30,0,1),target=animation?.target||(type==='concede'?'hero':'enemy');
  const contact=['shot','goal'].includes(type)?.54:.36,impactLife=animation?(p-contact)/(1-contact):-1;
  const impactPulse=impactLife>=0&&impactLife<1?Math.sin(Math.min(1,impactLife*2)*Math.PI):0;
  const defender=options.opponentId==='legend';
  const legendary=defender||options.opponentId==='legend-zidane'||options.opponentId==='legend-ronaldo';
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#101722'; ctx.fillRect(0,0,width,height);
  // Only the painted stage moves; controls and status buttons never shake.
  if(!reduced&&damage>=10&&impactLife>=0&&impactLife<.4) {
    const strength=Math.min(4,1+intensity*3)*(1-impactLife/.4);
    ctx.translate(Math.sin(impactLife*83)*strength,Math.cos(impactLife*67)*strength*.45);
  }
  ctx.save();
  ctx.filter='saturate(0.28) brightness(0.62)';
  if (rasterArt.stadium) {
    const picture=rasterArt.stadium;
    const cover=Math.max(width/picture.naturalWidth,height/picture.naturalHeight);
    const drawWidth=picture.naturalWidth*cover,drawHeight=picture.naturalHeight*cover;
    ctx.drawImage(picture,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
  } else {
    ctx.save();ctx.scale(width/960,height/400);duelStadium(ctx);ctx.restore();
  }
  ctx.restore();
  rect(ctx,0,0,width,height,'#101b3448');
  rect(ctx,0,height*.9,width,height*.1,'#10172245');
  // The vertical coordinate system remains 400 units tall. Horizontal anchors
  // follow the actual stage width, so a wide or narrow canvas never stretches a person.
  const scale=height/400,stageWidth=width/scale,mobile=width<=520;
  ctx.scale(scale,scale);
  const heroAnchor=stageWidth*(mobile?.23:.292),enemyAnchor=stageWidth*(mobile?.77:.708);
  const heroCrop=atlasFrames.striker[0],heroHalfWidth=heroCrop?119*heroCrop[2]/heroCrop[3]+4:98;
  const legendIndex=LEGEND_FRAMES[options.opponentId],legendCrop=atlasFrames.legends[legendIndex];
  const enemyHalfWidth=legendCrop?118*legendCrop[2]/legendCrop[3]+4:98;
  // Only extremely narrow/tall layouts need an extra, continuous size reduction.
  const fit=Math.min(1,Math.max(.2,(Math.min(heroAnchor,stageWidth-enemyAnchor)-12)/Math.max(98,heroHalfWidth,enemyHalfWidth)));
  let heroX=heroAnchor,enemyX=enemyAnchor;
  const heroY=340,enemyY=340,pulse=reduced?0:Math.sin(p*Math.PI);
  const breathing=reduced?0:Math.sin((Number(options.time)||0)/720)*1.2*fit;
  if(type==='dribble')heroX+=pulse*Math.min(32*fit,(enemyAnchor-heroAnchor)*.08);
  if(type==='pass')heroX+=pulse*8*fit;
  if(type==='concede')heroX-=pulse*10*fit;
  if(!reduced&&damage>0) {
    const recoil=impactPulse*(5+intensity*15)*fit;
    if(target==='enemy')enemyX+=recoil;else heroX-=recoil;
  }
  pixelEllipse(ctx,heroX+2,heroY+4,76*fit,13*fit,'#101b25');
  pixelEllipse(ctx,enemyX+2,enemyY+4,76*fit,13*fit,'#101b25');
  pixelEllipse(ctx,heroX,heroY+6,55*fit,7*fit,'#303d43');
  pixelEllipse(ctx,enemyX,enemyY+6,55*fit,7*fit,'#303d43');
  if(options.phase==='match'||animation?.bossId)drawBossTactics(ctx,heroAnchor,enemyAnchor,heroY,fit,options.boss,animation,options.time,reduced);
  if(legendary) drawLegendRune(ctx,enemyX,enemyY,fit);
  if(options.phase==='match') drawMomentumAura(ctx,heroX,heroY,fit,Number(options.heroMomentum),reduced?0:Number(options.time));
  ctx.save();ctx.translate(heroX,heroY);ctx.scale(fit,fit);ctx.globalAlpha=.7;
  frame(ctx,-38,4,78,10,'#81aa6a',2);
  rect(ctx,-12,16,24,2,'#aac077');rect(ctx,-6,19,12,2,'#aac077');ctx.restore();
  const contactTint=!reduced&&damage>0&&impactLife>=0&&impactLife<.2?.18+intensity*.22:0;
  const enemyHit=target==='enemy'?contactTint:0,heroHit=target==='hero'?contactTint:0;
  const coachIndex=COACH_FRAMES[options.opponentId],coachCrop=atlasFrames.coaches[coachIndex];
  if(rasterArt.legends&&legendCrop)drawRasterFighter(ctx,rasterArt.legends,enemyX,enemyY,{crop:legendCrop,height:236*fit-breathing,lean:enemyHit?pulse*.035:0,hit:enemyHit});
  else if(rasterArt.coaches&&coachCrop)drawRasterFighter(ctx,rasterArt.coaches,enemyX,enemyY,{crop:coachCrop,height:236*fit-breathing,lean:enemyHit?pulse*.035:0,hit:enemyHit});
  else if(rasterArt.rival)drawRasterFighter(ctx,rasterArt.rival,enemyX,enemyY,{crop:[116,111,929,1257],height:236*fit-breathing,lean:enemyHit?pulse*.035:0,hit:enemyHit});
  else {ctx.save();ctx.translate(enemyX,enemyY);ctx.scale(fit*236/240,fit*236/240);drawDuelist(ctx,0,0,{home:false,shirt:options.opponentColor,hit:enemyHit});ctx.restore();}
  // This heraldic shield sits beside the torso, leaving the face and intent panel clear.
  if(defender) {
    drawDefenderShield(ctx,enemyX-78*fit,enemyY-132*fit,.8*fit);
    cross(ctx,enemyX-92*fit,enemyY-155*fit,4*fit,'#e9d194');
  }
  const lean=reduced?0:type==='concede'?-pulse*.04:type==='dribble'?pulse*.035:type==='shot'||type==='goal'?Math.sin(p*Math.PI*2)*-.045:type==='pass'?pulse*.02:0;
  if(rasterArt.striker)drawRasterFighter(ctx,rasterArt.striker,heroX,heroY,{crop:heroCrop,height:238*fit+breathing,lean,hit:heroHit});
  else {ctx.save();ctx.translate(heroX,heroY);ctx.scale(fit*238/240,fit*238/240);drawDuelist(ctx,0,0,{home:true,hit:heroHit});ctx.restore();}
  const startX=heroX+52*fit,startY=heroY-9*fit,targetX=enemyX-34*fit,targetY=enemyY-94*fit;
  let bx=startX,by=startY;
  if(type==='pass'){bx+=pulse*60*fit;by-=pulse*26*fit;}
  if(type==='dribble'){bx+=pulse*28*fit;by-=Math.abs(Math.sin(p*Math.PI*2))*12*fit;}
  if(!reduced&&(type==='shot'||type==='goal')){
    const flight=Math.min(1,p/.72);
    bx=lerp(startX,targetX,flight);by=lerp(startY,targetY,flight)-Math.sin(flight*Math.PI)*55*fit;
    if(p<.72)for(let i=1;i<6;i++){
      const f=Math.max(0,flight-i*.045);
      rect(ctx,lerp(startX,targetX,f),lerp(startY,targetY,f)-Math.sin(f*Math.PI)*55*fit,(10-i)*fit,4*fit,i<3?'#e5bc68':'#527b4c');
    }
  }
  if(!reduced&&type==='concede'){bx=lerp(enemyX-62*fit,heroX+42*fit,p);by=heroY-50*fit-Math.sin(p*Math.PI)*35*fit;}
  if(type==='dribble'&&!reduced){
    rect(ctx,heroX-108*fit,heroY-40*fit,34*fit,4*fit,'#82aa69');
    rect(ctx,heroX-97*fit,heroY-28*fit,20*fit,4*fit,'#82aa69');
  }
  // The hero image includes the football. Spells only add a moving light projectile.
  if(!rasterArt.striker){pixelEllipse(ctx,bx,heroY+4,14*fit,4*fit,'#183c29');ball(ctx,bx,by,3*fit);}
  else if(!reduced&&(type==='shot'||type==='goal'||type==='concede')){
    pixelEllipse(ctx,bx,by,11*fit,11*fit,type==='concede'?'#72bcdf66':'#f3c45b66');
    pixelEllipse(ctx,bx,by,6*fit,6*fit,type==='concede'?'#aeddf0':'#f8dc8e');
    cross(ctx,bx,by,8*fit,'#fff2c7');
  }
  const impactX=target==='hero'?heroX+28*fit:enemyX-28*fit,impactY=heroY-100*fit;
  if(damage>0)drawImpactBurst(ctx,impactX,impactY,fit,impactLife,intensity,reduced,target==='hero'?'#ed9e79':'#f3b75f');
  if(blocked>0)drawGuardImpact(ctx,target==='hero'?heroX+52*fit:enemyX-52*fit,heroY-112*fit,fit,impactLife,damage>0,reduced);
  if(defenseGain>0)drawGuardImpact(ctx,heroX+54*fit,heroY-112*fit,fit,p,false,reduced,true);
  if(type==='debuff') {
    ctx.save();ctx.globalAlpha=reduced?.5:Math.sin(p*Math.PI)*.7;
    fxRing(ctx,enemyX-50*fit,enemyY-100*fit,(24+(reduced?0:p*18))*fit,'#d2a5df',reduced?0:p*.6,12);
    cross(ctx,enemyX-50*fit,enemyY-100*fit,8*fit,'#e6c2ef');ctx.restore();
  }
  if(type==='goal'&&p>.5&&!reduced){
    const life=(p-.5)*2,centre=(heroAnchor+enemyAnchor)/2;
    for(let i=0;i<32;i++){
      const angle=i*2.39996,radius=(24+life*(44+i%7*13))*fit;
      rect(ctx,centre+Math.cos(angle)*radius,heroY-150*fit+Math.sin(angle)*radius-life*20*fit,(4+i%2*2)*fit,(4+i%3*2)*fit,[C.gold,C.mint,C.homeLight,C.cream][i%4]);
    }
    cross(ctx,centre-80*fit,heroY-180*fit,10*fit,C.gold);cross(ctx,centre+78*fit,heroY-208*fit,6*fit,C.mint);
  }
  ctx.restore();
}


const DEBUFF_CARD_POSES = Object.freeze({
  scan: { head:[1,-40], shoulder:[0,-31], hip:[-1,-20], arms:[[-6,-29,-9,-37,-2,-39],[5,-29,15,-30,24,-34]], legs:[[-4,-20,-9,-9,-12,0],[3,-20,9,-10,11,0]] },
  feint: { head:[1,-40], shoulder:[1,-30], hip:[-1,-20], arms:[[-5,-29,-15,-25,-22,-29],[6,-29,15,-23,23,-25]], legs:[[-4,-20,-13,-10,-18,0],[3,-20,12,-11,5,-2]] },
  kick: { head:[2,-40], shoulder:[0,-30], hip:[3,-20], arms:[[-6,-29,-15,-32,-22,-27],[5,-29,14,-25,22,-28]], legs:[[-1,-20,-4,-9,-7,0],[7,-20,20,-18,30,-25]] },
  press: { head:[10,-39], shoulder:[5,-29], hip:[0,-19], arms:[[-1,-28,-11,-21,-17,-24],[10,-28,19,-31,24,-27]], legs:[[-3,-19,-15,-10,-23,-1],[4,-19,16,-11,19,0]] },
  tackle: { head:[8,-25], shoulder:[3,-16], hip:[-4,-9], arms:[[-3,-16,-13,-12,-20,-7],[8,-15,17,-11,23,-14]], legs:[[-5,-9,-12,-3,-22,-1],[1,-9,21,-5,36,-2]] },
  mark: { head:[-1,-40], shoulder:[-1,-30], hip:[0,-20], arms:[[-7,-29,-13,-21,-10,-15],[5,-29,15,-26,20,-19]], legs:[[-4,-20,-10,-10,-16,0],[4,-20,10,-10,15,0]] },
});
const DEBUFF_CARD_IDS = new Set(['read-opening','lure-dribble','unsettling-shot','high-press','checking-tackle','close-mark']);

// Jointed silhouettes use square pixel stamps: football movements stay readable
// without introducing a second character art style or a new downloadable atlas.
function drawCardSilhouette(ctx, x, footY, pose, scale = 1, facing = 1, ink = '#192325') {
  const p=DEBUFF_CARD_POSES[pose];
  ctx.save();ctx.translate(x,footY);ctx.scale(scale*facing,scale);ctx.fillStyle=ink;
  const stamp=(x,y,w,h=w)=>ctx.fillRect(Math.round(x-w/2),Math.round(y-h/2),w,h);
  const limb=(x1,y1,x2,y2,size)=>{
    const steps=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))/2);
    for(let i=0;i<=steps;i++){const t=steps?i/steps:0;stamp(lerp(x1,x2,t),lerp(y1,y2,t),size);}
  };
  for(const [x1,y1,x2,y2,x3,y3] of p.legs){limb(x1,y1,x2,y2,6);limb(x2,y2,x3,y3,4);stamp(x3+2,y3,8,3);}
  limb(p.shoulder[0],p.shoulder[1],p.hip[0],p.hip[1],11);
  stamp(p.hip[0],p.hip[1]+1,13,6);
  for(const [x1,y1,x2,y2,x3,y3] of p.arms){limb(x1,y1,x2,y2,4);limb(x2,y2,x3,y3,3);stamp(x3,y3,3);}
  limb(p.head[0],p.head[1]+5,p.shoulder[0],p.shoulder[1],4);
  stamp(p.head[0],p.head[1],7,9);stamp(p.head[0],p.head[1]-4,5,2);stamp(p.head[0]+4,p.head[1],2,3);
  ctx.restore();
}

function drawDebuffCardAction(ctx, type, options, width, height) {
  if(!DEBUFF_CARD_IDS.has(options.id))return false;
  const attack=type==='shot'||type==='pass';
  const background=type==='defense'?'#d4e1e7':attack?'#ead9cd':'#dce3d2';
  const ground=type==='defense'?'#c4d5de':attack?'#decbbe':'#cbd8bf';
  const ink='#192325',ghost='#84918b',accent=options.id==='read-opening'||options.id==='lure-dribble'||options.id==='unsettling-shot'?'#8b586e':'#94734a';
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=ground;ctx.fillRect(0,Math.round(height*.84),width,Math.ceil(height*.16));
  const scale=Math.min(width/120,height/64);
  ctx.translate((width-120*scale)/2,(height-64*scale)/2);ctx.scale(scale,scale);
  const line=(x1,y1,x2,y2,color=accent)=>{
    const steps=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))/2);
    for(let i=0;i<=steps;i++){const t=steps?i/steps:0;rect(ctx,lerp(x1,x2,t),lerp(y1,y2,t),2,2,color);}
  };
  const arrow=(x1,y1,x2,y2,color=accent)=>{
    line(x1,y1,x2,y2,color);
    const angle=Math.atan2(y2-y1,x2-x1);
    for(const turn of [-.65,.65])line(x2,y2,x2-Math.cos(angle+turn)*7,y2-Math.sin(angle+turn)*7,color);
  };
  const target=(x,y,broken=false)=>{
    const gap=broken?3:0;
    for(const side of [-1,1]){
      const left=x+side*(10+gap);line(left,y-8,left,y+8);line(left,y-8,left-side*5,y-8);line(left,y+8,left-side*5,y+8);
    }
    if(broken){line(x-3,y-9,x+2,y-2);line(x+2,y-2,x-3,y+3);line(x-3,y+3,x+3,y+9);}
    else cross(ctx,x,y,4,accent);
  };
  if(options.id==='read-opening'){
    drawCardSilhouette(ctx,91,56,'mark',.72,-1,ghost);
    for(const x of [57,65,73])rect(ctx,x,24,4,2,accent);
    target(91,26);drawCardSilhouette(ctx,31,57,'scan');ball(ctx,49,55,.64);
  }else if(options.id==='lure-dribble'){
    drawCardSilhouette(ctx,38,55,'feint',.85,1,'#b2bdb0');
    drawCardSilhouette(ctx,92,56,'mark',.73,-1,ghost);
    arrow(69,41,80,32);arrow(42,53,54,56);
    drawCardSilhouette(ctx,55,55,'feint');ball(ctx,73,54,.78);
  }else if(options.id==='unsettling-shot'){
    drawCardSilhouette(ctx,36,57,'kick');
    dashedPath(ctx,64,34,89,23,'#a18c85',0,7);ball(ctx,79,26,.85);target(101,23,true);
  }else if(options.id==='high-press'){
    drawCardSilhouette(ctx,92,56,'feint',.8,-1,ghost);
    arrow(12,24,31,24);arrow(17,31,30,31);arrow(91,8,91,19);
    drawCardSilhouette(ctx,43,57,'press');ball(ctx,78,55,.72);
  }else if(options.id==='checking-tackle'){
    drawCardSilhouette(ctx,91,55,'press',.85,-1,ghost);
    drawCardSilhouette(ctx,37,57,'tackle');ball(ctx,77,53,.76);
    line(69,35,69,43);line(65,39,74,39);arrow(101,13,101,25);
    line(12,53,21,53,'#99acb5');line(18,58,28,58,'#99acb5');
  }else{
    drawCardSilhouette(ctx,76,56,'feint',.85,1,ghost);
    drawCardSilhouette(ctx,48,57,'mark');ball(ctx,95,55,.72);
    arrow(79,7,79,17);line(29,16,29,46,'#a29286');line(29,16,35,16,'#a29286');line(29,46,35,46,'#a29286');
  }
  if(options.upgraded)cross(ctx,115,5,2,'#a5792d');
  ctx.restore();return true;
}

function drawCardAction(ctx, type, options, width, height) {
  if(drawDebuffCardAction(ctx,type,options,width,height))return true;
  const [key, index] = CARD_ART[options.id] || CARD_ART[CARD_TYPE_DEFAULTS[type] || 'focus'];
  const picture = rasterArt[key], crop = atlasFrames[key][index];
  if (!picture || !crop) return false;
  const isAttack = type === 'shot' || type === 'pass';
  const background = type === 'defense' ? '#d4e1e7' : isAttack ? '#ead9cd' : '#dce3d2';
  const ground = type === 'defense' ? '#c4d5de' : isAttack ? '#decbbe' : '#cbd8bf';
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = ground;
  ctx.fillRect(0, Math.round(height * .84), width, Math.ceil(height * .16));
  // Contain the complete action, including its ball and motion trail. Source
  // rectangles are cached at load time; every card retains its own silhouette.
  const scale = Math.min(width * .91 / crop[2], height * .89 / crop[3]);
  const drawWidth = crop[2] * scale, drawHeight = crop[3] * scale;
  ctx.drawImage(picture, ...crop, Math.round((width - drawWidth) / 2), Math.round((height - drawHeight) / 2), drawWidth, drawHeight);
  if (options.upgraded) cross(ctx, width - height * .065, height * .065, Math.max(2, height * .018), '#a5792d');
  ctx.restore();
  return true;
}

/** Draw an opaque, text-free action illustration selected by its card ID. */
export function drawCardArt(ctx, type = 'tactic', options = {}) {
  const width = options.width || ctx.canvas.width || 120;
  const height = options.height || ctx.canvas.height || 64;
  const upgraded = !!options.upgraded;
  if (drawCardAction(ctx, type, options, width, height)) return;
  const palettes = {
    pass: ['#192a39', '#99d4c5'], dribble: ['#302c2c', '#e7bc65'],
    shot: ['#35242c', '#ec9770'], defense: ['#1c2c40', '#8ebdcb'],
    tactic: ['#28273a', '#b7a5d7'],
  };
  const [bg, accent] = palettes[type] || palettes.tactic;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(width / 120, height / 64);
  rect(ctx, 0, 0, 120, 64, bg);
  ctx.globalAlpha = 0.07;
  for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < 120; x += 16) rect(ctx, x, y, 8, 8, accent);
  ctx.globalAlpha = 1;

  if (type === 'pass') {
    dashedPath(ctx, 32, 40, 92, 26, accent, 12, 13);
    drawPlayer(ctx, 26, 52, { scale: 1.2, team: 'home', pose: 'kick' });
    drawPlayer(ctx, 96, 40, { scale: 0.95, team: 'home' });
    ball(ctx, 66, 24, 1.4);
    rect(ctx, 78, 21, 8, 2, accent); rect(ctx, 84, 17, 2, 6, accent);
  } else if (type === 'dribble') {
    cone(ctx, 28, 48, 1); cone(ctx, 92, 46, 1);
    dashedPath(ctx, 22, 56, 96, 54, accent, 8, 15);
    drawPlayer(ctx, 58, 48, { scale: 1.4, team: 'home', pose: 'run' });
    ball(ctx, 79, 48, 1.3);
    rect(ctx, 34, 30, 10, 2, accent); rect(ctx, 38, 36, 6, 2, accent);
  } else if (type === 'shot') {
    frame(ctx, 84, 14, 24, 34, '#8f7970');
    for (let i = 90; i < 108; i += 6) rect(ctx, i, 16, 2, 30, '#68534c');
    for (let i = 22; i < 46; i += 6) rect(ctx, 86, i, 20, 2, '#68534c');
    frame(ctx, 82, 12, 24, 34, '#d3c7a6');
    drawPlayer(ctx, 30, 54, { scale: 1.3, team: 'home', pose: 'kick' });
    dashedPath(ctx, 45, 41, 83, 24, accent, 9, 10);
    ball(ctx, 72, 25, 1.8); cross(ctx, 95, 18, 4, '#f9d695');
  } else if (type === 'defense') {
    // Stepped shield and a grounded tackle line.
    rect(ctx, 58, 10, 34, 4, accent); rect(ctx, 54, 14, 42, 24, accent);
    rect(ctx, 58, 38, 34, 6, accent); rect(ctx, 64, 44, 22, 6, accent); rect(ctx, 70, 50, 10, 4, accent);
    rect(ctx, 60, 16, 30, 20, '#36525a'); rect(ctx, 64, 36, 22, 6, '#36525a'); rect(ctx, 70, 42, 10, 4, '#36525a');
    rect(ctx, 72, 20, 6, 20, '#c4d7d0'); rect(ctx, 66, 26, 18, 6, '#c4d7d0');
    drawPlayer(ctx, 28, 53, { scale: 1.3, team: 'away' });
    ball(ctx, 48, 53, 1.1);
  } else {
    frame(ctx, 24, 10, 76, 46, accent, 2);
    rect(ctx, 60, 12, 2, 42, '#6b647f');
    pixelEllipse(ctx, 60, 32, 12, 10, '#6b647f', 2);
    frame(ctx, 24, 22, 12, 22, '#6b647f'); frame(ctx, 88, 22, 12, 22, '#6b647f');
    dashedPath(ctx, 40, 42, 80, 22, '#d5c8ea', 6, 10);
    for (const [x, y] of [[40, 42], [76, 20], [80, 44]]) {
      rect(ctx, x - 4, y - 2, 8, 4, accent); rect(ctx, x - 2, y - 4, 4, 8, accent);
      rect(ctx, x - 2, y - 2, 4, 4, bg);
    }
    cross(ctx, 48, 20, 4, '#e6ae81'); cross(ctx, 68, 40, 4, '#e6ae81');
  }
  if (upgraded) {
    cross(ctx, 110, 10, 4, C.gold);
    rect(ctx, 105, 15, 2, 2, '#f5e1a2');
    rect(ctx, 4, 58, 112, 2, '#a78f51');
  }
  ctx.restore();
}

/** Football equipment atlas, with procedural fallback. options.id selects an exact relic. */
export function drawItemArt(ctx, category = 'rune', options = {}) {
  const width = options.width || ctx.canvas.width || 64;
  const height = options.height || ctx.canvas.height || 48;
  const index = EQUIPMENT_FRAMES[options.id] ?? EQUIPMENT_CATEGORIES[category];
  const eliteCrop = atlasFrames.eliteRelics[ELITE_RELIC_FRAMES[options.id]];
  const useElite = rasterArt.eliteRelics && eliteCrop;
  const picture = useElite ? rasterArt.eliteRelics : rasterArt.equipment;
  const crop = useElite ? eliteCrop : atlasFrames.equipment[index];
  if (picture && crop) {
    ctx.save(); ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,width,height);
    const scale=Math.min(width*.92/crop[2],height*.92/crop[3]);
    const drawWidth=crop[2]*scale,drawHeight=crop[3]*scale;
    ctx.drawImage(picture,...crop,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(width / 64, height / 48);
  const r = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
  r(0, 0, 64, 48, '#172230');
  r(4, 4, 56, 38, '#1d2a39');
  pixelEllipse(ctx, 32, 40, 22, 4, '#101923');
  const ink = '#122b27', cream = '#f1dfb3', gold = '#d8ae5d';
  if (category === 'boots') {
    r(12, 10, 16, 20, ink); r(14, 12, 12, 17, '#bb6947');
    r(12, 26, 36, 12, ink); r(16, 24, 18, 12, '#cc7e50');
    r(32, 28, 16, 8, '#cf8b56'); r(46, 30, 6, 8, ink);
    r(14, 34, 34, 4, '#e4b06a'); r(14, 38, 6, 4, cream); r(38, 38, 6, 4, cream);
    r(20, 14, 8, 4, '#754932'); r(24, 22, 8, 2, cream); r(28, 26, 8, 2, cream);
    r(32, 30, 8, 2, cream); r(16, 18, 4, 10, '#e6a36a');
  } else if (category === 'uniform' || category === 'jersey') {
    r(16, 8, 32, 8, ink); r(10, 14, 44, 14, ink); r(20, 24, 24, 18, ink);
    r(16, 12, 32, 12, '#d87b58'); r(12, 16, 8, 10, '#a95343'); r(44, 16, 8, 10, '#eea477');
    r(22, 22, 20, 18, '#d87b58'); r(22, 22, 4, 16, '#b66049');
    r(26, 10, 12, 4, cream); r(28, 14, 8, 2, cream); r(14, 24, 6, 2, cream); r(44, 24, 6, 2, cream);
    frame(ctx, 28, 22, 8, 10, cream, 2); r(22, 38, 20, 2, gold);
    r(38, 18, 4, 4, gold);
  } else if (category === 'socks') {
    r(12, 8, 16, 28, ink); r(14, 10, 12, 24, cream); r(14, 14, 12, 4, '#bc7751');
    r(14, 20, 12, 2, '#bc7751'); r(16, 32, 18, 8, ink); r(18, 32, 14, 6, '#d1c59e');
    r(34, 6, 16, 28, ink); r(36, 8, 12, 24, cream); r(36, 12, 12, 4, '#678b80');
    r(36, 18, 12, 2, '#678b80'); r(38, 30, 18, 8, ink); r(40, 30, 14, 6, '#e6d7ac');
    r(16, 24, 4, 6, '#fff0c3'); r(38, 22, 4, 6, '#fff0c3');
  } else if (category === 'bag') {
    frame(ctx, 22, 8, 22, 16, '#b69a60', 4);
    r(12, 18, 40, 22, ink); r(14, 20, 36, 18, '#4d7b7d');
    r(14, 20, 8, 18, '#365e62'); r(44, 20, 6, 18, '#7fa5a0');
    r(10, 24, 6, 12, '#365e62'); r(50, 24, 6, 12, '#365e62');
    r(22, 18, 4, 20, '#d7bd83'); r(40, 18, 4, 20, '#d7bd83');
    r(28, 26, 10, 8, '#294b4b'); r(30, 28, 6, 4, '#c4b277'); r(26, 20, 14, 2, '#a3c2aa');
  } else if (category === 'bottle') {
    r(24, 4, 16, 8, ink); r(26, 4, 12, 6, gold); r(28, 10, 8, 4, '#c3b680');
    r(22, 14, 20, 6, ink); r(18, 20, 28, 20, ink); r(22, 40, 20, 2, ink);
    r(24, 16, 16, 6, '#93b985'); r(20, 22, 24, 16, '#6b9b6f');
    r(22, 22, 4, 14, '#b2d194'); r(38, 22, 4, 16, '#4d7557');
    r(26, 26, 12, 8, '#dedcb0'); r(30, 24, 4, 12, '#dedcb0'); r(30, 28, 4, 4, '#739668');
  } else if (category === 'band') {
    r(14, 10, 36, 28, ink); r(16, 12, 32, 24, '#cfb367');
    r(16, 12, 8, 24, '#a98d50'); r(42, 12, 6, 24, '#efd88e');
    r(16, 16, 32, 4, '#f2dda0'); r(16, 28, 32, 4, '#f2dda0');
    r(28, 20, 10, 2, '#4a6040'); r(26, 22, 4, 6, '#4a6040'); r(28, 28, 10, 2, '#4a6040');
    r(18, 36, 28, 4, '#6c6742');
  } else if (category === 'coin' || category === 'charm') {
    for (const [x, y] of [[22, 31], [40, 33], [31, 22]]) {
      pixelEllipse(ctx, x, y + 3, 12, 7, '#8e6e35');
      pixelEllipse(ctx, x, y, 12, 7, gold);
      pixelEllipse(ctx, x, y - 1, 8, 4, '#f1d388', 2);
      r(x - 2, y - 4, 4, 8, '#b2853b'); r(x - 4, y - 2, 8, 4, '#b2853b');
    }
  } else if (category === 'whistle') {
    frame(ctx, 12, 8, 22, 16, '#8aab8d', 2); r(26, 20, 4, 8, '#8aab8d');
    r(22, 26, 24, 14, ink); r(38, 20, 16, 12, ink);
    r(24, 28, 20, 10, gold); r(40, 22, 12, 8, '#edce80');
    r(28, 30, 10, 6, '#93753c'); r(30, 30, 6, 4, '#243b2a');
    r(24, 26, 16, 2, '#f6d891'); r(48, 22, 4, 4, '#94753d');
  } else if (category === 'medal') {
    // Navy ribbons and the same gold defensive crest worn by the legendary rival.
    r(20,4,10,20,ink); r(34,4,10,20,ink);
    r(22,4,6,18,'#52798a'); r(36,4,6,18,'#52798a');
    r(24,4,2,16,cream); r(38,4,2,16,cream);
    r(24,18,16,6,gold);
    drawDefenderShield(ctx,32,30,.64);
    r(16,24,2,8,'#b99855'); r(46,24,2,8,'#b99855');
    cross(ctx,13,18,3,'#efd498');
  } else {
    for (let i = 0; i < 8; i++) {
      const half = i < 4 ? (i + 1) * 4 : (8 - i) * 4;
      r(32 - half, 8 + i * 4, half * 2, 4, i < 4 ? '#a6cf8e' : '#719d6c');
    }
    r(28, 16, 8, 16, '#274832'); r(24, 20, 16, 8, '#274832');
    r(30, 20, 4, 8, '#f2d48b');
  }
  cross(ctx, 56, 8, 3, '#b7ce91');
  ctx.restore();
}
