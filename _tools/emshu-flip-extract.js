window.emshuFlipExtract = async function (cfg) {
  /* =========================================================
     ЭМШУ сэтгүүлийн цахим хувилбараас (fliphtml5) агуулга гаргах хэрэгсэл.

     Хэрэглээ: хөтчөөр https://online.fliphtml5.com/lluzx/<аль нэг дугаар>/ хуудсыг нээгээд
     хөгжүүлэгчийн консолд (F12) энэ файлыг бүхэлд нь хуулж ажиллуулна, дараа нь:

       const json = await emshuFlipExtract({
         catalogUrl: "https://zorigoobayar.github.io/team-of-biostatistics/assets/js/paper-emshu-data.js",
         clean: ["jggm", "fufd", "ajrg", "apxy", "bpnv", "lqef"],   // бичвэр нь цэвэр (PDF-ээс шууд) дугаарууд
         ocr:   ["fhlz", "wnpi", "lhid", "azei", "vgqs", "nabz", "weqt", "ucws", "hwcb", "pugo"] // зургаас уншигдсан
       });
       copy(json);   // гарсан JSON-ыг flip.json нэрээр хадгалаад emshu-flip-merge.js-ээр нэгтгэнэ

     Юу хийдэг вэ:
       1. Дугаар бүрийн files/search/search_config.js (хуудас бүрийн бичвэр) файлыг уншина.
       2. «ГАРЧИГ / АГУУЛГА» хуудаснаас нийтлэлийн гарчиг, зохиогч, хуудсыг задална.
       3. Гарчгийг дугаарын бичвэрээс хайж, цахим хувилбарын аль хуудсанд байгааг олно.
       4. Зургаас уншигдсан (OCR) дугаарт үсэг хоорондын илүү зай, м/н, й/и андуурлыг
          цэвэр дугаарууд болон каталогийн үгсийн сангаар засна.
       5. Каталогт бүртгэлтэй нийтлэлүүдэд мөн цахим хувилбарын хуудсыг олж өгнө (fp).
     Бичвэргүй (зураг хэлбэртэй) дугаараас юу ч гарахгүй.
     ========================================================= */
  cfg = cfg || {};
  var account = cfg.account || "lluzx", cache = cfg.cache || {}, X = {}, E = {};
  async function getPages(id) {
    if (cache[id]) return cache[id];
    var r = await fetch("/" + account + "/" + id + "/files/search/search_config.js");
    if (!r.ok) throw new Error("HTTP " + r.status);
    var t = await r.text();
    return (cache[id] = (new Function(t + ";return textForPages;"))());
  }
  var w = {}; (new Function("window", await (await fetch(cfg.catalogUrl)).text()))(w);
  var CAT = w.PS_EMSHU;
  CAT.articles = CAT.articles.filter(function (a) { return typeof a[0] === "number"; });
  var cleanIds = cfg.clean || [], ocrIds = cfg.ocr || [], OCR = {};
  ocrIds.forEach(function (id) { OCR[id] = 1; });
  for (const id of cleanIds.concat(ocrIds)) E[id] = await getPages(id);

  X.CYR=/[А-Яа-яӨөҮүЁё]+/g;
  X.V=new Map(); X.add=(s,w)=>{ (s.match(X.CYR)||[]).forEach(t=>{t=t.toLowerCase(); X.V.set(t,(X.V.get(t)||0)+(w||1));}); };
  cleanIds.forEach(id=>E[id].forEach(p=>X.add(p)));
  CAT.articles.forEach(a=>{X.add(a[2],2);(a[3]||[]).forEach(n=>X.add(n,2));(a[5]||[]).forEach(n=>X.add(n,2));});
  X.f=t=>X.V.get(t.toLowerCase())||0;
  X.sq=s=>String(s||'').toLowerCase().replace(/ү/g,'у').replace(/ө/g,'о').replace(/ё/g,'е').replace(/[мп]/g,'н').replace(/й/g,'и').replace(/[^0-9a-zа-я]+/g,'');
  X.isHdr=l=>/Эрүүл\s*Мэндийн\s*Шинжлэх|ЭРҮҮЛ\s*МЭНДИЙН\s*ШИНЖЛЭХ|^ГАРЧИГ$|^Гарчиг$|^АГУУЛГА$|ЧУУЛГАН|чуулган-?\s*\d+.*дугаар|Тусгай дугаар Эрүүл|V[oо0O]l?[1l]?\s*\.?\s*\d\d\s*,|Vol\.|№\s*\d+\s*,?\s*\(?\d\d/.test(l);
  X.isSec=l=>/^(Эрдэм шинжилгээний (өгүүлэл|ажил)|(Системчилсэн\s)?[Тт]о[йи]м өгүүлэл|Эмнэл\s?зүйн тохиолдол|Тохиолдлын (тайлан|судалгаа)|Мэдээлэл|Лекц|Хэлэлцүүлэг|Судалгааны өгүүлэл|Товч өгүүлэл|Түүхэн тойм)\s*\d*$/i.test(l) || (/^[А-ЯӨҮЁ\s\-,0-9]+$/.test(l) && l.replace(/[^А-ЯӨҮЁ]/g,'').length>=8);
  X.reInit=/^[А-ЯӨҮЁA-Z][а-яөүё]?\s*\.\s*[А-ЯӨҮЁA-Z]/;
  X.reNoDot=/^[А-ЯӨҮЁ][А-ЯӨҮЁ][а-яөүё]{2,}/;
  X.isAuth=(l,inAuth)=>{ const tk=l.split(/[,;]/).map(s=>s.trim()).filter(Boolean); if(!tk.length) return false; const m=tk.filter(t=>X.reInit.test(t)||X.reNoDot.test(t)).length; const short=tk.every(t=>t.split(/\s+/).length<=5);
    if(m/tk.length>=0.5) return true; if(m>=1&&short&&tk.length>=2) return true; if(inAuth&&short&&tk.length>=1&&/^[A-ZА-ЯӨҮЁ]/.test(tk[0])&&!/[а-яөүё]{3,}\s+[а-яөүё]{3,}\s+[а-яөүё]{3,}/.test(l)&&l.length<70&&/,\s*$/.test(X._prev||'')) return true; return false; };
  X.numLine=l=>{ const m=/^(\d(?:\s?\d){0,2})\s*(\.)?$/.exec(l); return m?{n:parseInt(m[1].replace(/\s/g,''),10),dot:!!m[2]}:null; };
  X.skipTitle=t=>/^(м\s?эндчилгээ|өмнөх үг|редакци|гарчиг|агуулга|зохиогчдод|хавсралт)/i.test(t.trim());
  /* Агуулгын хуудсууд: «ГАРЧИГ/АГУУЛГА» гэсэн хуудаснаас эхлээд зохиогчийн мөр ихтэй дараагийн хуудсууд */
  X.tocPages=id=>{ const p=E[id]; let s=-1; for(let i=0;i<14;i++){ if(/(^|\n)\s*(ГАРЧИГ|АГУУЛГА|Гарчиг)\s*(\r?\n|$)/.test(p[i]||'')){s=i;break;} } if(s<0) return []; const r=[s];
    for(let i=s+1;i<s+6;i++){ const t=p[i]||''; const ls=t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const bul=ls.filter(l=>/^[•·▪■]\s/.test(l)).length; if(bul>=4){r.push(i);continue;}
      if(/Товч утга|Abstract|Түлхүүр үг|МЭНДЧИЛГЭЭ|Хүндэт|Background/i.test(t)&&!/(^|\n)\s*\d{1,2}\s*\.\s/.test(t.slice(0,300))) break; const au=ls.filter(l=>X.isAuth(l,false)).length; if(au<4||au/ls.length<0.12) break; r.push(i);} return r; };
  /* Агуулгын мөрүүдийг нийтлэл болгон бүлэглэнэ: гарчиг (1+ мөр) → зохиогчид (0+ мөр) → хуудас */
  X.parseToc=id=>{ const p=E[id], tp=X.tocPages(id), ents=[], S=new Set(); let cur=null, sec='';
    const push=()=>{ if(cur){ents.push(cur);} cur=null; };
    tp.forEach(pi=>{ const ls=p[pi].split(/\r?\n/).map(x=>x.replace(/\u0002/g,'-').replace(/\s+/g,' ').trim()).filter(Boolean); X._prev='';
      for(let k=0;k<ls.length;k++){ let l=ls[k]; const nl=X.numLine(l);
        if(nl){ S.add(nl.n); const nx=ls[k+1]?X.numLine(ls[k+1]):null; const pv=k>0?X.numLine(ls[k-1]):null; if(!nl.dot&&cur&&!cur.page&&!nx&&!pv){cur.page=nl.n; cur.closed=true;} X._prev=l; continue; }
        if(X.isHdr(l)){ X._prev=l; continue; }
        if(X.isSec(l)){ push(); sec=l.replace(/\s*\d+$/,''); X._prev=l; continue; }
        let pm=/^(\d{1,3})\s+(\d{1,2})\s*\.\s+(.*)$/.exec(l), m=/^(\d{1,2})\s*\.\s+(.*)$/.exec(l), b=/^[•·▪■]\s+(.*)$/.exec(l);
        if(pm){ push(); S.add(+pm[1]); cur={n:+pm[2],t:[pm[3]],a:[],sec:sec,pi:pi,page:+pm[1]}; X._prev=l; continue; }
        if(m||b){ push(); const txt=(m?m[2]:b[1]); cur={n:m?+m[1]:0,t:[txt],a:[],sec:sec,pi:pi}; X._prev=l; continue; }
        if(cur&&cur.t.length){ let al=l, ap=0; const am=/^(.*[А-Яа-яӨөҮүЁё.,])\s+(\d{1,3})$/.exec(l); if(am&&X.isAuth(am[1],cur.a.length>0)){ al=am[1]; ap=+am[2]; }
          if(X.isAuth(al,cur.a.length>0)){ cur.a.push(al); if(ap&&!cur.page){cur.page=ap;S.add(ap);} X._prev=l; continue; } }
        if(X.skipTitle(l)){ push(); ents.push({n:0,t:[l],a:[],skip:true,pi:pi}); X._prev=l; continue; }
        if(cur&&!cur.a.length&&!cur.closed){ cur.t.push(l); } else { push(); cur={n:0,t:[l],a:[],sec:sec,pi:pi}; }
        X._prev=l;
      }
      push();
    });
    return {tp:tp.map(i=>i+1),ents:ents,S:S};
  };
  /* OCR засвар: үгийн сангаар шалгаж үсэг хоорондын илүү зайг нийлүүлнэ, м/н, й/и, п/н андуурлыг засна */
  X.SHORT=new Set('ба нь ч л эм үр ам ус үе үг ар өр он уг эх ах юм би та аж ан ой од ир ор ид ив үс өв гэж уу юу эр эд ач ая аз ид өд яс яв'.split(' '));
  X.capLike=(src,w)=>/^[А-ЯӨҮЁ]/.test(src)?w.charAt(0).toUpperCase()+w.slice(1):w;
  X.conf=w=>{ if(w.length<2||X.f(w)>=2) return w; const lw=w.toLowerCase(); const pos=[]; for(let i=0;i<lw.length;i++){ if('мнийп'.includes(lw[i])) pos.push(i); } if(!pos.length||pos.length>12) return w; const need=w.length<4?30:2; if(w.length<4&&X.f(w)>0) return w; const alt={'м':['н'],'н':['м','и'],'и':['й','н'],'й':['и'],'п':['н']}; let best=null;
    const rec=(start,arr,depth)=>{ if(depth>0){ const c=arr.join(''); const fr=X.f(c); if(fr>=need&&(!best||fr>best.f)) best={w:c,f:fr}; } if(depth>=3) return; for(let k=start;k<pos.length;k++){ const i=pos[k]; for(const a of alt[lw[i]]){ const o=arr[i]; arr[i]=a; rec(k+1,arr,depth+1); arr[i]=o; } } };
    rec(0,lw.split(''),0); return best?X.capLike(w,best.w):w; };
  X.pure=t=>/^[А-Яа-яӨөҮүЁё]+$/.test(t);
  X.repair1=s=>{ let tk=s.split(' '); const out=[]; let i=0; while(i<tk.length){ let done=false;
      for(let k=4;k>=2&&!done;k--){ if(i+k>tk.length) continue; const fr=tk.slice(i,i+k); const lm=/^([А-Яа-яӨөҮүЁё]+(?:-[А-Яа-яӨөҮүЁё]+)*)([.,:;)”"»?]*)$/.exec(fr[k-1]); const fm=/^([“"«(]*)([А-Яа-яӨөҮүЁё]+)$/.exec(fr[0]); if(!lm||!fm) continue; const parts=[fm[2]].concat(fr.slice(1,k-1)).concat([lm[1]]); if(!parts.slice(0,-1).every(X.pure)) continue; if(parts.slice(1).some(x=>/^[А-ЯӨҮЁ]/.test(x)&&x.length>1)) continue;
        const m=parts.join(''); let fmg=X.f(m), mm=m; if(fmg<2){ const c=X.conf(m); if(c!==m){mm=c; fmg=X.f(c);} }
        const weak=parts.some(x=>(x.length<=2&&!X.SHORT.has(x.toLowerCase()))||X.f(x)<fmg/4);
        if(fmg>=2&&weak){ out.push(fm[1]+mm+lm[2]); i+=k; done=true; } }
      if(!done){ if(i+1<tk.length&&/^[“"«(]*[А-ЯӨҮЁ]$/.test(tk[i])&&/^[а-яөүё]{2,}/.test(tk[i+1])&&X.f(tk[i+1].replace(/[^а-яөүё].*$/,''))<2){ out.push(tk[i]+tk[i+1]); i+=2; } else { out.push(tk[i]); i++; } } }
    return out.join(' '); };
  X.repair=s=>{ s=s.replace(/А\s?Ш\s?У\s?Ү\s?[ИП]\s?С/g,'АШУҮИС'); for(let n=0;n<3;n++){ const r=X.repair1(s); if(r===s) break; s=r; } return s.replace(/[А-Яа-яӨөҮүЁё]{2,}/g,w=>X.conf(w)); };
  /* Зохиогч: «Б.Нэр» → «Нэр, Б.» (каталогийн хэлбэр). Харьяалал, хог тэмдэгтийг хасна */
  X.LAT={'A':'А','B':'В','E':'Е','K':'К','M':'М','H':'Н','O':'О','P':'Р','C':'С','T':'Т','X':'Х','Y':'У'};
  X.fixName=(t,ocr)=>{ t=t.replace(/[\d*¹²³⁴⁵⁶⁷⁸⁹⁰\\|_~^§]+/g,'').replace(/\s+/g,' ').replace(/\s+\./g,'.').trim().replace(/^[.,\-\s]+|[,\-\s]+$/g,''); if(!t) return '';
    if(/АШУҮ|Сургуул|тэнхим|эмнэлэг|хүрээлэн|төв\b|их сургуул|салбар/i.test(t)) return '';
    t=t.replace(/^([ABEKMHOPCTXY])\.(?=\s?[А-ЯӨҮЁ])/,(m,c)=>X.LAT[c]+'.');
    let m=/^([А-ЯӨҮЁ][а-яөүё]?)\.\s*(.+)$/.exec(t); if(!m){ const m2=/^([А-ЯӨҮЁ])([А-ЯӨҮЁ][а-яөүё].*)$/.exec(t); if(m2&&!/\s/.test(t)) m=[t,m2[1],m2[2]]; } if(!m){ const m3=/^([А-ЯӨҮЁ])\s([А-ЯӨҮЁ])\s?([а-яөүё\-]{3,})$/.exec(t)||/^([А-ЯӨҮЁ])\s()([А-ЯӨҮЁ][а-яөүё\-]{3,})$/.exec(t); if(m3) m=[t,m3[1],m3[2]+m3[3]]; }
    if(m){ let nm=m[2].replace(/\s+/g,'').replace(/\.+$/,''); if(/[А-яӨөҮүЁё]{3}/.test(nm)) nm=nm.replace(/[A-Za-z]+$/,'').replace(/([а-яөүё])[А-ЯӨҮЁ]+$/,'$1'); if(nm.length<3) return ''; if(!/^[А-ЯӨҮЁа-яөүё\-]+$/.test(nm)) return ocr&&/[А-яӨөҮүЁё]/.test(nm)&&/[A-Za-z]/.test(nm)?'':m[1]+'.'+nm; if(ocr) nm=nm.split('-').map(x=>X.conf(x)).join('-'); nm=nm.charAt(0).toUpperCase()+nm.slice(1); return nm+', '+m[1]+'.'; }
    if(ocr){ if(/^[A-Za-z.\-\s()]{4,}$/.test(t)) return t; const ws=t.match(/[А-Яа-яӨөҮүЁё]+/g)||[]; if(!ws.length||/[A-Za-z]/.test(t)||!ws.every(w=>X.f(w)>=1&&w.length>1)) return ''; }
    return t; };
  X.authors=(lines,ocr)=>{ const s=lines.join(' ').replace(/\s+\./g,'.'); const out=[]; s.split(/[,;]/).forEach(c=>{ c.trim().split(/\s+(?=[А-ЯӨҮЁ][а-яөүё]?\s?\.\s?[А-ЯӨҮЁ])/).forEach(t=>{ const n=X.fixName(t,ocr); if(n&&n.length>1&&out.indexOf(n)<0) out.push(n); }); }); return out; };
  /* Агуулгад зохиогчгүй (тусгай дугаар) бол нийтлэлийн эхний хуудаснаас «Цахим шуудан»-гийн өмнөх нэрсийг авна */
  X.pageAuthors=(id,fp)=>{ for(const d of [0,1]){ const t=E[id][fp-1+d]||''; const c=t.search(/Цахим шуудан/); if(c<0) continue; const reg=t.slice(Math.max(0,c-900),c).replace(/\r?\n/g,' ').replace(/\s+,/g,','); const out=[]; const re=/(?:^|[\s,(])([А-ЯӨҮЁ][а-яөүё]?\.\s?[А-ЯӨҮЁ][а-яөүё]+(?:-[А-ЯӨҮЁ][а-яөүё]+)?)/g; let m; while((m=re.exec(reg))){ const n=X.fixName(m[1],false); if(n&&out.indexOf(n)<0) out.push(n); } if(out.length) return out; } return []; };
  /* Түлхүүр үг: нийтлэлийн эхний (эсвэл дараагийн) хуудасны «Түлхүүр үг:» хэсэг. Таслалаар эсвэл мөрөөр тусгаарлагдсан */
  X.keywords=(id,fp,ocr)=>{ for(let d=0;d<2;d++){ const t=E[id][fp-1+d]||''; const k=t.search(/Түлхүүр\s*үг(?:с)?\s*:?/); if(k<0) continue; const rest=t.slice(k).replace(/^Түлхүүр\s*үг(?:с)?\s*:?\s*/,'').slice(0,380); let ks=[];
      const head=rest.slice(0,160); if((head.match(/,/g)||[]).length>=2){ const m=/^([\s\S]{5,330}?)(?:\.\s*(?:\r?\n|$)|\r?\n\s*(?:Товч утга|Үндэслэл|Abstract|Оршил|Key\s?words|Background|Удиртгал|Цахим|Зорилго|Summary)|\r?\n(?=[А-ЯӨҮЁ][^,\n]{45,}))/.exec(rest); if(m) ks=m[1].replace(/\r?\n/g,' ').split(/[,;]/); }
      else { const ls=rest.split(/\r?\n/); let cur=''; for(const raw of ls){ const l=raw.trim(); if(!l) continue; if(/:/.test(l)||l.length>42||/^\d/.test(l)||/Vol\.|Эрүүл Мэндийн|[.!?]$/.test(l)){ break; } const cont=cur&&(/\s$/.test(cur)||/^[а-яөүё(]/.test(l)); if(cont){ cur=cur+(/\s$/.test(cur)?'':' ')+raw.replace(/^\s+/,''); } else { if(cur) ks.push(cur); cur=raw; } if(ks.length>=8) break; } if(cur&&ks.length<8&&!/\s$/.test(cur)) ks.push(cur); }
      ks=ks.map(x=>x.replace(/\s+/g,' ').trim().replace(/[.;]$/,'')).map(x=>ocr?X.repair(x):x).filter(x=>x.length>2&&x.length<70&&x.split(' ').length<=7); if(ks.length>=2&&ks.length<=9) return ks; }
    return []; };
  X.SQ={}; X.sqp=id=>X.SQ[id]||(X.SQ[id]=E[id].map(X.sq));
  /* Гарчгийг дугаарын бичвэрээс (зай, тэмдэгтгүй болгож) хайж цахим хувилбарын хуудсыг олно */
  X.build=id=>{ const r=X.parseToc(id); const numbered=r.ents.filter(x=>x.n).length>r.ents.length*0.6;
    let ents=r.ents.filter(e=>!e.skip);
    ents.forEach(e=>{ if(numbered&&!e.n){ const m=/^(\d{1,2})\s+(?=[А-ЯӨҮЁA-Z“"])(.*)$/.exec(e.t[0]); if(m){e.n=+m[1]; e.t[0]=m[2];} } });
    const tr=ents.filter(e=>/\s\d{1,3}$/.test(e.t[0])||/\s\d{1,3}$/.test(e.t[e.t.length-1])).length; const trail=tr>=ents.length*0.6;
    ents.forEach(e=>{ if(trail&&!e.page){ for(let i=0;i<e.t.length;i++){ const m=/^(.*\S)\s+(\d{1,3})$/.exec(e.t[i]); if(m){ e.t[i]=m[1]; e.page=+m[2]; break; } } } e.title=e.t.join(' ').replace(/\s*\.{3,}.*$/,'').replace(/\s+/g,' ').trim(); });
    const sp=X.sqp(id), start=Math.max.apply(null,r.tp); let last=start;
    ents.forEach(e=>{ const s=X.sq(e.title); e.fp=0; if(s.length<10) return; const keys=[s.slice(0,26), s.slice(6,30), s.slice(Math.max(0,s.length-24))];
      for(const k of keys){ if(k.length<10) continue; let hit=-1; for(let i=last;i<sp.length;i++){ if(sp[i].includes(k)){hit=i;break;} } if(hit<0){ for(let i=start;i<last;i++){ if(sp[i].includes(k)){hit=i;break;} } }
        if(hit>=0){ e.fp=hit+1; last=hit; break; } } });
    /* Агуулгад хуудасны дугаар буруу (өмнөхөөсөө бага/тэнцүү) бичигдсэн бол бичвэрээс олсон хуудсыг баримтална */
    let prev=0; ents.forEach(e=>{ if(e.page){ if(e.page<=prev){ e.page=0; } else prev=e.page; } });
    return {id:id,tp:r.tp,ents:ents,S:r.S,numbered:numbered,trail:trail};
  };
  X.pscore=(id,fp,title,au)=>{ const sp=X.sqp(id); const txt=(sp[fp-1]||'')+' '+(sp[fp]||''); const k=X.sq(title); let s=(k.length>=10&&(txt.includes(k.slice(0,22))||txt.includes(k.slice(8,30))))?2:0; au.forEach(a=>{ const n=X.sq(a.split(',')[0]); if(n.length>=4&&txt.includes(n)) s++; }); return s; };
  X.final=id=>{ const b=X.build(id), ocr=!!OCR[id]; const d={}; b.ents.forEach(e=>{ if(e.fp&&e.page){ const k=e.fp-e.page; d[k]=(d[k]||0)+1; } }); let off=null, rel=false; const ks=Object.keys(d); if(ks.length&&Math.max.apply(null,ks.map(k=>d[k]))>=4){ off=+ks.sort((a,c)=>d[c]-d[a])[0]; rel=true; } else { let best=null; for(let o=-6;o<=12;o++){ const c=b.ents.filter(e=>e.fp&&b.S.has(e.fp-o)).length; if(!best||c>best.c) best={o:o,c:c}; } off=best.o; rel=best.c>=b.ents.length*0.6; }
    const res=[]; b.ents.forEach(e=>{ let title=e.title; let fp=e.fp, pg=e.page||0; const tm=/^(.*\S)\s+(\d{1,3})$/.exec(title); if(tm&&!b.trail&&b.S.has(+tm[2])&&+tm[2]>3&&(!pg||pg===+tm[2])){ title=tm[1]; if(!pg) pg=+tm[2]; }
      if(ocr) title=X.repair(title); let au=X.authors(e.a,ocr);
      if(pg&&fp&&Math.abs(fp-pg-off)>1){ /* агуулгын хуудас ба бичвэрээс олсон хуудас зөрвөл гарчиг, зохиогчид нь аль хуудсанд байгаагаар шийднэ */ const s1=X.pscore(id,fp,e.title,au), s2=X.pscore(id,pg+off,e.title,au); if(s2>=s1) fp=pg+off; else pg=0; } else if(pg&&!fp) fp=pg+off; if(!pg&&fp){ const c=fp-off; if(b.S.has(c)) pg=c; else if(b.S.has(c-1)) pg=c-1; else if(b.S.has(c+1)) pg=c+1; else if(rel) pg=c; }
      if(!au.length&&fp&&b.trail&&!b.numbered) au=X.pageAuthors(id,fp);
      const kw=fp?X.keywords(id,fp,ocr):[];
      if(!au.length&&!(b.trail&&!b.numbered)) return; if(title.length<12) return;
      res.push({t:title,a:au,p:pg,fp:fp||0,k:kw}); });
    res.forEach((r,i)=>{ const nx=res[i+1]; r.pp=r.p?(nx&&nx.p>r.p+1&&nx.p-r.p<40?r.p+'-'+(nx.p-1):String(r.p)):''; });
    return {ocr:ocr?1:0,off:off,arts:res.map(a=>[a.t,a.a,a.pp,a.k,a.fp])}; };

  var out = { v: 1, issues: {}, fp: {}, log: [] };
  for (const id of cleanIds.concat(ocrIds)) { out.issues[id] = X.final(id); out.log.push(id + ": " + out.issues[id].arts.length + " нийтлэл"); }

  /* Каталогт бүртгэлтэй нийтлэлүүд: цахим хувилбарын хуудсыг гарчгаар нь хайж олно */
  if (cfg.deep !== false) {
    var cnt = CAT.issues.map(function () { return 0; }); CAT.articles.forEach(function (a) { cnt[a[1]]++; });
    for (let i = 0; i < CAT.issues.length; i++) { const is = CAT.issues[i]; if (!is.flip || !cnt[i]) continue; const id = is.flip.replace(/\/$/, "").split("/").pop(); let pages;
      try { pages = await getPages(id); } catch (e) { out.log.push(id + " " + is.label + ": " + e.message); continue; }
      const sp = pages.map(X.sq), arts = CAT.articles.filter(a => a[1] === i), diffs = {}, FP = {}; let found = 0;
      arts.forEach(a => { const s = X.sq(a[2]); if (s.length < 12) return; const keys = [s.slice(0, 26), s.slice(6, 30), s.slice(Math.max(0, s.length - 24))]; let hit = -1;
        for (const k of keys) { if (k.length < 12) continue; for (let j = 8; j < sp.length; j++) { if (sp[j].includes(k)) { hit = j; break; } } if (hit >= 0) break; }
        if (hit >= 0) { found++; FP[a[0]] = hit + 1; const pg = parseInt(a[4], 10); if (pg) { const d = hit + 1 - pg; diffs[d] = (diffs[d] || 0) + 1; } } });
      const ks = Object.keys(diffs).sort((a, b) => diffs[b] - diffs[a]); const off = ks.length && diffs[ks[0]] >= Math.max(3, arts.length * 0.4) ? +ks[0] : null;
      if (off !== null) arts.forEach(a => { const pg = parseInt(a[4], 10); if (pg) { const cur = FP[a[0]]; if (!cur || Math.abs(cur - pg - off) > 1) FP[a[0]] = pg + off; } });
      Object.assign(out.fp, FP); out.log.push(id + " " + is.label + ": " + found + "/" + arts.length + " олдсон"); }
  }
  return JSON.stringify(out);
};
