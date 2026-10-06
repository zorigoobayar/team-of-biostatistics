# Paper Explainer — AI, Web of Science, Scopus-ыг асаах

`paper-explainer.qmd` хуудас нэмэлт тохиргоогүйгээр **PubMed хайлт + бэлэн тайлбарын сангаар** ажиллана.
Доорх гурвыг асаахын тулд API түлхүүр болон энэ хавтас дахь жижиг сервер (`worker.js`) хэрэгтэй.

| Боломж | Юу хэрэгтэй вэ | Яагаад сервер хэрэгтэй вэ |
|---|---|---|
| AI-ийн энгийн тайлбар + асуулт асуух чат | Claude API түлхүүр ([console.anthropic.com](https://console.anthropic.com/), төлбөртэй, хэрэглээгээр тооцно) | Түлхүүрийг вэб хуудсанд ил бичвэл хэн ч хуулж аваад таны дансаар ашиглана |
| Web of Science хайлт | Clarivate-ийн Web of Science Starter API түлхүүр ([developer.clarivate.com](https://developer.clarivate.com/apis/wos-starter)) | Clarivate-ийн API вэб хуудаснаас шууд дуудагдахыг зөвшөөрдөггүй (CORS) |
| Scopus хайлт (бүх зочинд) | Elsevier API түлхүүр ([dev.elsevier.com](https://dev.elsevier.com/)), байгууллагын Scopus эрх | Заавал биш: зочин өөрийн түлхүүрийг хуудсан дээр оруулж ч болно |

Түлхүүр байгаа боломж л асна. Жишээ нь зөвхөн `ANTHROPIC_API_KEY` тавибал зөвхөн AI асна.

## Байршуулах (Cloudflare Workers, үнэгүй багц хангалттай)

Компьютер дээр Node.js суусан байх шаардлагатай.

```bash
cd _backend
npx wrangler login                      # Cloudflare бүртгэлээр нэвтэрнэ
npx wrangler deploy                     # wrangler.toml-ийн тохиргоогоор байршуулна

# Түлхүүрүүдээ нууцаар хадгална (байгааг нь л)
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put WOS_API_KEY
npx wrangler secret put SCOPUS_API_KEY
```

`deploy` командын төгсгөлд `https://paper-explainer.<таны-нэр>.workers.dev` гэсэн хаяг гарна.

## Хуудсанд холбох

`paper-explainer.qmd` доторх нэг мөрийг засна:

```html
<div class="ps-app" data-glossary="glossary/terms.yml" data-api="https://paper-explainer.<таны-нэр>.workers.dev">
```

Дараа нь `main` салбар руу push хийхэд сайт шинэчлэгдэнэ. Шалгах: хөтчөөр
`https://paper-explainer.<таны-нэр>.workers.dev/config` хаягийг нээхэд
`{"ai":true,"wos":true,"scopus":false}` маягийн хариу гарна.

## Анхаарах зүйл

- **Зардал.** AI тайлбар бүр Claude API-ийн төлбөртэй. Анхдагч загвар нь хамгийн хямд `claude-haiku-4-5-20251001`; өөр загвар хэрэглэх бол `wrangler.toml` доторх `AI_MODEL`-ээр солино. Ижил нийтлэлийн анхны тайлбарыг сервер 30 хоног хадгалдаг тул дахин төлөхгүй.
- **Хязгаар тавих.** Сервер зөвхөн `ALLOWED_ORIGINS`-д заасан сайтаас (анхдагч: `https://zorigoobayar.github.io`) ирсэн хүсэлтийг хүлээн авна. Гэхдээ энэ нь бүрэн хамгаалалт биш тул Anthropic Console дээр сарын зарцуулалтын дээд хязгаар, Cloudflare дээр хүсэлтийн тооны хязгаар (rate limiting) заавал тавиарай.
- **Scopus.** Сервер таны их сургуулийн сүлжээнд байрлахгүй тул Elsevier түлхүүрийг «сүлжээний гаднаас» гэж үзэж татгалзаж болно. Тэр тохиолдолд Elsevier-ээс institutional token авч `SCOPUS_INSTTOKEN` нэрээр нэмнэ.
- **Туршилт.** AI, Web of Science, Scopus-ын холболтыг жинхэнэ түлхүүргүйгээр, дуурайлгасан хариугаар л шалгасан. Түлхүүрээ тавьсны дараа хуудсан дээрээс нэг удаа хайж, тайлбар зөв гарч байгааг нягтлаарай.
- Сайтаа өөр хаяг руу (өөрийн домэйн) нүүлгэвэл `wrangler.toml` доторх `ALLOWED_ORIGINS`-д шинэ хаягаа таслалаар нэмээд `npx wrangler deploy` дахин ажиллуулна.
