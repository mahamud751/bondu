export type BillingRoundingMethod = 'EXACT_SECOND'|'UP_30_SECONDS'|'UP_FULL_MINUTE'|'MINIMUM_ONE_MINUTE';

export function billableSeconds(duration:number,maximum:number,method:BillingRoundingMethod){
  const safe=Math.max(0,Math.min(Math.floor(duration),Math.floor(maximum)));
  if(safe===0)return 0;
  let rounded=safe;
  if(method==='UP_30_SECONDS')rounded=Math.ceil(safe/30)*30;
  if(method==='UP_FULL_MINUTE')rounded=Math.ceil(safe/60)*60;
  if(method==='MINIMUM_ONE_MINUTE')rounded=Math.max(60,safe);
  return Math.min(Math.floor(maximum),rounded);
}

export function settingNumber(value:unknown,key:string,fallback:number,min:number,max:number){
  if(typeof value!=='object'||value===null)return fallback;
  const candidate=(value as Record<string,unknown>)[key];
  return typeof candidate==='number'&&Number.isFinite(candidate)?Math.min(max,Math.max(min,Math.floor(candidate))):fallback;
}
