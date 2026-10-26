/**
 * RuneKick's procedural pixel artwork. All coordinates snap to a logical grid.
 * drawPitch(ctx, { width, height, time, opponentColor, phase, animation })
 * drawCardArt(ctx, type, { width, height, upgraded })
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

const rasterArt = { striker: null, rival: null, stadium: null, coaches: null, equipment: null };
const atlasFrames = { coaches: [], equipment: [] };
const COACH_FRAMES = Object.freeze({
  'coach-mourinho': 0, 'coach-ancelotti': 1, 'coach-guardiola': 2, 'coach-arteta': 3,
  'coach-wenger': 4, 'coach-ferguson': 5, 'coach-klopp': 6,
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

function readAtlasFrames(picture, columns, rows, characters = false) {
  const width=picture.naturalWidth,height=picture.naturalHeight;
  const frames=Array.from({length:columns*rows},(_,index)=>{
    const col=index%columns,row=Math.floor(index/columns),x=Math.round(col*width/columns),y=Math.round(row*height/rows);
    return [x,y,Math.round((col+1)*width/columns)-x,Math.round((row+1)*height/rows)-y];
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
      const pad=characters?8:0,x=Math.max(0,cellX-pad),y=Math.max(0,cellY-pad);
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
  if (typeof Image === 'undefined') return Promise.resolve({ striker: false, rival: false, stadium: false, coaches: false, equipment: false });
  const sources = { striker: 'striker.png', rival: 'rival.png', stadium: 'youth-stadium.png', coaches: 'coaches.png', equipment: 'equipment.png' };
  artLoading = Promise.all(Object.entries(sources).map(([key, filename]) => new Promise(resolve => {
    const picture = new Image();
    picture.decoding = 'async';
    picture.onload = () => {
      rasterArt[key] = picture;
      if(key==='coaches')atlasFrames.coaches=readAtlasFrames(picture,4,2,true);
      if(key==='equipment')atlasFrames.equipment=readAtlasFrames(picture,4,3);
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
  // Large profile: visible eye, brow, nose, cheek, mouth and headband.
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
  r(-10,-53,20,2,trim); r(-12,-53,3,3,'#cfc5a2');
  r(-16,-53,5,2,trim); r(-16,-51,3,4,'#cfc5a2');
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

/** Responsive stage: cover the background, keep people and effects uniformly scaled. */
export function drawPitch(ctx, options = {}) {
  const width=options.width||ctx.canvas.width||960, height=options.height||ctx.canvas.height||400;
  const animation=options.animation, p=clamp(Number(animation?.progress)||0,0,1), type=animation?.type;
  const legendary=options.opponentId==='legend';
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#101722'; ctx.fillRect(0,0,width,height);
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
  // Only extremely narrow/tall layouts need an extra, continuous size reduction.
  const fit=Math.min(1,Math.max(.2,(Math.min(heroAnchor,stageWidth-enemyAnchor)-12)/98));
  let heroX=heroAnchor,enemyX=enemyAnchor;
  const heroY=340,enemyY=340,pulse=Math.sin(p*Math.PI);
  const breathing=Math.sin((Number(options.time)||0)/720)*1.2*fit;
  if(type==='dribble')heroX+=pulse*Math.min(32*fit,(enemyAnchor-heroAnchor)*.08);
  if(type==='pass')heroX+=pulse*8*fit;
  if(type==='concede')heroX-=pulse*10*fit;
  if(type==='shot'&&p>.55)enemyX+=Math.sin((p-.55)/.45*Math.PI)*10*fit;
  if(type==='goal')enemyX+=pulse*10*fit;
  pixelEllipse(ctx,heroX+2,heroY+4,76*fit,13*fit,'#101b25');
  pixelEllipse(ctx,enemyX+2,enemyY+4,76*fit,13*fit,'#101b25');
  pixelEllipse(ctx,heroX,heroY+6,55*fit,7*fit,'#303d43');
  pixelEllipse(ctx,enemyX,enemyY+6,55*fit,7*fit,'#303d43');
  if(legendary) drawLegendRune(ctx,enemyX,enemyY,fit);
  ctx.save();ctx.translate(heroX,heroY);ctx.scale(fit,fit);ctx.globalAlpha=.7;
  frame(ctx,-38,4,78,10,'#81aa6a',2);
  rect(ctx,-12,16,24,2,'#aac077');rect(ctx,-6,19,12,2,'#aac077');ctx.restore();
  const enemyHit=(type==='shot'||type==='goal')&&p>.58&&p<.78?.4:0;
  const heroHit=type==='concede'&&p>.35&&p<.65?.35:0;
  const coachIndex=COACH_FRAMES[options.opponentId],coachCrop=atlasFrames.coaches[coachIndex];
  if(rasterArt.coaches&&coachCrop)drawRasterFighter(ctx,rasterArt.coaches,enemyX,enemyY,{crop:coachCrop,height:236*fit-breathing,lean:enemyHit?pulse*.035:0,hit:enemyHit});
  else if(rasterArt.rival)drawRasterFighter(ctx,rasterArt.rival,enemyX,enemyY,{crop:[116,111,929,1257],height:236*fit-breathing,lean:enemyHit?pulse*.035:0,hit:enemyHit});
  else {ctx.save();ctx.translate(enemyX,enemyY);ctx.scale(fit*236/240,fit*236/240);drawDuelist(ctx,0,0,{home:false,shirt:options.opponentColor,hit:enemyHit});ctx.restore();}
  // This heraldic shield sits beside the torso, leaving the face and intent panel clear.
  if(legendary) {
    drawDefenderShield(ctx,enemyX-78*fit,enemyY-132*fit,.8*fit);
    cross(ctx,enemyX-92*fit,enemyY-155*fit,4*fit,'#e9d194');
  }
  const lean=type==='concede'?-pulse*.04:type==='dribble'?pulse*.035:type==='shot'||type==='goal'?Math.sin(p*Math.PI*2)*-.045:type==='pass'?pulse*.02:0;
  if(rasterArt.striker)drawRasterFighter(ctx,rasterArt.striker,heroX,heroY,{crop:[130,21,808,1386],height:238*fit+breathing,lean,hit:heroHit});
  else {ctx.save();ctx.translate(heroX,heroY);ctx.scale(fit*238/240,fit*238/240);drawDuelist(ctx,0,0,{home:true,hit:heroHit});ctx.restore();}
  const startX=heroX+52*fit,startY=heroY-9*fit,targetX=enemyX-34*fit,targetY=enemyY-94*fit;
  let bx=startX,by=startY;
  if(type==='pass'){bx+=pulse*60*fit;by-=pulse*26*fit;}
  if(type==='dribble'){bx+=pulse*28*fit;by-=Math.abs(Math.sin(p*Math.PI*2))*12*fit;}
  if(type==='shot'||type==='goal'){
    const flight=Math.min(1,p/.72);
    bx=lerp(startX,targetX,flight);by=lerp(startY,targetY,flight)-Math.sin(flight*Math.PI)*55*fit;
    if(p<.72)for(let i=1;i<6;i++){
      const f=Math.max(0,flight-i*.045);
      rect(ctx,lerp(startX,targetX,f),lerp(startY,targetY,f)-Math.sin(f*Math.PI)*55*fit,(10-i)*fit,4*fit,i<3?'#e5bc68':'#527b4c');
    }
  }
  if(type==='concede'){bx=lerp(enemyX-62*fit,heroX+42*fit,p);by=heroY-50*fit-Math.sin(p*Math.PI)*35*fit;}
  if(type==='defense'){
    ctx.save();ctx.translate(heroX,heroY);ctx.scale(fit,fit);ctx.globalAlpha=.23+.14*pulse;
    rect(ctx,72,-162,8,112,'#b7e6ba');rect(ctx,64,-172,8,132,'#b7e6ba');
    rect(ctx,56,-180,8,148,'#b7e6ba');rect(ctx,48,-186,8,160,'#b7e6ba');
    ctx.globalAlpha=.8;rect(ctx,76,-150,4,88,'#d7f0bd');
    cross(ctx,88,-110,9,'#d7f0bd');cross(ctx,68,-162,5,'#d7f0bd');ctx.restore();
  }
  if(type==='dribble'){
    rect(ctx,heroX-108*fit,heroY-40*fit,34*fit,4*fit,'#82aa69');
    rect(ctx,heroX-97*fit,heroY-28*fit,20*fit,4*fit,'#82aa69');
  }
  // The hero image includes the football. Spells only add a moving light projectile.
  if(!rasterArt.striker){pixelEllipse(ctx,bx,heroY+4,14*fit,4*fit,'#183c29');ball(ctx,bx,by,3*fit);}
  else if(type==='shot'||type==='goal'||type==='concede'){
    pixelEllipse(ctx,bx,by,11*fit,11*fit,type==='concede'?'#72bcdf66':'#f3c45b66');
    pixelEllipse(ctx,bx,by,6*fit,6*fit,type==='concede'?'#aeddf0':'#f8dc8e');
    cross(ctx,bx,by,8*fit,'#fff2c7');
  }
  if((type==='shot'||type==='goal')&&p>.55){
    const burst=(p-.55)/.45;
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6,radius=(18+burst*44)*fit;
      rect(ctx,targetX+Math.cos(angle)*radius,targetY+Math.sin(angle)*radius,6*fit,6*fit,i%2?'#e9cb87':'#a9d994');
    }
  }
  if(type==='goal'&&p>.5){
    const life=(p-.5)*2,centre=(heroAnchor+enemyAnchor)/2;
    for(let i=0;i<32;i++){
      const angle=i*2.39996,radius=(24+life*(44+i%7*13))*fit;
      rect(ctx,centre+Math.cos(angle)*radius,heroY-150*fit+Math.sin(angle)*radius-life*20*fit,(4+i%2*2)*fit,(4+i%3*2)*fit,[C.gold,C.mint,C.homeLight,C.cream][i%4]);
    }
    cross(ctx,centre-80*fit,heroY-180*fit,10*fit,C.gold);cross(ctx,centre+78*fit,heroY-208*fit,6*fit,C.mint);
  }
  if(type==='concede'&&p>.35&&p<.8){cross(ctx,heroX+48*fit,heroY-138*fit,13*fit,'#f4a67a');cross(ctx,heroX-42*fit,heroY-88*fit,7*fit,'#e7b578');}
  ctx.restore();
}

function drawIllustratedCard(ctx, type, accent, bg) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 120, 64); ctx.clip();
  // The same protagonist anchors the card collection; crop only at draw time.
  ctx.drawImage(rasterArt.striker, 210, 30, 610, 940, 6, -5, 66, 102);
  ctx.globalAlpha = .24;
  rect(ctx, 74, 0, 46, 64, bg);
  ctx.globalAlpha = 1;
  if (type === 'pass') {
    dashedPath(ctx, 68, 48, 108, 24, accent, 10, 10);
    rect(ctx, 97, 17, 14, 4, accent); rect(ctx, 107, 17, 4, 14, accent);
    ball(ctx, 88, 36, 1.7);
  } else if (type === 'dribble') {
    cone(ctx, 100, 54, 1);
    dashedPath(ctx, 76, 50, 110, 18, accent, 9, 10);
    rect(ctx, 75, 25, 10, 3, accent); rect(ctx, 80, 19, 10, 3, accent);
    cross(ctx, 105, 14, 4, '#f4d286');
  } else if (type === 'shot') {
    for (let i=0;i<5;i++) rect(ctx, 69+i*5, 43-i*3, 14, 3, i<2?'#bd724d':'#edb66a');
    pixelEllipse(ctx, 98, 27, 13, 13, '#cb754b');
    pixelEllipse(ctx, 98, 27, 10, 10, '#efbd6c');
    ball(ctx, 98, 27, 1.7);
    cross(ctx, 111, 12, 4, '#ffe6a2');
  } else if (type === 'defense') {
    rect(ctx, 78, 12, 30, 4, accent); rect(ctx, 74, 16, 38, 22, accent);
    rect(ctx, 78, 38, 30, 6, accent); rect(ctx, 84, 44, 18, 6, accent); rect(ctx, 90, 50, 6, 4, accent);
    rect(ctx, 80, 18, 26, 18, '#36525a'); rect(ctx, 84, 36, 18, 6, '#36525a');
    rect(ctx, 90, 22, 6, 18, '#d9e5cc'); rect(ctx, 84, 28, 18, 6, '#d9e5cc');
  } else {
    frame(ctx, 76, 12, 36, 42, accent, 2);
    rect(ctx, 78, 32, 32, 2, '#6b647f');
    dashedPath(ctx, 83, 44, 104, 20, '#e7d9ef', 3, 9);
    cross(ctx, 84, 20, 4, '#dda777'); cross(ctx, 104, 44, 4, '#dda777');
    pixelEllipse(ctx, 84, 44, 4, 4, accent, 2); pixelEllipse(ctx, 104, 20, 4, 4, accent, 2);
  }
  ctx.restore();
}

/** Draw a compact, opaque, text-free illustration for a card type. */
export function drawCardArt(ctx, type = 'tactic', options = {}) {
  const width = options.width || ctx.canvas.width || 120;
  const height = options.height || ctx.canvas.height || 64;
  const upgraded = !!options.upgraded;
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

  if (rasterArt.striker) {
    drawIllustratedCard(ctx, type, accent, bg);
    if (upgraded) { cross(ctx, 112, 8, 4, C.gold); rect(ctx, 4, 58, 112, 2, '#c1a45e'); }
    ctx.restore();
    return;
  }

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
  const crop = atlasFrames.equipment[index];
  if (rasterArt.equipment && crop) {
    ctx.save(); ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,width,height);
    const scale=Math.min(width*.92/crop[2],height*.92/crop[3]);
    const drawWidth=crop[2]*scale,drawHeight=crop[3]*scale;
    ctx.drawImage(rasterArt.equipment,...crop,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
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
