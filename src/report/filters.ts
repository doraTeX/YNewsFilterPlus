export function initializeReportFilters(doc:Document){
 const inputs=Array.from(doc.querySelectorAll<HTMLInputElement>('[data-filter]'));
 const search=doc.querySelector<HTMLInputElement>('#report-text-filter');
 const rows=Array.from(doc.querySelectorAll<HTMLTableRowElement>('tbody tr'));
 const titles=rows.map(row=>(row.querySelector('.article')?.textContent||'').toLowerCase());
 function update(){
  const selected=new Set(inputs.filter(e=>e.checked).map(e=>e.dataset.filter)),query=(search?.value||'').trim().toLowerCase(),matches=new Map<string,number>();let count=0;
  rows.forEach((row,i)=>{const match=titles[i].includes(query);if(match)matches.set(row.className,(matches.get(row.className)||0)+1);row.hidden=!selected.has(row.className)||!match;if(!row.hidden)count++;});
  for(const input of inputs){const counter=input.parentElement?.querySelector('[data-filter-count]');if(counter)counter.textContent=String(matches.get(input.dataset.filter!)||0);}
  doc.getElementById('filter-count')!.textContent=`${count} / ${rows.length} 行を表示`;
  doc.getElementById('filter-empty')!.hidden=count!==0;
 }
 search?.addEventListener('input',update);
 inputs.forEach(e=>e.addEventListener('change',update));
 doc.querySelectorAll<HTMLElement>('[data-filter-all]').forEach(button=>button.addEventListener('click',()=>{inputs.forEach(e=>e.checked=button.dataset.filterAll==='true');update();}));
 update();
}
