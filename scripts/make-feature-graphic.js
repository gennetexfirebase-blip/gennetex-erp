#!/usr/bin/env node
/**
 * Google Play-ийн feature graphic (1024×500) үүсгэнэ.
 *
 * ЯАГААД ГАРААР PNG БИЧИЖ БАЙНА ВЭ:
 *   Энэ орчинд sharp ч, ImageMagick ч алга. Feature graphic нь Play-ийн
 *   ЗААВАЛ шаардлага тул гуравдагч хэрэгсэлгүйгээр үүсгэх шаардлагатай
 *   болов. PNG нь үнэндээ zlib-ээр шахсан мөрүүд тул цэвэр Node-оор
 *   бичих боломжтой.
 *
 * ЗОХИОМЖ:
 *   Брэндийн хөх диагональ градиент (#062B41 → #0099DB, логоны өнгөнөөс)
 *   дээр цагаан бөөрөнхий карт, түүн дотор лого. Лого нь цагаан
 *   дэвсгэртэй тул карт нь зүгээр нэг чимэг биш — логог дэвсгэрээс
 *   зааглах шийдэл.
 *
 * Ажиллуулах:  node scripts/make-feature-graphic.js
 * Гаралт:      store-assets/feature-graphic-1024x500.png
 */
const fs=require('fs'), zlib=require('zlib');
const W=1024,H=500;

function crc32(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}
let crc=0xFFFFFFFF;for(const b of buf)crc=t[(crc^b)&0xFF]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
const td=Buffer.concat([Buffer.from(type,'ascii'),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));
return Buffer.concat([len,td,c]);}

function readPNG(p){
  const b=fs.readFileSync(p); let i=8,w,h,bd,ct,idat=[];
  while(i<b.length){const len=b.readUInt32BE(i);const type=b.toString('ascii',i+4,i+8);
    const d=b.slice(i+8,i+8+len);
    if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];}
    if(type==='IDAT')idat.push(d);
    if(type==='IEND')break; i+=12+len;}
  const ch={0:1,2:3,4:2,6:4}[ct];
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const bpp=ch, stride=w*bpp, out=Buffer.alloc(w*h*4);
  let prev=Buffer.alloc(stride);
  for(let y=0;y<h;y++){
    const f=raw[y*(stride+1)];
    const line=Buffer.from(raw.slice(y*(stride+1)+1,y*(stride+1)+1+stride));
    for(let x=0;x<stride;x++){
      const a=x>=bpp?line[x-bpp]:0, bb=prev[x], c=x>=bpp?prev[x-bpp]:0;
      if(f===1)line[x]=(line[x]+a)&255; else if(f===2)line[x]=(line[x]+bb)&255;
      else if(f===3)line[x]=(line[x]+((a+bb)>>1))&255;
      else if(f===4){const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);
        line[x]=(line[x]+(pa<=pb&&pa<=pc?a:pb<=pc?bb:c))&255;}
    }
    prev=line;
    for(let x=0;x<w;x++){const s=x*bpp,d=(y*w+x)*4;
      if(ch===3){out[d]=line[s];out[d+1]=line[s+1];out[d+2]=line[s+2];out[d+3]=255;}
      else if(ch===4){out[d]=line[s];out[d+1]=line[s+1];out[d+2]=line[s+2];out[d+3]=line[s+3];}
      else if(ch===1){out[d]=out[d+1]=out[d+2]=line[s];out[d+3]=255;}
      else {out[d]=out[d+1]=out[d+2]=line[s];out[d+3]=line[s+1];}}
  }
  return {w,h,px:out};
}

const logo=readPNG('assets/logo.png');
const px=Buffer.alloc(W*H*4);

// ── Дэвсгэр: брэндийн хөх диагональ градиент ───────────────
// #062B41 (гүн) → #0099DB (брэнд). Логоны хөх өнгөнөөс гаргав.
const A=[0x06,0x2B,0x41], B=[0x00,0x99,0xDB];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let t=(x/W)*0.78 + (y/H)*0.22;
  t=t*t*(3-2*t);                       // smoothstep — зөөлөн шилжилт
  const d=(y*W+x)*4;
  for(let k=0;k<3;k++) px[d+k]=Math.round(A[k]+(B[k]-A[k])*t);
  px[d+3]=255;
}

// ── Зөөлөн гэрлийн толбо (баруун дээд) ────────────────────
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=(x-800)/460, dy=(y-90)/300;
  const g=Math.max(0,1-Math.sqrt(dx*dx+dy*dy));
  if(g<=0)continue;
  const d=(y*W+x)*4, a=g*g*0.30;
  for(let k=0;k<3;k++) px[d+k]=Math.min(255,Math.round(px[d+k]+255*a));
}

// ── Цагаан бөөрөнхий карт ─────────────────────────────────
const CX=512, CY=250, CW=760, CH=316, R=28;
function inCard(x,y){
  const l=CX-CW/2,t=CY-CH/2,r=CX+CW/2,b=CY+CH/2;
  if(x<l||x>r||y<t||y>b)return 0;
  const qx=Math.min(x-l,r-x), qy=Math.min(y-t,b-y);
  if(qx>=R||qy>=R)return 1;
  const dx=R-Math.min(qx,R), dy=R-Math.min(qy,R);
  const dist=Math.sqrt(dx*dx+dy*dy);
  return Math.max(0,Math.min(1,R-dist+0.5));   // зөөлөн ирмэг
}
// сүүдэр
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const s=inCard(x-0,y-9); if(s<=0)continue;
  const d=(y*W+x)*4, a=s*0.22;
  for(let k=0;k<3;k++) px[d+k]=Math.round(px[d+k]*(1-a));
}
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const s=inCard(x,y); if(s<=0)continue;
  const d=(y*W+x)*4;
  for(let k=0;k<3;k++) px[d+k]=Math.round(px[d+k]*(1-s)+255*s);
}

// ── Лого (bilinear) ───────────────────────────────────────
const scale=Math.min((CW-150)/logo.w,(CH-70)/logo.h);
const LW=Math.round(logo.w*scale), LH=Math.round(logo.h*scale);
const OX=Math.round(CX-LW/2), OY=Math.round(CY-LH/2);
for(let y=0;y<LH;y++)for(let x=0;x<LW;x++){
  const sx=(x+0.5)/scale-0.5, sy=(y+0.5)/scale-0.5;
  const x0=Math.max(0,Math.floor(sx)), y0=Math.max(0,Math.floor(sy));
  const x1=Math.min(logo.w-1,x0+1), y1=Math.min(logo.h-1,y0+1);
  const fx=sx-x0, fy=sy-y0;
  const g=(xx,yy,k)=>logo.px[(yy*logo.w+xx)*4+k];
  const c=[0,1,2,3].map(k=>
    g(x0,y0,k)*(1-fx)*(1-fy)+g(x1,y0,k)*fx*(1-fy)+
    g(x0,y1,k)*(1-fx)*fy   +g(x1,y1,k)*fx*fy);
  // ⚠️ Alpha сувгийг ЗААВАЛ тооцно. Эхний оролдлогод үүнийг үл тоомсорлож,
  //    зөвхөн гэрэлтүүлгээр цагаан дэвсгэрийг таслах гэсэн тул ТУНГАЛАГ
  //    цэгүүд RGB(0,0,0) буюу хар болж, логоны ард хар тэгш өнцөгт гарсан.
  const a=c[3]/255; if(a<=0.004)continue;
  const d=((OY+y)*W+(OX+x))*4;
  for(let k=0;k<3;k++) px[d+k]=Math.round(px[d+k]*(1-a)+c[k]*a);
}

// ── PNG бичих ─────────────────────────────────────────────
const raw=Buffer.alloc(H*(W*3+1));
for(let y=0;y<H;y++){raw[y*(W*3+1)]=0;
  for(let x=0;x<W;x++){const s=(y*W+x)*4,d=y*(W*3+1)+1+x*3;
    raw[d]=px[s];raw[d+1]=px[s+1];raw[d+2]=px[s+2];}}
const ihdr=Buffer.alloc(13);
ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;
const out=Buffer.concat([
  Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
  chunk('IHDR',ihdr),
  chunk('IDAT',zlib.deflateSync(raw,{level:9})),
  chunk('IEND',Buffer.alloc(0))]);
fs.mkdirSync('store-assets',{recursive:true});
fs.writeFileSync('store-assets/feature-graphic-1024x500.png',out);
console.log('bichlee:', (out.length/1024).toFixed(0)+' KB', W+'x'+H);
