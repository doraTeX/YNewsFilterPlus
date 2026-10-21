const defaults = {version: 1, rows: [], enabled: true, showPageChip: true, ignoreCase: true,
  normalization: 'loose', ignoreSeparators: false, legacyRate: false, aiConditions: [], aiInterests: [], aiThreshold: 0.8, aiHighlightColor: "#fff3bf", aiEnabled:false, aiBodyEnabled:false, aiBodyLow:0.3, aiDebug:false, aiShowProgress:true, aiConcurrency:5, aiRequestLimit:200};
function validate(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.rows) ||
      value.rows.some(x => typeof x !== 'string')) throw Error('設定形式が不正です');
  const out = {...defaults};
  for (const k of ['enabled', 'showPageChip', 'ignoreCase', 'ignoreSeparators', 'legacyRate', 'aiEnabled', 'aiBodyEnabled', 'aiDebug', 'aiShowProgress']) {
    if (k in value && typeof value[k] !== 'boolean') throw Error(k + ' は真偽値で指定してください');
    if (k in value) out[k] = value[k];
  }
  if (value.normalization && !['loose','legacy'].includes(value.normalization)) throw Error('正規化方式が不正です');
  out.normalization = value.normalization || defaults.normalization;
  out.rows = value.rows.map(x=>x.trim()).filter(Boolean);
  if(value.aiConditions!==undefined&&(!Array.isArray(value.aiConditions)||value.aiConditions.some(x=>typeof x!=='string')))throw Error('AI除外条件は文字列の配列で指定してください');
  out.aiConditions=[...new Set((value.aiConditions||[]).map(x=>x.trim()).filter(Boolean))];
  if(out.aiConditions.some(x=>x.length>500))throw Error('AI除外条件は1件500文字までです');
  if(value.aiInterests!==undefined&&(!Array.isArray(value.aiInterests)||value.aiInterests.some(x=>typeof x!=='string')))throw Error('興味のあるキーワードは文字列の配列で指定してください');
  out.aiInterests=[...new Set((value.aiInterests||[]).map(x=>x.trim()).filter(Boolean))];
  if(out.aiInterests.some(x=>x.length>500))throw Error('興味のあるキーワードは1件500文字までです');
  out.aiHighlightColor=value.aiHighlightColor??defaults.aiHighlightColor;
  if(typeof out.aiHighlightColor!=='string'||!/^#[0-9a-f]{6}$/i.test(out.aiHighlightColor))throw Error('ハイライト色は6桁のカラーコードで指定してください');
  out.aiHighlightColor=out.aiHighlightColor.toLowerCase();
  out.aiThreshold=value.aiThreshold??defaults.aiThreshold;
  if(typeof out.aiThreshold!=='number'||!Number.isFinite(out.aiThreshold)||out.aiThreshold<0.5||out.aiThreshold>1)throw Error('AI判定値は0.5〜1にしてください');
  out.aiBodyLow=value.aiBodyLow??0.3;
  if(typeof out.aiBodyLow!=='number'||!Number.isFinite(out.aiBodyLow)||out.aiBodyLow<0||out.aiBodyLow>1)throw Error('本文追加判定の下限は0〜1にしてください');
  out.aiConcurrency=value.aiConcurrency??5;
  if(!Number.isSafeInteger(out.aiConcurrency)||out.aiConcurrency<1||out.aiConcurrency>20)throw Error('同時問い合わせ数は1〜20の整数にしてください');
  out.aiRequestLimit=value.aiRequestLimit??200;
  if(!Number.isSafeInteger(out.aiRequestLimit)||out.aiRequestLimit<1)throw Error('問い合わせ上限は1以上の整数にしてください');
  parseRows(out.rows, out);
  return out;
}
function normalize(text, config, sensitive) {
  let s = String(text);
  if (config.normalization === 'legacy') {
    s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
  } else {
    s = s.normalize('NFKD').replace(/\p{M}/gu, c => /[\u3099\u309a]/u.test(c) ? c : '').normalize('NFC');
    s = s.replace(/[‘’‚‛]/g,"'").replace(/[“”„‟]/g,'"')
      .replace(/[‐‑‒–—−]/g,'-').replace(/[〜～]/g,'~').replace(/[・･]/g,'');
  }
  if (!sensitive) {
    s = s.toLowerCase();
    if (config.normalization !== 'legacy') s = s.replace(/ß/g,'ss').replace(/ς/g,'σ');
  }
  if (config.ignoreSeparators) s = s.replace(/[\p{P}\p{Z}\s]/gu,'');
  return s;
}
function parseRows(rows, config) {
  return rows.map((row,index)=> {
    const [word, options, ...rest] = row.split('||');
    if (rest.length || !word.trim()) throw Error(`${index+1}行目: キーワードが不正です`);
    let sensitive = !config.ignoreCase, rate = '100';
    if (options !== undefined) for (const option of options.split(',')) {
      const match = option.trim().match(/^(case|rate):(.+)$/);
      if (!match) throw Error(`${index+1}行目: 未対応のオプション`);
      if (match[1] === 'case') {
        if (!/^[01]$/.test(match[2])) throw Error('case は 0 または 1');
        sensitive = match[2] === '1';
      } else {
        if (!/^\d+(?:\.\d+)?!?$/.test(match[2]) || Number(match[2].replace('!',''))>100) throw Error('rate は 0〜100（末尾 ! 可）');
        rate = match[2];
      }
    }
    const needle = normalize(word.trim(),config,sensitive);
    if (!needle) throw Error(`${index+1}行目: 正規化すると空になるキーワードです`);
    return {word:word.trim(),needle, sensitive, rate, count:0};
  });
}
function shouldHide(rule, config) {
  const percent = Number(rule.rate.replace('!',''));
  if (!config.legacyRate && percent === 100) return true;
  const cycle = Math.round(100 / Math.max(1,100-percent));
  rule.count++;
  const show = rule.rate.endsWith('!') ? rule.count===1 : rule.count>=cycle;
  if (rule.count>=cycle) rule.count=0;
  return !show;
}
function cleanRows(rows, config) {
  const nonempty=rows.map(x=>x.trim()).filter(Boolean);
  const rules=parseRows(nonempty,config), seen=new Set(), result=[];
  rules.forEach((r,i)=>{
    let rate=String(Number(r.rate.replace('!','')))+(r.rate.endsWith('!')?'!':'');
    if(!config.legacyRate && Number(r.rate.replace('!',''))===100)rate='100';
    const key=JSON.stringify([r.needle,r.sensitive,rate]);
    if(!seen.has(key)){seen.add(key);result.push(nonempty[i]);}
  });
  return {rows:result,removed:nonempty.length-result.length};
}

export {defaults,validate,normalize,parseRows,shouldHide,cleanRows};
