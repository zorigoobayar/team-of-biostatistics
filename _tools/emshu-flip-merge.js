/* ЭМШУ: каталогийн жагсаалт (paper-emshu-data.js) дээр цахим хувилбараас (fliphtml5) гаргасан агуулгыг нэмнэ.
   Хэрэглээ: node _tools/emshu-flip-merge.js assets/js/paper-emshu-data.js flip.json assets/js/paper-emshu-data.js
   flip.json нь _tools/emshu-flip-extract.js-ийн гаргасан JSON. Дахин ажиллуулахад давхардахгүй. */
const fs=require('fs');
const [,, dataPath, flipPath, outPath]=process.argv;
const src=fs.readFileSync(dataPath,'utf8');
const window={}; eval(src); const d=window.PS_EMSHU;
const flip=JSON.parse(fs.readFileSync(flipPath,'utf8'));
const sq=s=>String(s||'').toLowerCase().replace(/ү/g,'у').replace(/ө/g,'о').replace(/ё/g,'е').replace(/[^0-9a-zа-я]+/g,'');
// эхний төлөвт буцаана (дахин ажиллуулахад давхардахгүй)
d.articles=d.articles.filter(a=>typeof a[0]==='number').map(a=>a.slice(0,6));
d.issues.forEach(is=>{ delete is.toc; delete is.ocr; });
d.issues.forEach(is=>{ if(is.deadFlip&&!is.flip){ is.flip=is.deadFlip; } delete is.deadFlip; });
const byFlip={}; d.issues.forEach((is,i)=>{ if(is.flip){ byFlip[is.flip.replace(/\/$/,'').split('/').pop()]=i; } });
let added=0, dup=0, deep=0; const rep=[];
for(const id of Object.keys(flip.issues)){
  const idx=byFlip[id]; if(idx===undefined) throw new Error('no issue for '+id);
  const is=d.issues[idx], fi=flip.issues[id];
  const have=new Set(d.articles.filter(a=>a[1]===idx).map(a=>sq(a[2]).slice(0,30)));
  let n=0;
  fi.arts.forEach((a,k)=>{ const [title,authors,pages,kw,fp]=a; if(have.has(sq(title).slice(0,30))){ dup++; return; }
    const row=['f'+is.id+'-'+(k+1), idx, title, authors, pages||'', kw||[]]; if(fp) row.push(fp); d.articles.push(row); n++; added++; });
  is.toc='flip'; if(fi.ocr) is.ocr=1;
  rep.push(is.label+': +'+n+(fi.ocr?' (OCR)':''));
}
d.articles.forEach(a=>{ if(typeof a[0]==='number'&&flip.fp[a[0]]){ a[6]=flip.fp[a[0]]; deep++; } });
// Ажиллахаа больсон (404) цахим хувилбарын холбоосыг хасаж, deadFlip-д тэмдэглэнэ
(flip.dead||[]).forEach(id=>{ const i=byFlip[id]; if(i!==undefined){ d.issues[i].deadFlip=d.issues[i].flip; delete d.issues[i].flip; rep.push(d.issues[i].label+': цахим холбоос ажиллахгүй (хассан)'); } });
d.updated='2026-10-09';
const cnt=d.issues.map(()=>0); d.articles.forEach(a=>cnt[a[1]]++);
const empty=cnt.filter(c=>!c).length;
const head=`/* =========================================================
   ЭМШУ — АШУҮИС-ийн «Эрүүл мэндийн шинжлэх ухаан» сэтгүүлийн
   нийтлэлийн жагсаалт (paper-stats.js ЭМШУ таб нээгдэхэд ачаална).

   Эх сурвалж:
     1) АШУҮИС-ийн номын сангийн каталог, catalog.mnums.edu.mn
        (${d.articles.length-added} нийтлэл, 2026-10-06)
     2) Каталогт нийтлэл нь тус тусдаа бүртгэгдээгүй дугаарын агуулгыг
        сэтгүүлийн цахим хувилбарын (online.fliphtml5.com/lluzx/…)
        гарчгийн хуудаснаас авсан (${added} нийтлэл, 2026-10-09).
   Шинэчилсэн: ${d.updated} · ${d.issues.length} дугаар · ${d.articles.length} нийтлэл
   (${empty} дугаарын агуулга ороогүй: цахим хувилбар нь зураг хэлбэртэй, эсвэл байхгүй)

   issues:   { id: дугаарын каталогийн бичлэг, label, year, flip: цахим хувилбар,
               toc: "flip" = агуулгыг цахим хувилбараас авсан,
               ocr: 1 = цахим хувилбарын бичвэр нь зургаас машинаар уншигдсан (алдаатай байж болно),
               deadFlip: каталогт байгаа боловч ажиллахаа больсон цахим холбоос (харуулахгүй) }
             хамгийн сүүлийн дугаараас эхлэн эрэмбэлсэн
   articles: [дугаар, issues дахь индекс, гарчиг, [зохиогчид], хуудас, [түлхүүр үг], цахим хувилбарын хуудас]
             дугаар: тоо = каталогийн бичлэг; "f<дугаарын бичлэг>-<эрэмбэ>" = цахим хувилбараас авсан
             цахим хувилбарын хуудас (байвал): flip + "#p=" + хуудас гэж шууд нээнэ
   ========================================================= */
`;
fs.writeFileSync(outPath, head+'window.PS_EMSHU = '+JSON.stringify(d)+';\n');
console.log(rep.join('\n')); console.log({added,dup,deep,total:d.articles.length,issues:d.issues.length,empty});
