export type ScheduleWindow={dayOfWeek:number;startMinute:number;endMinute:number;timezone:string;enabled:boolean};
const weekdays:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
export function isWithinVendorSchedule(schedules:ScheduleWindow[],now=new Date()){
  const enabled=schedules.filter(item=>item.enabled);if(!enabled.length)return true;const timezone=enabled[0].timezone,parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),value=(type:string)=>parts.find(part=>part.type===type)?.value??'',day=weekdays[value('weekday')],minute=Number(value('hour'))*60+Number(value('minute'));
  return enabled.some(item=>item.startMinute<item.endMinute?item.dayOfWeek===day&&minute>=item.startMinute&&minute<item.endMinute:(item.dayOfWeek===day&&minute>=item.startMinute||item.dayOfWeek===(day+6)%7&&minute<item.endMinute));
}
